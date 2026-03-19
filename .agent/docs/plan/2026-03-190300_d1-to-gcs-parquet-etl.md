# D1→BigQuery ETL簡素化: Worker→GCS(Parquet)→BQ外部テーブル

## Context

現在のD1→BigQuery ETLは Worker→R2(NDJSON)→Pythonコンテナ(dlt)→BigQuery の3段階。データ量（14テーブル・数MB）に対してdlt依存・Pythonコンテナ起動がオーバーエンジニアリング。

**目標**: WorkerからGCSにParquetで直接エクスポートし、BigQuery外部テーブルで直接クエリ可能にする。GCP側コンピュート（Cloud Function等）不要のシンプルな構成を目指す。

**新アーキテクチャ:**
```
Before: Worker cron → D1 → R2(NDJSON) → Python Container(dlt) → BigQuery
After:  Worker cron → D1 → GCS(Parquet)
        BigQuery 外部テーブル → GCS(Parquet) を直接クエリ
```

**何が不要になるか:**
- R2への中間NDJSON出力（`d1-export.server.ts`→GCSエクスポートに置き換え）
- Pythonコンテナによるデータロード（`extract_and_load_to_bq.py` 削除）
- dlt依存
- GCP側コンピュート（Cloud Function / Cloud Scheduler 不要）

---

## Part 1: Worker側の変更

### 1.1 依存追加

```bash
npm install hyparquet-writer jose
```

- `hyparquet-writer`: 純粋JS・<100KB・Parquet書き込み。Cloudflare Workers互換
- `jose`: GCS認証用JWT署名（既にBigQuery認証の調査で確認済み）

### 1.2 `app/modules/gcs-export.server.ts` の新規作成

`d1-export.server.ts` を置き換える新モジュール。D1 → Parquet → GCS。

**構成:**
```typescript
// 定数
const TABLES = [ /* d1-export.server.ts の14テーブルをそのまま移植 */ ];
const GCS_BUCKET = "hpe-d1-export";
const GCS_PREFIX = "d1";
const BATCH_SIZE = 1000;

// GCS認証: SA情報からOAuth2アクセストークン取得
async function getGCSAccessToken(env: CloudflareEnv): Promise<string>
  // Secrets Store から SS_GCS_CLIENT_EMAIL, SS_GCS_PRIVATE_KEY, SS_GCS_PRIVATE_KEY_ID を取得
  // jose で JWT 署名 (scope: https://www.googleapis.com/auth/devstorage.read_write)
  // POST https://oauth2.googleapis.com/token でアクセストークン交換

// D1テーブルをParquetに変換
function rowsToParquet(rows: Record<string, unknown>[]): ArrayBuffer
  // hyparquet-writer の parquetWriteBuffer() を使用
  // codec: 'UNCOMPRESSED' (SNAPPY WASMを避ける)

// GCSにアップロード
async function uploadToGCS(accessToken: string, bucket: string, key: string, data: ArrayBuffer): Promise<void>
  // GCS JSON API: PUT https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o?uploadType=media&name={key}
  // Content-Type: application/octet-stream

// メインエクスポート関数
export async function exportD1ToGCS(env: CloudflareEnv): Promise<ExportResult>
  // 1. GCSアクセストークン取得（1回だけ）
  // 2. 14テーブルを順次処理（並列しない）:
  //    a. D1 SELECT (LIMIT 1000 OFFSET Nでページネーション)
  //    b. rowsToParquet() でParquet変換
  //    c. uploadToGCS() で gs://hpe-d1-export/d1/{table_name}.parquet にアップロード
  // 3. 結果サマリを返す
```

**設計ポイント:**
- **順次処理**: Codex指摘に対応。Workers同時接続数制限（6）を考慮し、1テーブルずつ処理
- **Parquet無圧縮**: SNAPPY WASMを避けてUNCOMPRESSED。数MBなので問題なし
- **GCS JSON API**: REST APIで直接アップロード。ライブラリ不要
- **認証**: `jose`でJWT→OAuth2トークン。Cloudflare Workers公式チュートリアルで実績あり

### 1.3 Secrets Store バインディング追加

**`wrangler.toml`** に追加:
```toml
[[secrets_store_secrets]]
binding = "SS_GCS_CLIENT_EMAIL"
store_id = "52f3d1be601046039169fad4f66570d1"
secret_name = "GCS_CLIENT_EMAIL"

# 同様に SS_GCS_PRIVATE_KEY, SS_GCS_PRIVATE_KEY_ID
```

**`app/types/env.ts`** に追加:
```typescript
SS_GCS_CLIENT_EMAIL: { get(): Promise<string> };
SS_GCS_PRIVATE_KEY: { get(): Promise<string> };
SS_GCS_PRIVATE_KEY_ID: { get(): Promise<string> };
```

