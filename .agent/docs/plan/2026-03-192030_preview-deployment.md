# PR Preview Deployment: preview.healthy-person-emulator.org

## Context

PRのプレビュー環境が存在しない（Phase 3として見送りされていた）。`preview.healthy-person-emulator.org` はGoogle Sitesを指している。
PRがOpenになった際にプレビュー環境に自動デプロイし、本番マージ前にUIや機能変更を確認できるようにする。

**設計方針**: 単一プレビューWorker（最新PRが上書き）。Per-PR Workerは D1/Queue の動的作成が必要で複雑すぎる。

---

## 変更ファイル一覧

| 操作 | ファイル | 内容 |
|---|---|---|
| 新規 | `wrangler.preview.toml` | プレビュー用Wrangler設定 |
| 新規 | `.github/workflows/preview-deploy.yml` | PRプレビューデプロイワークフロー |
| 新規 | `terraform/cloudflare/modules/worker-env/main.tf` | Worker環境モジュール本体 |
| 新規 | `terraform/cloudflare/modules/worker-env/variables.tf` | モジュール入力変数 |
| 新規 | `terraform/cloudflare/modules/worker-env/outputs.tf` | モジュール出力 |
| 編集 | `terraform/cloudflare/workers.tf` → `terraform/cloudflare/environments.tf` にリネーム | prd/previewモジュール呼び出し |
| 編集 | `terraform/cloudflare/d1.tf` | 削除（モジュールに移動） |
| 編集 | `terraform/cloudflare/queue.tf` | 削除（モジュールに移動） |
| 編集 | `terraform/cloudflare/dns.tf` | preview CNAME削除 |
| 編集 | `terraform/cloudflare/turnstile.tf` | previewドメイン追加 |

---

## Step 1: Terraform モジュール化

### ディレクトリ構造

```
terraform/cloudflare/
  main.tf              # Provider, backend（変更なし）
  variables.tf         # ルート変数（変更なし）
  environments.tf      # prd/preview モジュール呼び出し（workers.tf をリネーム・書き換え）
  r2.tf                # 共有R2バケット（変更なし）
  dns.tf               # 共有DNS（preview CNAME削除）
  turnstile.tf         # 共有Turnstile（previewドメイン追加）
  modules/
    worker-env/
      main.tf          # Worker Script, Custom Domain, Cron Triggers
      d1.tf            # D1 Database
      queue.tf         # Queue + DLQ
      variables.tf     # モジュール入力
      outputs.tf       # モジュール出力（D1 ID等）
```

### モジュール `worker-env` の設計

#### `modules/worker-env/variables.tf`

```hcl
variable "account_id" { type = string }
variable "zone_id" { type = string }

variable "worker_name" {
  description = "Worker script name (e.g. healthy-person-emulator-dotorg)"
  type        = string
}

variable "d1_name" {
  description = "D1 database name"
  type        = string
}

variable "queue_name" {
  description = "Queue base name (DLQ is {queue_name}-dlq)"
  type        = string
}

variable "base_url" {
  description = "BASE_URL for the environment"
  type        = string
}

variable "hostname" {
  description = "Custom domain hostname"
  type        = string
}

variable "cron_schedules" {
  description = "Cron trigger schedules (empty = no crons)"
  type        = list(object({ cron = string }))
  default     = []
}

# 共有リソースへの参照
variable "r2_static_bucket_name" { type = string }
variable "r2_parquet_bucket_name" { type = string }
variable "secrets_store_id" {
  type    = string
  default = "52f3d1be601046039169fad4f66570d1"
}
```

#### `modules/worker-env/d1.tf`

```hcl
resource "cloudflare_d1_database" "db" {
  account_id       = var.account_id
  name             = var.d1_name
  read_replication = { mode = "disabled" }
}
```

#### `modules/worker-env/queue.tf`

```hcl
resource "cloudflare_queue" "main" {
  account_id = var.account_id
  queue_name = var.queue_name
}

resource "cloudflare_queue" "dlq" {
  account_id = var.account_id
  queue_name = "${var.queue_name}-dlq"
}
```

#### `modules/worker-env/main.tf`

