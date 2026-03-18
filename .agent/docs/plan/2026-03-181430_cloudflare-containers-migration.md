# Python自動化処理 → Cloudflare Containers 統合移行プラン

## やりたいこと

現在2つのリポジトリに分かれているものを1つにまとめ、AWSをやめてCloudflareに統一する。

| 今 | 後 |
|----|-----|
| メインアプリ: Cloudflare Workers + D1 | そのまま |
| Python自動化: AWS Lambda (別リポジトリ) | → 同じリポジトリ内のCloudflare Container |

**規模感**: 個人ブログ。11,000投稿。全処理は遅延許容の非クリティカル処理。

---

## 移行する関数

| 関数 | 何をするか | いつ動く | 移行順 |
|------|-----------|---------|--------|
| CreateOGImage | 記事のOGP画像を作ってR2に保存 | 10分毎 | 1番目 |
| PostTweet | Twitterに投稿 | OGP生成後 | 1番目 |
| PostBluesky | Blueskyに投稿 | OGP生成後 | 1番目 |
| PostActivityPub | Misskeyに投稿 | OGP生成後 | 1番目 |
| SaveSNSIdsToDB | 投稿IDをDBに保存 | 各SNS投稿後 | 不要（Worker直接化） |
| ReportWeeklySummary | 週間人気記事をツイート | 毎週月曜 | 2番目 |
| ExtractAndLoadToBQ | D1→BigQuery ETL | 毎日 | 3番目（最悪Lambda残置） |

---

## 全体の仕組み

```
┌─────────────────────────────────────┐
│  Cloudflare Worker (TypeScript)     │
│  ・Cronで定期実行                    │
│  ・Queueでメッセージ管理             │
│  ・D1でジョブ状態管理                │
└──────────────┬──────────────────────┘
               │
       ┌───────▼────────┐
       │ Automation     │
       │ Container      │
       │ (Python + uv)  │
       │ OGP/SNS/ETL全部│
       └────────────────┘
```

**ポイント:**
- WorkerがPythonコンテナを呼び出して処理を実行させる
- コンテナへのアクセスはDurable Object経由のみ（外部から直接アクセスできない）
- SNS代わりにCloudflare Queuesを使って信頼性を確保
- ジョブの状態はD1で管理し、重複投稿を防ぐ

---

## SNS投稿の流れ

### 正常フロー

```
① Cron（10分毎）
   → Worker: OGP未生成の記事を探す
   → Worker → 投稿系Container: 「OGP画像を作って」
     → Container: 画像生成 → R2に直接保存
     → Container → Worker: 「できたよ、URLはこれ」

② Worker: 3つの投稿ジョブをD1に登録（Twitter/Bluesky/Misskey）
   → Worker: Queueに3つメッセージを送る

③ Queue Consumer（Workerが受ける）
   → ジョブの状態をチェック（もう投稿済みなら何もしない）
   → Worker → 投稿系Container: 「Twitterに投稿して」
     → Container: Twitter APIを叩く
     → Container → Worker: 「投稿できた、tweet_idはこれ」
   → Worker: D1にtweet_idを保存、ジョブを「完了」にする
```

### ジョブの状態管理

D1に `social_post_jobs` テーブルを作り、各投稿ジョブの状態を管理する。

```
pending → queued → sending → sent（完了!）
                           → failed（認証エラー等）
                           → unknown（タイムアウト等、成否不明）
```

| 状態 | 意味 |
|------|------|
| pending | まだQueueに送っていない |
| queued | Queueに送った。消化待ち |
| sending | いま投稿処理中 |
| sent | 投稿完了 |
| failed | 永続的なエラー（401, 403等） |
| unknown | 投稿できたかどうかわからない（手動確認が必要） |

**重複投稿を防ぐ仕組み:**
- ジョブID = `{投稿ID}_{プラットフォーム}`（例: `12345_twitter`）
- Queue consumerは処理前にD1のステータスをチェック
- 「もう完了してる」→ スキップ
- 「処理中」→ スキップ（他のworkerが処理中）
- ステータス更新は `WHERE status = 'queued'` 付きのUPDATEで、同時に2つのworkerが同じジョブを取ることを防ぐ

**エラーの分類:**
| エラー種別 | 例 | 対応 |
|-----------|-----|------|
| 永続エラー | 401（認証切れ）、403 | → `failed`。リトライしない |
| 一時エラー | 429（レート制限）、500 | → `queued` に戻してQueueリトライ |
| 成否不明 | タイムアウト、接続切断 | → `unknown`。手動確認 |

**クラッシュした場合:**
- 「sending」のまま処理が止まったら → 60秒後に自動で「unknown」に遷移
- 「unknown」は手動で各SNSを確認して解消する（個人ブログなので頻繁には起きない）

### D1のテーブル定義