### 1.4 認証について

- GCS書き込み専用SA（`roles/storage.objectCreator` のみ、1バケット限定）
- 現状の `BIGQUERY_CREDENTIALS`（BQ全権限のSAキーJSON丸ごと）よりもはるかに権限が小さい
- WIF（Workload Identity Federation）は別タスクとして将来検討。CloudflareWorkerからのOIDCトークン発行が課題

### 1.5 `worker.ts` cronハンドラ更新

`worker.ts:73-84` を変更:
```typescript
// Before
const { exportD1ToR2 } = await import('./app/modules/d1-export.server');
const { manifest_key } = await exportD1ToR2(env);
const { callContainer } = await import('./app/modules/automation.server');
await callContainer(env, '/etl-to-bq', { manifest_key });

// After
const { exportD1ToGCS } = await import('./app/modules/gcs-export.server');
const result = await exportD1ToGCS(env);
console.log(`[scheduled] GCS export complete: ${result.tables_exported} tables`);
// BigQuery reads directly from GCS via external tables (no load job needed)
```

---

## Part 2: `terraform/google-cloud/` の作成

### 2.1 ディレクトリ構成

```
terraform/google-cloud/
  main.tf               # provider + GCS backend
  variables.tf          # gcp_project_id, gcp_region
  bigquery.tf           # HPE_RAW データセット + 14外部テーブル
  storage.tf            # GCS バケット (hpe-d1-export)
  iam.tf                # GCS書き込みSA + 最小権限
  .envrc.example
  terraform.tfvars.example
  README.md
```

### 2.2 `storage.tf` — GCSバケット

```hcl
resource "google_storage_bucket" "d1_export" {
  name     = "hpe-d1-export"
  location = var.gcp_region

  # 外部テーブル用なので最新ファイルだけあれば良い
  lifecycle_rule {
    condition { age = 7 }
    action { type = "Delete" }
  }

  uniform_bucket_level_access = true
}
```

### 2.3 `bigquery.tf` — データセット + 14外部テーブル

```hcl
resource "google_bigquery_dataset" "hpe_raw" {
  dataset_id    = "HPE_RAW"
  friendly_name = "HPE Raw Data"
  description   = "Raw data from D1, via GCS Parquet external tables"
  location      = var.gcp_region
}

locals {
  d1_tables = [
    "dim_tags", "dim_posts", "dim_comments", "dim_stop_words", "dim_users",
    "rel_post_tags",
    "fct_post_vote_history", "fct_comment_vote_history", "fct_post_edit_history",
    "fct_aicompletion_suggestion_history", "fct_aicompletion_commit_history",
    "fct_user_bookmark_activity",
    "now_editing_pages", "social_post_jobs",
  ]
}

resource "google_bigquery_table" "d1_external" {
  for_each   = toset(local.d1_tables)
  dataset_id = google_bigquery_dataset.hpe_raw.dataset_id
  table_id   = each.value

  external_data_configuration {
    source_format = "PARQUET"
    autodetect    = true
    source_uris   = ["gs://${google_storage_bucket.d1_export.name}/d1/${each.value}.parquet"]
  }

  deletion_protection = false
}
```

### 2.4 `iam.tf` — 最小権限SA

```hcl
resource "google_service_account" "gcs_writer" {
  account_id   = "d1-export-writer"
  display_name = "D1 Export GCS Writer (Cloudflare Worker)"
}

# GCSバケットへの書き込みのみ
resource "google_storage_bucket_iam_member" "writer" {
  bucket = google_storage_bucket.d1_export.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.gcs_writer.email}"
}
```

### 2.5 `main.tf`

```hcl
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6"
    }
  }
  backend "gcs" {
    bucket = "hpe-terraform-state-gcp"
    prefix = "terraform/state"
  }
}
provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}
```

### 2.6 初期化手順

1. GCSバケット `hpe-terraform-state-gcp` を手動作成（stateバックエンド用）
2. `terraform init`
3. 既存BQデータセットをimport: `terraform import google_bigquery_dataset.hpe_raw projects/healthy-person-emulator/datasets/HPE_RAW`
4. SAキーをダウンロードし、Cloudflare Secrets Storeに登録（client_email, private_key, private_key_id）
5. `terraform apply`

---

## Part 3: 不要コードの削除

| ファイル | アクション |
|---------|-----------|
| `app/modules/d1-export.server.ts` | 削除（gcs-export.server.tsに置き換え） |
| `container/tasks/extract_and_load_to_bq.py` | 削除 |
| `container/main.py` | `/etl-to-bq` ルート削除 |
| `container/pyproject.toml` | `dlt[bigquery]` 依存削除 |