```hcl
resource "cloudflare_workers_script" "worker" {
  account_id          = var.account_id
  script_name         = var.worker_name
  main_module         = "worker.js"
  compatibility_date  = "2025-04-01"
  compatibility_flags = ["nodejs_compat"]

  assets = {
    config = {
      html_handling      = "auto-trailing-slash"
      not_found_handling = "none"
    }
  }

  observability = { enabled = true }

  bindings = [
    { name = "AI", type = "ai" },
    { name = "AUTOMATION_CONTAINER", type = "durable_object_namespace", class_name = "AutomationContainer" },
    { name = "BASE_URL", type = "plain_text", text = var.base_url },
    { name = "DB", type = "d1", id = cloudflare_d1_database.db.id },
    { name = "GCS_PARQUET_BASE_URL", type = "plain_text", text = "https://storage.googleapis.com/hpe-temp" },
    { name = "PARQUET_BUCKET", type = "r2_bucket", bucket_name = var.r2_parquet_bucket_name },
    { name = "SOCIAL_POST_QUEUE", type = "queue", queue_name = cloudflare_queue.main.queue_name },
    # Secrets Store bindings
    { name = "SS_AUTOMATION_DRY_RUN", type = "secrets_store_secret", store_id = var.secrets_store_id, secret_name = "AUTOMATION_DRY_RUN" },
    { name = "SS_BLUESKY_PASSWORD", type = "secrets_store_secret", store_id = var.secrets_store_id, secret_name = "BLUESKY_PASSWORD" },
    { name = "SS_BLUESKY_USER", type = "secrets_store_secret", store_id = var.secrets_store_id, secret_name = "BLUESKY_USER" },
    { name = "SS_MISSKEY_TOKEN", type = "secrets_store_secret", store_id = var.secrets_store_id, secret_name = "MISSKEY_TOKEN" },
    { name = "SS_R2_ACCESS_KEY_ID", type = "secrets_store_secret", store_id = var.secrets_store_id, secret_name = "R2_ACCESS_KEY_ID" },
    { name = "SS_R2_ENDPOINT", type = "secrets_store_secret", store_id = var.secrets_store_id, secret_name = "R2_ENDPOINT" },
    { name = "SS_R2_SECRET_ACCESS_KEY", type = "secrets_store_secret", store_id = var.secrets_store_id, secret_name = "R2_SECRET_ACCESS_KEY" },
    { name = "SS_TWITTER_AT", type = "secrets_store_secret", store_id = var.secrets_store_id, secret_name = "TWITTER_AT" },
    { name = "SS_TWITTER_ATS", type = "secrets_store_secret", store_id = var.secrets_store_id, secret_name = "TWITTER_ATS" },
    { name = "SS_TWITTER_CK", type = "secrets_store_secret", store_id = var.secrets_store_id, secret_name = "TWITTER_CK" },
    { name = "SS_TWITTER_CS", type = "secrets_store_secret", store_id = var.secrets_store_id, secret_name = "TWITTER_CS" },
    { name = "STATIC_BUCKET", type = "r2_bucket", bucket_name = var.r2_static_bucket_name },
    { name = "VECTORIZE", type = "vectorize", index_name = "embeddings-index" },
  ]

  migrations = {
    new_sqlite_classes = ["AutomationContainer"]
    new_tag            = "v2"
  }

  lifecycle {
    ignore_changes = all
  }
}

# Cron Triggers（cron_schedules が空なら作成しない）
resource "cloudflare_workers_cron_trigger" "cron" {
  count       = length(var.cron_schedules) > 0 ? 1 : 0
  account_id  = var.account_id
  script_name = cloudflare_workers_script.worker.script_name
  schedules   = var.cron_schedules
}

# Custom Domain
resource "cloudflare_workers_custom_domain" "domain" {
  account_id  = var.account_id
  zone_id     = var.zone_id
  hostname    = var.hostname
  service     = cloudflare_workers_script.worker.script_name
  environment = "production"
}
```

#### `modules/worker-env/outputs.tf`

```hcl
output "d1_database_id" {
  value = cloudflare_d1_database.db.id
}

output "worker_script_name" {
  value = cloudflare_workers_script.worker.script_name
}
```

### ルートレベル: `environments.tf`（旧 `workers.tf` + `d1.tf` + `queue.tf` を置換）