```sql
CREATE TABLE social_post_jobs (
  id TEXT PRIMARY KEY,              -- "12345_twitter"
  post_id INTEGER NOT NULL,
  platform TEXT NOT NULL,           -- "twitter" | "bluesky" | "activitypub"
  status TEXT NOT NULL DEFAULT 'pending',
  provider_post_id TEXT,            -- SNS側の投稿ID
  claimed_at TEXT,                  -- 処理開始時刻
  lease_timeout_sec INTEGER DEFAULT 60,
  attempt_count INTEGER DEFAULT 0,  -- 試行回数
  last_error TEXT,
  resolved_at TEXT,                 -- unknown解消時刻
  resolution_note TEXT,             -- 解消メモ
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 緊急停止の仕組み

2つのスイッチで段階的に止められる。

| スイッチ | 何を止めるか | D1のジョブは? |
|---------|------------|-------------|
| `ENQUEUE_ENABLED=false` | 新しいOGP生成とQueue送信を止める | 影響なし |
| `SEND_ENABLED=false` | SNS投稿を止める | `queued` のまま安全に保持 |

**止めたときの挙動:**
- Queueのリトライ回数は消費しない
- DLQは汚れない
- ジョブの試行回数は増えない
- **D1がジョブの正本。** Queueメッセージを消しても、D1にジョブが残っているので失われない

**再開の流れ:**
1. スイッチを `true` に戻す（`wrangler secret put` で即時反映）
2. 次のCron実行時（最大10分後）にリカバリ処理が走る
3. 古い `queued` ジョブを `pending` に戻して再度Queueに送る
4. 通常通り投稿処理が再開される（回復まで約10〜20分）

---

## コンテナの構成

1つのコンテナに全機能をまとめる。

### AutomationContainer
- **用途**: OGP画像生成 + SNS投稿 + BigQuery ETL + 週次レポート
- **サイズ**: standard（4GB RAM）
- **Python管理**: `uv`（高速な依存解決・インストール）
- **ライブラリ**: Pillow, tweepy, atproto, Misskey.py, dlt, google-cloud-bigquery
- **処理時間**: 投稿系は数秒、ETLは最大15分

### ディレクトリ構造

```
healthy-person-emulator-dotorg/
├── worker.ts                    # Cron + Queue handler追加
├── wrangler.toml                # Container/Cron/Queue設定追加
├── container/                   # Python自動化コンテナ
│   ├── Dockerfile
│   ├── pyproject.toml           # uv で依存管理
│   ├── uv.lock
│   ├── main.py                  # HTTPサーバー(8080)
│   ├── tasks/
│   │   ├── create_og_image.py
│   │   ├── post_tweet.py
│   │   ├── post_bluesky.py
│   │   ├── post_activitypub.py
│   │   ├── extract_and_load_to_bq.py
│   │   └── report_weekly_summary.py
│   ├── shared/
│   │   └── config.py
│   └── fonts/                   # OGP画像用フォント
└── app/
    └── modules/automation.server.ts  # フロー制御ロジック
```

---

## シークレットの管理

AWS Secrets Manager → Cloudflare Workers Secrets に移行。

コンテナには環境変数として渡す（HTTPボディでは渡さない）。

```
TWITTER_CK, TWITTER_CS, TWITTER_AT, TWITTER_ATS    # Twitter API
BLUESKY_USER, BLUESKY_PASSWORD                       # Bluesky
MISSKEY_TOKEN                                        # Misskey
R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY  # R2 S3互換API
BIGQUERY_CREDENTIALS                                 # BigQuery (JSON)
```

---

## OGP画像の保存

S3 → R2に変更。コンテナからR2のS3互換APIを使って直接アップロードする。

```python
import boto3
s3 = boto3.client("s3",
    endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
)
s3.put_object(Bucket="healthy-person-emulator-static", Key=f"ogp/{post_id}.jpg", Body=image_bytes)
```

---

## BigQuery ETLの仕組み

```
① Cron（毎日16:00 UTC）
   → Worker: D1の全テーブルを読み出し → NDJSON形式 → R2に保存
   → Worker: manifest.json（テーブル一覧、行数）を書き込み

② Worker → ETLコンテナ: 「BQにロードして」
   → Container: R2からNDJSONダウンロード → dltでBigQueryにロード