**残すもの:**
- `automation.server.ts` の `BIGQUERY_CREDENTIALS` — コンテナレポートタスクが引き続き使用
- `env.ts` の `BIGQUERY_CREDENTIALS?: string` — 同上

---

## Part 4: Cloudflare Terraform更新

`terraform/cloudflare/workers.tf` の `bindings` に GCS Secrets Store バインディングを追加（`ignore_changes = all` のためドキュメンテーション目的）。

---

## 実装順序

### Phase 1: GCPインフラ（Terraform）
1. `terraform/google-cloud/` 作成、全.tfファイル
2. GCS stateバケット手動作成 → `terraform init`
3. 既存BQデータセット import
4. `terraform apply` → GCSバケット + SA + BQ外部テーブル作成
5. SAキーをCloudflare Secrets Storeに登録

### Phase 2: Worker新モジュール（並走）
1. `hyparquet-writer` + `jose` インストール
2. `gcs-export.server.ts` 作成
3. `wrangler.toml` + `env.ts` にバインディング追加
4. **旧パイプラインは維持したまま**、`worker.ts`に新エクスポートを追加（旧+新の二重書き込み）
5. デプロイ後、GCSにParquetが書かれることを確認
6. BigQuery外部テーブルでクエリし、旧テーブルと行数比較

### Phase 3: 切り替え
- `worker.ts`から旧パイプライン（d1-export + callContainer）を削除
- `gcs-export.server.ts`のみに切り替え

### Phase 4: クリーンアップ
- 不要コード削除（Part 3の表参照）
- R2の`etl/`データは任意で削除

---

## 検証方法

1. `wrangler dev --remote` でcron手動トリガー:
   ```bash
   curl "http://localhost:8787/__scheduled?cron=0+16+*+*+*"
   ```
2. GCSバケットで14個のParquetファイルの存在確認:
   ```bash
   gsutil ls gs://hpe-d1-export/d1/
   ```
3. BigQuery外部テーブルでクエリ:
   ```sql
   SELECT COUNT(*) FROM `HPE_RAW.dim_posts`;
   ```
4. 旧パイプラインの行数と比較
5. コンテナの他タスク（OGP, social post, reports）が引き続き動作確認
6. `terraform plan` で差分なし確認

---

## 主要ファイル一覧

| ファイル | 操作 |
|---------|------|
| `app/modules/gcs-export.server.ts` | 新規作成 |
| `terraform/google-cloud/*.tf` | 新規作成（6ファイル） |
| `terraform/google-cloud/.envrc.example` | 新規作成 |
| `terraform/google-cloud/README.md` | 新規作成 |
| `worker.ts` | cronハンドラ書き換え |
| `wrangler.toml` | GCSバインディング追加 |
| `app/types/env.ts` | GCS型定義追加 |
| `terraform/cloudflare/workers.tf` | GCSバインディング追加（ドキュメント目的） |
| `app/modules/d1-export.server.ts` | 削除（Phase 4） |
| `container/tasks/extract_and_load_to_bq.py` | 削除（Phase 4） |
| `container/main.py` | ETLルート削除（Phase 4） |
| `container/pyproject.toml` | dlt依存削除（Phase 4） |

## 参照ファイル（既存、変更なし）

| ファイル | 参照理由 |
|---------|---------|
| `app/modules/d1-export.server.ts` | テーブル一覧、ページネーションパターンの移植元 |
| `container/tasks/extract_and_load_to_bq.py` | 旧ETLロジック参照 |
| `container/shared/config.py` | R2クライアント設定パターン |
| `terraform/cloudflare/main.tf` | Terraform構成パターン |
| `app/modules/automation.server.ts` | resolveSecrets（BIGQUERY_CREDENTIALSは残す） |

## 認証に関する注記

- Worker→GCS: SAキー（`roles/storage.objectCreator`のみ、1バケット限定）を暫定使用
- 現行の`BIGQUERY_CREDENTIALS`（BQ全権限のSAキーJSON）よりも大幅に権限が小さい
- Workload Identity Federation（CloudflareWorker→GCP認証のキーレス化）は別タスクで将来検討

## 調査ログ（実装後に削除）

以下のファイルはエージェントが作成した調査ログ。メインプランに反映済み:
- `kind-exploring-wall-agent-a1e6690885a6c6393.md` — BigLake + R2互換性調査（結果: BigLakeはR2非対応）
- `kind-exploring-wall-agent-a75aed2a8033bcbcf.md` — Worker Parquet生成ライブラリ比較（結果: hyparquet-writer推奨）
- `kind-exploring-wall-agent-a0d0689f5a979d653.md` — STS + BQ外部テーブル調査（結果: STS agent-basedはオーバーキル）