```hcl
# =============================================================================
# Production Environment
# =============================================================================
module "prd" {
  source = "./modules/worker-env"

  account_id  = var.cloudflare_account_id
  zone_id     = var.cloudflare_zone_id
  worker_name = "healthy-person-emulator-dotorg"
  d1_name     = "healthy-person-emulator-db"
  queue_name  = "social-post"
  base_url    = "https://${var.domain}"
  hostname    = var.domain

  cron_schedules = [
    { cron = "*/10 * * * *" }, # OGP生成 + ソーシャル投稿
    { cron = "0 12 * * *" },   # 殿堂入り記事レポート
    { cron = "0 12 * * 1" },   # 週間サマリーレポート
    { cron = "0 16 * * *" },   # BigQuery ETLエクスポート
  ]

  r2_static_bucket_name  = cloudflare_r2_bucket.static.name
  r2_parquet_bucket_name = cloudflare_r2_bucket.parquet.name
}

# =============================================================================
# Preview Environment
# =============================================================================
module "preview" {
  source = "./modules/worker-env"

  account_id  = var.cloudflare_account_id
  zone_id     = var.cloudflare_zone_id
  worker_name = "healthy-person-emulator-dotorg-preview"
  d1_name     = "healthy-person-emulator-db-preview"
  queue_name  = "social-post-preview"
  base_url    = "https://preview.${var.domain}"
  hostname    = "preview.${var.domain}"

  cron_schedules = [] # プレビューではCron無効

  r2_static_bucket_name  = cloudflare_r2_bucket.static.name   # 共有
  r2_parquet_bucket_name = cloudflare_r2_bucket.parquet.name   # 共有
}
```

### `dns.tf` の変更

`cloudflare_dns_record.preview_cname` を削除（Workers Custom Domainが DNS を自動管理）。

### `turnstile.tf` の変更

```hcl
domains = [
  "healthy-person-emulator-dotorg.sora32127.workers.dev",
  var.domain,
  "preview.${var.domain}",
]
```

### Terraform state 移行

既存リソースをモジュールに移動するため `terraform state mv` が必要:

```bash
terraform state mv cloudflare_d1_database.main module.prd.cloudflare_d1_database.db
terraform state mv cloudflare_queue.social_post module.prd.cloudflare_queue.main
terraform state mv cloudflare_queue.social_post_dlq module.prd.cloudflare_queue.dlq
terraform state mv cloudflare_workers_script.main module.prd.cloudflare_workers_script.worker
terraform state mv cloudflare_workers_cron_trigger.main module.prd.cloudflare_workers_cron_trigger.cron[0]
terraform state mv cloudflare_workers_custom_domain.main module.prd.cloudflare_workers_custom_domain.domain
```

削除するファイル: `d1.tf`, `queue.tf`, `workers.tf`

---

## Step 2: `wrangler.preview.toml` 作成

本番 `wrangler.toml` との差分:

| 項目 | 本番 | プレビュー |
|---|---|---|
| `name` | `healthy-person-emulator-dotorg` | `healthy-person-emulator-dotorg-preview` |
| D1 database_name | `healthy-person-emulator-db` | `healthy-person-emulator-db-preview` |
| D1 database_id | `1d5558b5-...` | Terraform apply後に取得 |
| Queue | `social-post` | `social-post-preview` |
| DLQ | `social-post-dlq` | `social-post-dlq-preview` |
| `[triggers]` crons | あり | **なし** |
| `BASE_URL` var | `https://healthy-person-emulator.org` | `https://preview.healthy-person-emulator.org` |

共有（変更なし）: R2, AI, Vectorize, Secrets Store, Container/DO

---

## Step 3: GitHub Actions ワークフロー

### `.github/workflows/preview-deploy.yml`

```yaml
name: Preview Deploy
on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]
    paths-ignore:
      - "**/*.md"
      - ".agent/**"
      - ".claude/**"
      - "docs/**"
      - "terraform/**"

concurrency:
  group: preview-deploy
  cancel-in-progress: true

jobs:
  deploy:
    if: github.event.pull_request.draft != true
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: "package.json"
          cache: "pnpm"
      - run: pnpm install
      - run: pnpm build
      - name: Apply D1 migrations
        run: npx wrangler d1 migrations apply healthy-person-emulator-db-preview --remote --config wrangler.preview.toml
      - name: Deploy to preview
        run: npx wrangler deploy --config wrangler.preview.toml
      - name: Comment PR with preview URL
        uses: actions/github-script@v7
        with:
          script: |
            const body = `### Preview Deployment\nDeployed to https://preview.healthy-person-emulator.org\nCommit: \`${context.sha.substring(0, 7)}\``;
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number,
            });
            const existing = comments.find(c => c.body?.startsWith('### Preview Deployment'));
            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner, repo: context.repo.repo,
                comment_id: existing.id, body,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner, repo: context.repo.repo,
                issue_number: context.issue.number, body,
              });
            }