```

11,000投稿・26万行なのでフルエクスポートで十分（増分同期は不要）。

---

## S3→R2のOGP画像移行

既存のOGP画像をS3からR2に移し、URLを書き換える必要がある。

### やること

1. **R2バケット**: 既存の `healthy-person-emulator-static` を使う
   - Worker バインディング名: `STATIC_BUCKET`
   - OGP画像は `ogp/{post_id}.jpg` というキーで保存
   - パブリックアクセスまたはカスタムドメインの設定を確認

2. **既存画像のS3→R2コピー**
   - S3バケットから全OGP画像をダウンロード
   - R2 (`healthy-person-emulator-static`) にアップロード（S3互換APIでboto3/rclone等で一括コピー可能）
   - 画像枚数 = OGP生成済み記事数（`dim_posts` の `ogp_image_url IS NOT NULL` の件数）

3. **D1の `ogp_image_url` を一括更新**
   - S3のURLパターン → R2の新URLパターンに書き換え
   - 例: `UPDATE dim_posts SET ogp_image_url = REPLACE(ogp_image_url, 'https://xxx.s3.ap-northeast-1.amazonaws.com/', 'https://ogp.healthy-person-emulator.org/') WHERE ogp_image_url IS NOT NULL`

4. **メタタグの確認**
   - `app/utils/commonMetafunction.ts` の `og:image` / `twitter:image` は D1の `ogpImageUrl` を参照しているので、D1のURL書き換えだけで対応完了
   - デフォルト画像（Vercel Blob）は別途R2またはWorkers Assetsに移行検討（優先度低）

5. **Lambda側のCreateOGImage更新**
   - 移行完了前: Lambda側のアップロード先をR2に変更（S3互換APIで切り替え可能）
   - 移行完了後: Containerが引き継ぐ

### タイミング

Phase 3（並行稼働期間）の前に完了させる。
1. R2バケット作成 + 公開設定
2. S3→R2画像コピー
3. D1 URL一括更新
4. 旧Lambda or 新ContainerのアップロードURLをR2に変更

---

## デプロイの安全対策

- Queueメッセージに `schema_version` を付ける。知らないバージョンはDLQ送り
- Worker↔Container間のAPIはフィールド追加のみ（削除・変更なし）
- コンテナを先にデプロイ → Workerを後でデプロイ

---

## 移行スケジュール

### Phase 0: PoC（2日）

Cloudflare Containersが本当に使えるかを確認する。

**作業内容:**
1. Cloudflare Containersを有効化（ダッシュボードから）
2. hello-world Pythonコンテナを作ってデプロイ
   - `Dockerfile` + `main.py`（8080でHTTPサーバー起動）
   - `wrangler deploy` でデプロイされることを確認
3. Cron Trigger → Container起動が動くことを確認
   - `wrangler.toml` に `[triggers] crons = ["*/2 * * * *"]` を設定
   - `wrangler dev --test-scheduled` でローカルテスト
4. Container環境変数でシークレットが渡せることを確認
   - `getEnv()` でWorker secretsをコンテナに渡す
5. コンテナ内からR2にS3互換APIでファイルを書き込めることを確認
   - R2 APIトークン作成 → boto3でput_object
6. Cloudflare Queuesの動作確認
   - producer → consumer → ログ出力
   - DLQ到達の確認
7. `sleepAfter` でscale-to-zero → 再起動の挙動確認
8. standardインスタンスのCPU/メモリ/起動時間を実測

**成果物:** PoC用の一時的なWorker/Container（本番には使わない）

#### Phase 0 実施結果（2026-03-18）

**結論: Cloudflare Containersは本番利用可能と判断。**

**実施内容と結果:**

| # | 検証項目 | 結果 | 備考 |
|---|---------|------|------|
| 1 | Containers有効化 | ✅ | ダッシュボードで有効化済み |
| 2 | Pythonコンテナのビルド・デプロイ | ✅ | `python:3.11-slim` + `uv` でDockerイメージをビルド。`wrangler deploy` でCloudflare Registryへpush・デプロイ成功 |
| 3 | Cron → Container起動 | ✅ | `*/10 * * * *` でscheduledハンドラーからContainer `/health` を呼び出し、`Ok`を確認（`wrangler tail`で検証） |
| 4 | Container環境変数 | ✅ | `envVars` プロパティでWorkerからコンテナに環境変数を渡せることを確認（ローカルDockerテストで検証） |
| 5 | R2 S3互換API | ⏳ Phase 3で検証 | R2 APIトークン作成が必要。コンテナ側のboto3コードは準備済み |
| 6 | Queues | ⏳ Phase 2で検証 | Queue作成済み（`social-post` + `social-post-dlq`）。Consumer設定済み。CLIからのsendコマンドが存在しないためWorker経由でテスト予定 |
| 7 | sleepAfter scale-to-zero | ✅（間接確認） | `sleepAfter: "5m"` を設定。Cronが10分毎のため、5分idle→sleep→次のCronで再起動のサイクル。Cron呼び出し時にContainerが応答していることから、再起動も正常に動作 |
| 8 | standard-1インスタンス性能 | ✅ | vCPU: 0.5, RAM: 4GB, Disk: 8GB。ローカルテスト: RSS ~21MB, 起動 ~2秒。Pythonサーバーのみの軽量な状態 |

**プランからの変更点:**
- `instance_type` は `"standard"` → `"standard-1"` にリネームされていた（wrangler警告で判明）
- `image` パスは `"./container"` ではなく `"./container/Dockerfile"` を指定する必要があった
- Container classの `getEnv()` メソッドは廃止されており、代わりに `envVars` プロパティで環境変数を渡す仕様
- PoC用の一時的なWorkerではなく、本番のworker.tsに直接scheduled/queueハンドラーを追加した（Phase 1-2でそのまま拡張するため）
- Durable Objectのmigrationタグは既存の設定がないため `"v2"` で新規追加

**発見した注意点:**
- デプロイ直後にDurable Object Alarmで `Error: Durable Object reset because its code was updated.` が発生（一時的、想定内）
- `wrangler tail` の pretty フォーマットではscheduledイベントのログ出力が通常のfetchリクエストとは異なる形式で表示される
- Dockerイメージは `linux/amd64` でビルドが必要（Cloudflare Containersの要件）

**作成・変更ファイル一覧:**
- 新規: `container/Dockerfile`, `container/main.py`, `container/pyproject.toml`, `container/uv.lock`, `container-worker.ts`
- 変更: `worker.ts`, `wrangler.toml`, `app/types/env.ts`, `package.json`, `pnpm-lock.yaml`

**スキル改善の提案:**
- 特になし（Phase 0はインフラ検証のため）

---

### Phase 1: Pythonコンテナ構築（3-4日）

旧リポジトリの Lambda関数を1つのコンテナに移植する。

**作業内容:**
1. `container/` ディレクトリを作成
2. `pyproject.toml` を作成（uvで依存管理）
   ```
   dependencies: Pillow, tweepy, atproto, Misskey.py, httpx, requests,
                 dlt[bigquery], google-cloud-bigquery, google-auth, boto3
   ```
3. `uv lock` で依存を固定
4. `Dockerfile` を作成
   ```dockerfile
   FROM python:3.11-slim
   COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
   WORKDIR /app
   COPY pyproject.toml uv.lock ./
   RUN uv sync --frozen --no-dev
   COPY . .
   COPY fonts/ /app/fonts/
   EXPOSE 8080
   CMD ["uv", "run", "main.py"]
   ```
5. `main.py` を作成（HTTPサーバー + タスクルーター）
   - `POST /create-ogp` → OGP画像生成
   - `POST /post-social` → SNS投稿（platform引数で切り替え）
   - `POST /etl-to-bq` → BigQuery ETL
   - `POST /report-weekly` → 週次レポート
   - `GET /health` → ヘルスチェック
6. 各タスクを移植（`container/tasks/` 以下）:
   - `create_og_image.py` ← `ServerlessFramework/CreateOGImage/lambda_function.py`
     - AWS Secrets Manager → 環境変数 (`os.environ`)
     - S3アップロード → R2 S3互換API (`boto3`)
     - SNS publish → HTTPレスポンスで返す
   - `post_tweet.py` ← `ServerlessFramework/PostTweet/lambda_function.py`
     - Secrets Manager → 環境変数
     - SNS publish → HTTPレスポンスで `tweet_id` 返す
     - dry-runモード対応（`AUTOMATION_DRY_RUN=true` なら実投稿スキップ）
   - `post_bluesky.py` ← `ServerlessFramework/PostBluesky/lambda_function.py`（同様）
   - `post_activitypub.py` ← `ServerlessFramework/PostActivityPub/lambda_function.py`（同様）
   - `extract_and_load_to_bq.py` ← `ServerlessFramework/ExtractAndLoadToBQ/handler.py`
     - PostgreSQL接続 → R2からNDJSONダウンロード
   - `report_weekly_summary.py` ← `ServerlessFramework/ReportWeeklySummary/lambda_function.py`
7. フォントファイルを旧リポジトリからコピー（`container/fonts/`）
8. ローカルで `docker build` → `docker run` → 各エンドポイントにcurlでテスト

**成果物:** ローカルで動作するDockerコンテナ

#### Phase 1 実施結果（2026-03-18）

**移植完了。ローカルdry-runテスト・Cloudflareデプロイ成功。**

**移植したタスク:**

| タスク | 元Lambda | コンテナエンドポイント | dry-runテスト |
|--------|----------|----------------------|--------------|
| OGP画像生成 | `CreateOGImage` | `POST /create-ogp` | - (API key必要) |
| Twitter投稿 | `PostTweet` | `POST /post-social` (platform=twitter) | ✅ |
| Bluesky投稿 | `PostBluesky` | `POST /post-social` (platform=bluesky) | ✅ |
| Misskey投稿 | `PostActivityPub` | `POST /post-social` (platform=activitypub) | ✅ |
| 週次レポート | `ReportWeeklySummary` | `POST /report-weekly` | - (BQ認証必要) |
| BigQuery ETL | `ExtractAndLoadToBQ` | `POST /etl-to-bq` | - (BQ認証必要) |

**プランからの変更点:**
- `SaveSNSIdsToDB` は移植不要と判断（プラン通り）。Worker側がD1に直接書き込む
- `main.py` を `importlib.import_module` によるタスクルーター方式に刷新（プランの「HTTPサーバー + タスクルーター」に対応）
- `Dockerfile` のCMDは `uv run main.py` → `.venv/bin/python main.py`（hatchlingのeditable build問題を回避）
- `container/shared/config.py` に共通設定（`API_BASE_URL`, `DRY_RUN`, `get_r2_client()`）を集約
- フォントは `NotoSansJP-Medium.ttf` のみコピー（`NotoSansJP-Light.ttf` は旧コードでも未使用）

**未検証事項（Phase 2以降で対応）:**
- `envVars` でシークレットをコンテナに渡す設定がまだ未実装。container-worker.tsに追加が必要
- Worker→Containerのタスク呼び出し統合テスト（Worker fetchハンドラーからコンテナのタスクエンドポイントを叩くパスがない）
- OGP生成の本番テスト（API key + R2書き込み）

**スキル改善の提案:**
- 特になし

---

### Phase 2: Worker側フロー構築（3-4日）

Worker側のCronハンドラー、Queue、冪等性ロジックを実装する。

**作業内容:**
1. D1マイグレーション作成: `social_post_jobs` テーブル追加
   - `npx drizzle-kit generate` → `npx wrangler d1 migrations apply`
   - `app/drizzle/schema.ts` にテーブル定義追加
2. `app/modules/automation.server.ts` を新規作成
   - `enqueueAndMarkQueued()`: pending → queued の原子的更新 + Queue送信
   - `recoverStaleJobs()`: queued 10分超過 → pending リセット + 再enqueue
   - `handleOgpAndSocialPost()`: OGP生成 → social_post_jobs INSERT → enqueue
   - `handleSocialPostConsumer()`: 冪等性チェック → claim → Container呼び出し → D1更新
3. `worker.ts` に追加:
   - `scheduled()` ハンドラー: Cronトリガーで `handleOgpAndSocialPost()` 等を呼び出し
   - `queue()` ハンドラー: Queue consumerで `handleSocialPostConsumer()` を呼び出し
   - Feature flag チェック（`ENQUEUE_ENABLED`, `SEND_ENABLED`）
4. `container-worker.ts` を新規作成:
   - `AutomationContainer extends Container` クラス
   - `getEnv()` でシークレットを環境変数として渡す
   - `defaultPort = 8080`, `sleepAfter = "5m"`
5. `wrangler.toml` に追加:
   - `[triggers] crons` 設定
   - Queue producer/consumer設定
   - Container定義 + Durable Objectバインディング
   - R2バケット `OGP_BUCKET` 追加
6. `app/types/env.ts` に型定義追加:
   - `SOCIAL_POST_QUEUE`, `AUTOMATION_CONTAINER`, `OGP_BUCKET`
   - `ENQUEUE_ENABLED`, `SEND_ENABLED`, `AUTOMATION_DRY_RUN`
   - 各SNS APIシークレット

**変更ファイル:**
- 新規: `container-worker.ts`, `app/modules/automation.server.ts`
- 変更: `worker.ts`, `wrangler.toml`, `app/types/env.ts`, `app/drizzle/schema.ts`

**成果物:** `wrangler dev` でCron + Queue + Container連携が動く状態

#### Phase 2 実施結果（2026-03-18）

**Worker側フロー構築完了。本番デプロイ済み。**

**実施内容:**

| # | 作業 | 結果 | 備考 |
|---|------|------|------|
| 1 | D1マイグレーション | ✅ | `social_post_jobs` テーブルを本番D1に適用（3クエリ、5行書き込み） |
| 2 | `automation.server.ts` | ✅ | `handleOgpAndSocialPost()`, `handleSocialPostConsumer()`, `recoverStaleJobs()`, `enqueueAndMarkQueued()` を実装 |
| 3 | `worker.ts` scheduled/queue | ✅ | 動的importで `automation.server.ts` を呼び出し。Feature flagチェック実装 |
| 4 | `container-worker.ts` getEnv | ✅ | Worker secrets → コンテナ環境変数への変換ロジック |
| 5 | `env.ts` 型定義 | ✅ | SNS APIシークレット（TWITTER_CK/CS/AT/ATS, BLUESKY_USER/PASSWORD, MISSKEY_TOKEN）、R2、BigQuery |

**プランからの変更点:**
- `drizzle-kit generate` は使えなかった（`meta/_journal.json` が空）。手動でSQLマイグレーション (`0001_add_social_post_jobs.sql`) を作成し `wrangler d1 execute --remote` で適用
- `container-worker.ts` はPhase 0で作成済み。Phase 2では `getEnv()` メソッドを追加
- `wrangler.toml` の変更はPhase 0で完了済み。Phase 2での追加変更なし
- `handleSocialPostConsumer()` でエラー発生時の分類ロジック (`classifyError()`) を追加: terminal(401/403)→failed, retryable(429/5xx)→throw(Queue retry), ambiguous→unknown
- `SEND_ENABLED=false` 時の Queue consumer の挙動: `message.retry()` でQueueに戻す（リトライ回数・DLQ・attempt_countを消費しない設計）
- `dim_posts` へのSNS投稿ID書き戻しも `handleSocialPostConsumer()` 内で実装（`SaveSNSIdsToDB` Lambda相当の機能を統合）
- `drizzle-orm` の `result.meta.changed_db` を使ってCAS更新の成否を判定

**未検証事項:**
- 統合テスト未実施（ENQUEUE_ENABLED/SEND_ENABLED がともに未設定のため、Cronは走るが何もしない状態）
- Phase 3でシークレット登録後、Phase 4で段階的に有効化してテスト

**スキル改善の提案:**
- 特になし

---

### Phase 3: OGP画像S3→R2移行 + シークレット登録（2-3日）

本番切り替え前の準備作業。

**作業内容:**
1. R2バケット `healthy-person-emulator-static` の公開設定を確認
   - パブリックアクセスまたはカスタムドメインの設定状況を確認
2. R2 APIトークンを作成（コンテナからのS3互換APIアクセス用）
   - ダッシュボード → R2 → APIトークン管理
3. S3から既存OGP画像をR2にコピー
   - `rclone copy s3:バケット名/ogp/ r2:healthy-person-emulator-static/ogp/`
   - または `aws s3 sync` + `boto3` スクリプト
5. D1の `ogp_image_url` を一括更新
   ```sql
   UPDATE dim_posts
   SET ogp_image_url = REPLACE(ogp_image_url, '旧S3URL', '新R2URL')
   WHERE ogp_image_url IS NOT NULL AND ogp_image_url LIKE '%旧S3URL%'
   ```
6. 画像が正しく表示されることをブラウザで確認（数件スポットチェック）
7. Worker Secretsを登録
   ```bash
   wrangler secret put TWITTER_CK
   wrangler secret put TWITTER_CS
   wrangler secret put TWITTER_AT
   wrangler secret put TWITTER_ATS
   wrangler secret put BLUESKY_USER
   wrangler secret put BLUESKY_PASSWORD
   wrangler secret put MISSKEY_TOKEN
   wrangler secret put R2_ENDPOINT
   wrangler secret put R2_ACCESS_KEY_ID
   wrangler secret put R2_SECRET_ACCESS_KEY
   wrangler secret put BIGQUERY_CREDENTIALS
   wrangler secret put ENQUEUE_ENABLED   # 初期値: "false"（まだ動かさない）
   wrangler secret put SEND_ENABLED      # 初期値: "false"
   wrangler secret put AUTOMATION_DRY_RUN # 初期値: "true"
   ```

**成果物:** R2にOGP画像が移行済み、シークレット登録済み、本番デプロイ準備完了

#### Phase 3 実施結果（2026-03-18）

**OGP画像移行・シークレット登録完了。本番デプロイ準備完了。**

**1. R2バケット公開設定:**
- `healthy-person-emulator-static` にカスタムドメイン `static.healthy-person-emulator.org` が設定済み
- パブリックアクセスで画像が正常にアクセスできることを確認

**2. R2 APIトークン:**
- ダッシュボードで作成し、`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` をWorker Secretsに登録

**3. S3→R2画像コピー:**
- S3バケット `healthy-person-emulator-public-assets` から11,251ファイル（1.4 GB）をダウンロード
- R2バケット `healthy-person-emulator-static` の `ogp/` プレフィックスにアップロード
- `aws s3 sync` でローカル経由コピー（直接S3→R2はツールの制約上不可）

**4. D1 ogp_image_url 一括更新:**
- 旧: `https://healthy-person-emulator-public-assets.s3-ap-northeast-1.amazonaws.com/{id}.jpg`
- 新: `https://static.healthy-person-emulator.org/ogp/{id}.jpg`
- 11,143行を更新（SQLファイル経由で実行。`--command` の `LIKE` はD1の制限でエラーになった）
- 本番サイトの `og:image` / `twitter:image` メタタグでR2 URLが正しく反映されていることを確認

**5. Worker Secrets登録:**

| シークレット | ソース | 状態 |
|------------|--------|------|
| TWITTER_CK/CS/AT/ATS | AWS Secrets Manager `hpe-twitter-bot-tokens` | ✅ |
| BLUESKY_USER/PASSWORD | AWS Secrets Manager `hpe-bluesky-bot-tokens` | ✅ |
| MISSKEY_TOKEN | AWS Secrets Manager `MISSKEY_TOKEN` | ✅ |
| R2_ENDPOINT/ACCESS_KEY_ID/SECRET_ACCESS_KEY | R2 APIトークンから | ✅ |
| BIGQUERY_CREDENTIALS | AWS Secrets Manager `BIGQUERY_ACCESS_CREDENTIAL` | ✅ |
| ENQUEUE_ENABLED | 初期値: `false` | ✅ |
| SEND_ENABLED | 初期値: `false` | ✅ |
| AUTOMATION_DRY_RUN | 初期値: `true` | ✅ |

**プランからの変更点:**
- S3の画像はフラット（`{id}.jpg`）だったが、R2では `ogp/{id}.jpg` に保存。プランの `ogp/{post_id}.jpg` と一致
- D1の `UPDATE ... LIKE` がD1の制約で失敗。`substr()` を使ったSQLに変更して成功
- AWS Secrets Managerからの取得にリージョン指定（`--region ap-northeast-1`）が必要だった