```

---

## 安全性の担保

| リスク | 対策 |
|---|---|
| ソーシャル投稿 | `ENQUEUE_ENABLED`/`SEND_ENABLED` 未設定 = 無効 |
| Cron実行 | `[triggers]` なし = `scheduled()` 未発火 |
| 本番DB汚染 | D1が完全に分離 |
| Queue混在 | Queueが完全に分離 |
| Container | デプロイされるが cron 未発火で実行不可 |

---

## Step 4: シークレット設定（手動・1回限り）

Terraform apply + 初回 `wrangler deploy` 後:

```bash
wrangler secret put SESSION_SECRET --name healthy-person-emulator-dotorg-preview
wrangler secret put HPE_SESSION_SECRET --name healthy-person-emulator-dotorg-preview
wrangler secret put CLIENT_URL --name healthy-person-emulator-dotorg-preview
wrangler secret put GOOGLE_CLIENT_ID --name healthy-person-emulator-dotorg-preview
wrangler secret put GOOGLE_CLIENT_SECRET --name healthy-person-emulator-dotorg-preview
wrangler secret put GOOGLE_REDIRECT_URI --name healthy-person-emulator-dotorg-preview
wrangler secret put CF_TURNSTILE_SECRET_KEY --name healthy-person-emulator-dotorg-preview
wrangler secret put CF_TURNSTILE_SITEKEY --name healthy-person-emulator-dotorg-preview
wrangler secret put INTERNAL_API_KEY --name healthy-person-emulator-dotorg-preview
wrangler secret put CF_WORKERS_AI_TOKEN --name healthy-person-emulator-dotorg-preview
wrangler secret put CLOUDFLARE_ACCOUNT_ID --name healthy-person-emulator-dotorg-preview
wrangler secret put VECTORIZE_INDEX_NAME --name healthy-person-emulator-dotorg-preview
```

Google Cloud Console で `https://preview.healthy-person-emulator.org/auth/google/callback` を承認済みリダイレクトURIに追加する。

---

## 実装・適用順序

1. Terraform モジュール化 + preview リソース追加
2. `terraform state mv` で既存リソースをモジュールに移動
3. `terraform apply` でpreviewリソース作成
4. D1 database_id を取得し `wrangler.preview.toml` に記入
5. `wrangler.preview.toml` + `preview-deploy.yml` を追加
6. シークレット手動設定
7. テストPRでE2E検証

---

## 検証方法

1. `terraform plan` で差分が preview リソース追加のみであることを確認
2. `terraform apply` 後、Cloudflare Dashboard でリソース確認
3. テストPRを作成し、preview-deploy ワークフローが発動
4. `preview.healthy-person-emulator.org` にアクセスしてアプリ表示を確認
5. Cloudflare Dashboard でプレビューWorkerにCronがないことを確認
6. merge-gate がプレビューデプロイの完了を待つことを確認

---

## 実施結果 (2026-03-19)

### 完了した作業

1. **Terraform モジュール化**: `modules/worker-env/` を作成し、Worker Script, D1, Queue, Cron, Custom Domain をモジュール化。`providers.tf` をモジュールに追加（cloudflare/cloudflare プロバイダーソース指定が必要だった）。
2. **terraform state mv**: 6つのリソースを `module.prd.*` に移動完了。
3. **terraform apply**: preview環境リソース作成完了。D1 ID = `2a23f922-6a22-4fa2-8b39-7619e24d08f6`
4. **wrangler deploy**: `wrangler.preview.toml` でpreview Workerデプロイ完了、Terraform stateにimport済み。
5. **terraform plan**: 差分ゼロ確認済み。

### プランからの変更点

- `modules/worker-env/providers.tf` を追加（プランに未記載）。モジュール内で `cloudflare/cloudflare` のプロバイダーソースを明示しないと `hashicorp/cloudflare` として解決されエラーになる。
- `wrangler.preview.toml` で `[[containers]]` セクションを削除。Dockerビルドが必要でCI/ローカルでの `wrangler deploy` が失敗するため。Durable Object バインディングと migrations は残している。
- `wrangler.preview.toml` に `migrations_dir = "drizzle/migrations"` を追加。本番tomlには無いが、preview D1のマイグレーション適用に必要。
- Worker Scriptの初回作成はTerraform apply不可（実際のコード内容が必要）。`wrangler deploy` で作成後 `terraform import` で取り込む手順が必要。

### 残作業

- [ ] シークレット手動設定（Step 4参照）
- [ ] Google Cloud Console でリダイレクトURI追加
- [ ] テストPRでGitHub Actionsワークフロー動作確認
- [ ] `preview.healthy-person-emulator.org` のアクセス確認

### スキルに関する提案

特になし。Terraformモジュール化は一度きりの作業のため、スキル化の必要性は低い。