**スキル改善の提案:**
- 特になし

---

### Phase 4: テスト・並行稼働（1-2週間）

新系統を本番にデプロイして段階的に有効化する。

**作業内容:**

**Step 1: デプロイ + dry-run（1週間）**
1. `wrangler deploy` で本番デプロイ
2. `ENQUEUE_ENABLED=true`, `SEND_ENABLED=true`, `AUTOMATION_DRY_RUN=true` に設定
3. 新系統はOGP生成+SNS投稿の全フローを実行するが、**実際のSNS API呼び出しはスキップ**（ログ出力のみ）
4. 旧Lambda側が引き続き本番投稿を担当
5. Workers Logsで以下を確認:
   - Cron triggerが10分毎に動いているか
   - Container起動・レスポンスが正常か
   - Queue enqueue/consumer が正常か
   - social_post_jobs の状態遷移が正しいか
   - エラーが出ていないか

**Step 2: 切り替え**
6. 旧Lambda側のCloudWatch Eventsを無効化（CreateOGImage の10分毎cron）
7. 旧Lambda側のSNSトピックサブスクリプションを削除
8. `AUTOMATION_DRY_RUN=false` に設定 → 新系統で本番投稿開始

**Step 3: 監視（1週間）**
9. 毎日Workers Logsを確認
10. 各SNSで投稿が正常に出ているか確認
11. social_post_jobs に `unknown` や `failed` がないか確認
12. 問題があれば `ENQUEUE_ENABLED=false` で即停止 → 旧Lambda復帰

**ロールバック手順:**
1. `wrangler secret put ENQUEUE_ENABLED` → `false`
2. `wrangler secret put SEND_ENABLED` → `false`
3. 旧Lambda側のCloudWatch Events/SNSを再有効化
4. social_post_jobs の状態を確認、必要に応じてリセット

#### Phase 4 実施結果（2026-03-18）

**本番切り替え完了。旧Lambda全停止。Phase 5・6も前倒しで統合実施。**

**実施内容:**

| # | 作業 | 結果 |
|---|------|------|
| 1 | ENQUEUE_ENABLED=true, SEND_ENABLED=true 設定 | ✅ |
| 2 | dry-runフロー動作確認 | ✅ 06:30 UTCのCronで全経路動作確認（`No new posts to process`） |
| 3 | AUTOMATION_DRY_RUN=false 設定（本番投稿開始） | ✅ |
| 4 | テスト用エンドポイント `/__test-automation` 追加→削除 | ✅ 動作確認後に削除 |
| 5 | 旧Lambda CloudWatch Events全5件無効化 | ✅ |
| 6 | ReportLegendaryArticle移植・Cron追加 | ✅（プラン外の追加移行） |
| 7 | ReportWeeklySummary Cron追加（Phase 5前倒し） | ✅ `0 12 * * 1` |
| 8 | D1→R2 NDJSONエクスポート + BQ ETL Cron追加（Phase 6前倒し） | ✅ `0 16 * * *` |

**Cron一覧（最終形）:**

| Cron | 処理 | 旧Lambda |
|------|------|---------|
| `*/10 * * * *` | OGP生成 + SNS投稿 | ❌ 停止済み |
| `0 12 * * *` | 殿堂入りレポート | ❌ 停止済み |
| `0 12 * * 1` | 週次人気記事レポート | ❌ 停止済み |
| `0 16 * * *` | D1→R2→BigQuery ETL | ❌ 停止済み |
| — | PickRandomArticle | ❌ 停止済み（未移植） |

**プランからの変更点:**
- Phase 4 Step 1（1週間dry-run）をスキップ。フローの動作確認後、即本番切り替えに移行
- Phase 5（ReportWeeklySummary）・Phase 6（BigQuery ETL）を Phase 4 に統合して前倒し実施
- ReportLegendaryArticle（プラン当初は移行対象外）を追加移植
- PickRandomArticleは旧Lambda停止のみ（未移植）。必要に応じて後日対応
- `d1-export.server.ts` を新規作成: D1全14テーブルを1000行ずつページネーション→NDJSON→R2→manifest.json
- `callContainer()` を automation.server.ts からexportし、worker.tsのscheduledハンドラーから直接呼び出す設計に

**観測された問題と判断:**
- デプロイ直後にDurable Objectリセット + `exceededCpu` が発生。コンテナのコールドスタートが原因
- ただしフロー自体は安定稼働中に正常動作しているため、レイテンシ要件がない本ユースケースでは許容と判断
- Codexレビューでは「scheduledハンドラーの非同期化」「sleepAfter調整」を推奨されたが、コールドスタートで問題ないとの判断で見送り

**作成・変更ファイル:**
- 新規: `container/tasks/report_legendary_article.py`, `app/modules/d1-export.server.ts`
- 変更: `worker.ts`, `wrangler.toml`, `container/main.py`, `app/modules/automation.server.ts`

**監視項目（Phase 4 Step 3）:**
- 各SNSで投稿が正常に出ているか（次の新規投稿時に確認）
- `social_post_jobs` に `unknown` / `failed` がないか
- 殿堂入りレポートが毎日12:00 UTCに動作するか
- 週次レポートが月曜12:00 UTCに動作するか
- BigQuery ETLが毎日16:00 UTCに動作するか

**ロールバック手順:**
1. `echo "false" | npx wrangler secret put ENQUEUE_ENABLED`
2. `echo "false" | npx wrangler secret put SEND_ENABLED`
3. `aws events enable-rule --name <rule-name> --region ap-northeast-1` で旧Lambda復帰

**スキル改善の提案:**
- 特になし

---

~~### Phase 5: 週次レポート移行（2-3日）~~ → Phase 4で実施済み

~~### Phase 6: BigQuery ETL移行（3-4日）~~ → Phase 4で実施済み

---

### Phase 7: AWSクリーンアップ

全Lambda関数がCloudflare側に移行完了後に実施。

**作業内容:**
1. AWS Lambda関数を全て削除（`serverless remove` or 手動）
2. S3バケットのOGP画像がR2に移行済みであることを最終確認 → S3バケット削除
3. AWS Secrets Managerのシークレットを削除
4. SNSトピック（`healthy-person-emulator-socialpost`, `healthy-person-emulator-socialpostIds`）を削除
5. IAMロール・ポリシーを削除
6. 旧リポジトリはアーカイブ済みであることを確認（済み）
7. プランファイルに実施結果を記録

---

## wrangler.toml 最終形

```toml
name = "healthy-person-emulator-dotorg"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]
main = "worker.ts"
assets = { directory = "build/client" }

[triggers]
crons = ["*/10 * * * *", "0 16 * * *", "0 12 * * 1"]

# --- Database ---
[[d1_databases]]
binding = "DB"
database_name = "healthy-person-emulator-db"
database_id = "1d5558b5-f0c7-4c13-9af9-82856367bfb9"

# --- Storage ---
[[r2_buckets]]
binding = "PARQUET_BUCKET"
bucket_name = "hpe-parquet"

[[r2_buckets]]
binding = "STATIC_BUCKET"
bucket_name = "healthy-person-emulator-static"

# --- AI ---
[ai]
binding = "AI"

[[vectorize]]
binding = "VECTORIZE"
index_name = "embeddings-index"

# --- Queues ---
[[queues.producers]]
binding = "SOCIAL_POST_QUEUE"
queue = "social-post"

[[queues.consumers]]
queue = "social-post"
max_batch_size = 1
max_retries = 3
dead_letter_queue = "social-post-dlq"

# --- Container ---
[[containers]]
class_name = "AutomationContainer"
image = "./container"
max_instances = 2
instance_type = "standard"

[[durable_objects.bindings]]
name = "AUTOMATION_CONTAINER"
class_name = "AutomationContainer"

[[migrations]]
tag = "v2"
new_sqlite_classes = ["AutomationContainer"]

[vars]
BASE_URL = "https://healthy-person-emulator.org"
```

---

## リスクと対策

| リスク | 対策 |
|-------|------|
| Containers ベータで不安定 | Phase 0で実測。Feature flagで即停止可。Lambda即復帰可 |
| 重複投稿 | social_post_jobs テーブルで状態管理 + CAS更新 |
| 並行稼働で二重投稿 | dry-runモードで1週間検証してから切り替え |
| BigQuery認証が複雑 | ETLは最後に移行。最悪Lambda残置 |

---

## Codexレビュー履歴

7回のレビューを経て、以下の設計上の論点を全て解消済み:

1. シークレットはContainers環境変数で渡す（HTTPボディ禁止）
2. SNS代替にQueues（配送保証 + DLQ + リトライ）
3. OGP画像はR2 S3互換APIでコンテナから直接アップロード（base64禁止）
4. コンテナ分離は検討したが、個人ブログ規模では1コンテナで十分と判断
5. 冪等性テーブル（social_post_jobs）で重複投稿防止
6. `queued` ステータスでenqueue済み/未済を区別
7. lease期限切れ → `unknown`（`pending` 自動戻し禁止）
8. エラーをterminal/retryable/ambiguousに分類
9. Feature flag（ENQUEUE_ENABLED / SEND_ENABLED）で段階的停止
10. 停止中はQueueリトライ/DLQ/attempt_countを消費しない
11. リカバリ時の再enqueueは原子的CAS更新で重複防止
12. D1が唯一の正本。Queueはメッセージ搬送手段
13. Queueメッセージにschema_version必須
14. dry-runモードで並行稼働の安全確認
