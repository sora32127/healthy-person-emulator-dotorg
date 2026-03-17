# Cloud Run + Supabase → Cloudflare Workers + D1 移行プラン

## Context

コスト削減を目的として、現在の Cloud Run + Supabase PostgreSQL スタックを Cloudflare Workers + D1 に移行する。他の選択肢は検討済みで、このスタックが最安。

### 現在のアーキテクチャ
- **Web App**: React Router v7 + Prisma ORM → Cloud Run (Node.js 22, Docker)
- **DB**: Supabase PostgreSQL（13テーブル、~11,222投稿）
- **Storage**: GCS（Parquetファイル、クライアントサイドDuckDB検索用）
- **Embedding**: Cloudflare Workers AI + Vectorize（移行済み）
- **Auth**: Google OAuth via remix-auth、Cookie sessions
- **CAPTCHA**: Cloudflare Turnstile
- **Moderation**: Google Generative AI

### 外部依存：投稿自動化プログラム（別リポジトリ）
- リポジトリ: https://github.com/sora32127/healthy-person-emulator
- AWS Lambda上で動作、Supabase PostgreSQLに直接接続
- 機能: OG画像生成、SNS投稿（Twitter/Bluesky/Misskey）、BigQuery ETL
- **影響**: DB接続先がD1に変わるため、自動化プログラム側も対応が必要（Phase 4で対処）

---

## Phase 0: D1適合性PoC（Go/No-Go判定）

**目的**: D1に移行可能かを3つの観点で検証し、不合格なら計画を中止する。

### 0.1 行サイズ検証
- PostgreSQLから`dim_posts.postContent`と`fct_post_edit_history`の最大行サイズを計測
- D1の2MB制限に収まるか確認（Free/Paid共通で2MB）
- テキスト記事なら通常2MB以内だが、`fct_post_edit_history`（編集前後全文を1行に保持）は要注意
- **不合格時の対応**: 大きいコンテンツをR2に退避しD1にはポインタのみ保存する設計に切替（コスト増を再評価）

### 0.2 クエリ性能検証
- ローカルD1（`wrangler d1 execute --local`）にサンプルデータを投入
- `getFeedPosts`相当の動的ORDER BY + OFFSET/LIMIT
- `getCommentsByPostId`相当のGROUP BY集計
- `getTagsCounts`相当のJOIN + COUNT
- **不合格基準**: Cloud Run + PostgreSQLの応答時間の3倍以上遅い場合

### 0.3 Workers互換性検証
- `@react-router/cloudflare`でminimal Workers app起動確認
- `createCookieSessionStorage`のrequest-scoped初期化パターン検証
- Google OAuth（remix-auth-oauth2）のWorkers上での動作確認
- `node-html-markdown`のWorkers互換性確認
- **不合格時**: 代替ライブラリの特定、または計画見直し

### 成果物・結果

**Go/No-Go判定: Go 🟢**（2026-03-17実施）

| 検証項目 | 結果 | 詳細 |
|---|---|---|
| 行サイズ | ✅ 合格 | 最大行~13KB（上限2MBの0.6%）。全テーブル余裕あり |
| クエリ性能 | ✅ 合格 | ほぼ全クエリ0.01〜0.7ms。`getTagsCounts`のみ~7ms（キャッシュ推奨） |
| Workers互換性 | ✅ 合格 | 全ライブラリWorkers互換。`@react-router/cloudflare`公式サポート済み |

- スクリプト: `scripts/poc-row-size-check.ts`, `scripts/poc-d1-query-perf.ts`

---

## Phase 1: Repository層導入（Cloud Run上、本番影響なし）

**目的**: DB操作をアプリ本体から隔離し、Prisma/Drizzle実装を差し替え可能にする。

### 1.1 Repository インターフェース定義

`app/repositories/types.ts` に全DB関数の型定義を抽出:
```typescript
export interface PostRepository {
  getPostDataForSitemap(): Promise<{ postId: number }[]>;
  getPostByPostId(postId: number): Promise<PostWithTags | null>;
  createPostWithTags(data: CreatePostInput): Promise<number>;
  // ... 全関数の型定義
}
```

### 1.2 Prisma実装の分離

`app/repositories/prisma.server.ts` — 既存の`db.server.ts`のロジックをRepositoryインターフェースに適合させる。**ロジック変更なし、型の適合のみ。**

### 1.3 `db.server.ts`をfacadeに変更

```typescript
import { getPrismaRepository } from './repositories/prisma.server';
const repo = getPrismaRepository();
export const getPostDataForSitemap = repo.getPostDataForSitemap;
// ... 全関数をre-export
```

これにより、全ルートのimportを変更せずに実装を切り替え可能になる。

### 1.4 テスト: 既存テスト全パス確認
- `pnpm test` で全テストパス
- ステージング環境で主要ページの動作確認

### ロールバック: `db.server.ts`を元に戻す

### Phase 1 実施結果（2026-03-17）
- ✅ `app/repositories/types.ts` (239行) — DatabaseRepositoryインターフェース + 全型定義
- ✅ `app/repositories/prisma.server.ts` (1,326行) — 既存Prismaロジック移動
- ✅ `app/modules/db.server.ts` (171行) — facade化
- ✅ ビルド・テスト全パス

---

## Phase 2: Drizzle/D1実装（Cloud Run上で並行開発）

### 2.1 Cloudflareリソース作成
```bash
wrangler d1 create healthy-person-emulator-db
wrangler r2 bucket create hpe-parquet
```

### 2.2 Drizzleスキーマ定義（`app/drizzle/schema.ts`）

13テーブルをDrizzle SQLiteスキーマとして定義。

**型マッピング（精査済み）**:
| PostgreSQL | SQLite (D1) | 変換責務 | 注意点 |
|---|---|---|---|
| `UUID` / `@db.Uuid` | `text` | アプリ層 `crypto.randomUUID()` | 既存UUID値はそのまま移行。ユニーク制約維持 |
| `TIMESTAMPTZ(6)` | `text` | Repository層で`Date↔string`変換を一元化 | JST/UTCの二重保持パターンは維持 |
| `Decimal`（`postId`用） | `integer` | データ移行時にキャスト | 値域確認済みの上で変換 |
| `String[]` | 正規化テーブル or `text`(JSON) | **要精査**: 現在`String[]`を検索条件に使っているか確認 | `suggestionResult`は表示のみなのでJSON可 |
| `Unsupported("vector")` | 削除 | — | Vectorize移行済み |
| `@default(dbgenerated(...))` | Repository層でアプリ生成 | `nowUTC()`, `nowJST()`ヘルパー | テスト時のモック容易性向上 |

**外部キー・CASCADE**: Drizzle SQLiteでも`references(() => dimPosts.postId, { onDelete: 'cascade' })`で再現可能。

**複合主キー**: `primaryKey({ columns: [table.postId, table.tagId] })`で対応。

### 2.3 D1実装（`app/repositories/d1.server.ts`）

Repository インターフェースのD1/Drizzle実装。関数ごとの移行戦略:

**トランザクション戦略（精査）**:
- `createPostWithTags`: INSERT post → upsert tags → INSERT rel_post_tags を`db.batch()`で原子実行。batch内の各statementは前のstatementの結果を参照できないため、**postIdの取得を先にbatch外で行い**、残りをbatchに入れる
- `recordPostVote`: `db.batch([insertVoteHistory, updatePostCountLikes])` — 2文で原子実行可能
- `updatePostWithTagsAndHistory`: read-then-writeが必要。**Drizzle D1のinteractive transaction (`db.transaction()`)を使用**。D1はWAL modeのため読み取り一貫性あり

**`$queryRaw`の書き換え**:
- `getFeedPosts`: Drizzleの`sql`テンプレートで動的ORDER BY。インデックス設計: `(countLikes)`, `(postDateGmt)`
- `getFeedComments`: 同様にDrizzle `sql`テンプレート化

### 2.4 マイグレーション・データ移行

#### スキーマ適用
```bash
npx drizzle-kit generate
wrangler d1 migrations apply healthy-person-emulator-db
```

#### データ移行スクリプト (`scripts/migrate-pg-to-d1.ts`)
- **冪等性**: 各テーブルにupsert（`INSERT ... ON CONFLICT DO UPDATE`）でリトライ可能
- **再開可能**: テーブル単位で進捗記録、途中再開対応
- **検証**: テーブルごとに件数照合 + ランダムサンプル10件のハッシュ比較
- **バッチサイズ**: 500行ずつ（D1のHTTP APIリミット考慮）
- **変換処理**: Date→ISO文字列、Decimal→integer、String[]→JSON、vector列スキップ

#### Parquetファイル移行
```bash
# GCS→R2コピー（rcloneまたはカスタムスクリプト）
rclone copy gcs:hpe-temp r2:hpe-parquet --include "*.parquet"
```

### 2.5 Cloud Run上でD1実装を検証

`db.server.ts`のfacadeを環境変数で切り替え:
```typescript
const repo = process.env.USE_D1 === 'true'
  ? getD1Repository(d1HttpClient) // D1 HTTP API経由（Cloud Runから）
  : getPrismaRepository();
```

**注意**: Cloud RunからD1へはHTTP API経由でアクセス（ネイティブバインディングはWorkers上のみ）。性能はHTTPオーバーヘッドがあるためステージングでの検証用途に限定。

### ロールバック: `USE_D1=false`で即座にPrisma実装に切り戻し

### Phase 2 実施結果（2026-03-17）
- ✅ `app/drizzle/schema.ts` (248行) — 全13テーブルのDrizzle SQLiteスキーマ
- ✅ `app/drizzle/utils.ts` (10行) — nowUTC/nowJSTヘルパー
- ✅ `app/repositories/d1.server.ts` (1,300行) — D1/Drizzle実装（全39関数）
- ✅ `scripts/migrate-pg-to-d1.ts` — データ移行スクリプト
- ✅ D1データベース作成: `healthy-person-emulator-db` (APAC, ID: `1d5558b5-f0c7-4c13-9af9-82856367bfb9`)
- ✅ スキーマ適用: Drizzle migration → D1に13テーブル作成
- ✅ データ移行完了: 全11テーブル、260,601行、79.45MB
  - dim_posts: 11,229行 / rel_post_tags: 42,428行 / dim_comments: 25,574行
  - fct_post_vote_history: 61,742行 / fct_comment_vote_history: 116,051行
  - その他: dim_tags(1,024), dim_users(505), fct_post_edit_history(450), etc.
  - AI completion系2テーブルはDBに存在しないためスキップ
- ✅ ビルド・テスト全パス
- ✅ `drizzle-orm`, `drizzle-kit`, `@cloudflare/workers-types` を依存に追加
- ⏭️ Parquetファイル移行（GCS→R2）はスコープ外（R2リソースは作成済み）
- ⏭️ Cloud Run上でのD1検証（2.5）はPhase 3以降で実施
- ⚠️ 移行時点のスナップショット。移行〜切替の間にPostgreSQL側で変更が発生する前提

---

## Phase 3: テスト・データ検証

### 3.1 自動テスト
- **スナップショットテスト**: 主要関数（`getPostByPostId`, `getFeedPosts`, `getCommentsByPostId`等）のPrisma実装とD1実装で同一入力に対する出力をdiff
- **E2Eテスト**: 主要ユーザーフロー（投稿作成→閲覧→検索→ブックマーク→OAuth）の手動検証チェックリスト
- **性能回帰テスト**: 主要ページのレスポンスタイム計測（PostgreSQL vs D1 HTTP API経由）

### 3.2 データ整合性検証
- 全13テーブルの行数一致確認
- ランダムサンプル100件/テーブルのフィールド値一致確認
- 外部キー参照整合性チェック

### 3.3 既存Vitest
- `pnpm test` で全テストパス（Repository層経由で両実装テスト）

---

## Phase 4: 外部依存の切り離し

**Phase 3完了後、Workers移行前に実施。**

### 4.1 自動化プログラム向けAPI endpoint追加

Webアプリに内部APIを追加し、自動化プログラムのDB直接接続を排除:
- `POST /api/internal/update-social-ids` — SNS投稿ID書き戻し
- `GET /api/internal/posts-for-pickup` — SNS配信対象記事取得
- `GET /api/internal/posts-for-export` — BigQuery ETL用全件取得

認証: Cloudflare Access（service token）またはAPIキー

### 4.2 自動化プログラム側の修正方針
- Supabase直接接続 → 上記API endpointへの切り替え
- これにより、DB実装がPostgreSQLでもD1でも自動化プログラムは影響を受けない
- **この修正は本プラン外（別リポジトリ）だが、Phase 5の前提条件**

### 4.3 BigQuery ETL
- `dlt`パイプラインのソースをPostgreSQL → 内部APIまたはD1 HTTP APIに変更
- **または**: D1からのデータエクスポートをWorkers Cronで実行し、R2経由でBigQueryにロード

---

## Phase 5: Workers ランタイム移行

**Phase 4完了（自動化プログラムのDB直接接続排除）後に実施。**

### 5.1 `entry.server.tsx` 書き換え
- `PassThrough`（node:stream）→ `renderToReadableStream`（Web Streams API）
- `@react-router/node` → `@react-router/cloudflare`

### 5.2 ビルド設定更新
- `vite.config.ts`: `cloudflareDevProxy()` プラグイン追加
- `react-router.config.ts`: Workers向け設定

### 5.3 `process.env` → Workers envバインディング

全サーバーモジュールをrequest-scoped env対応に変更。

**変更対象と方針**:
| ファイル | 変更内容 |
|---|---|
| `session.server.ts` | ファクトリパターン `createSessionStorage(env)` |
| `auth.google.server.ts` | 遅延初期化 `getAuthenticator(env)` — **モジュール初期化時のenv読み込みを排除** |
| `security.server.ts` | 各関数にenv引数追加 |
| `cloudflare.server.ts` | REST API → ネイティブバインディング（`env.AI`, `env.VECTORIZE`） |
| `visitor.server.ts` | env引数追加 |
| `db.server.ts`(facade) | D1 Repository使用に固定、D1バインディング経由 |

共通型定義 `app/types/env.ts`:
```typescript
export interface Env {
  DB: D1Database;
  PARQUET_BUCKET: R2Bucket;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  HPE_SESSION_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  CLIENT_URL: string;
  BASE_URL: string;
  CF_TURNSTILE_SECRET_KEY: string;
  CF_TURNSTILE_SITEKEY: string;
  GOOGLE_GENERATIVE_API_KEY: string;
}
```

### 5.4 GCS → R2 切替
- `gcloud.server.ts` → `r2.server.ts`
- R2バインディングでParquetファイル配信
- カスタムドメイン設定（パブリックアクセス。signed URL不要に）
- **既存URL互換性**: クライアントサイドDuckDBが参照するURLを更新

### 5.5 `wrangler.toml` 作成
```toml
name = "healthy-person-emulator-dotorg"
main = "build/server/index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[site]
bucket = "./build/client"

[[d1_databases]]
binding = "DB"
database_name = "healthy-person-emulator-db"
database_id = "<id>"

[[r2_buckets]]
binding = "PARQUET_BUCKET"
bucket_name = "hpe-parquet"

[ai]
binding = "AI"

[[vectorize]]
binding = "VECTORIZE"
index_name = "embeddings-index"
```

### ロールバック: Cloud Run + PostgreSQL + GCSにDNS切り戻し

---

## Phase 6: デプロイパイプライン + カットオーバー

### 6.1 GitHub Actions書き換え

**本番**（main push時）:
```yaml
- pnpm install --frozen-lockfile
- pnpm build
- npx wrangler deploy
```

**プレビュー**（PR時）:
```yaml
- npx wrangler versions upload --tag pr-${{ github.event.pull_request.number }}
```

### 6.2 カットオーバー手順

1. Workers版をデプロイ（Cloud Runと並行稼働）
2. DNSでトラフィックの10%をWorkersに振り分け
3. 1日間モニタリング（エラー率、レスポンスタイム、データ整合性）
4. 問題なければ50% → 100%に段階移行
5. 1週間安定稼働後にCloud Run廃止

### 6.3 ロールバック手順（明文化）
- **即時**: DNSをCloud Runに切り戻し（TTL: 5分）
- **データ同期**: D1での書き込みがある場合、D1→PostgreSQLへの差分同期スクリプトを事前に用意
- **判定基準**: エラー率1%超、P95レスポンスタイム3倍超、データ不整合検出時

### 6.4 不要ファイル削除（カットオーバー完了後）
- `Dockerfile`, Docker関連設定
- Cloud Run用ワークフロー
- `prisma/schema.prisma`, Prisma Repository実装
- `gcloud.server.ts`
- `@prisma/client`, `@react-router/node`, `@react-router/serve`, `@google-cloud/storage`

---

## リスクと対策

| リスク | 影響度 | 対策 | 検証フェーズ |
|---|---|---|---|
| D1行サイズ上限（2MB） | 高 | **Phase 0 PoCで計測**。超過時はR2退避設計。テキスト記事なら通常2MB以内だが`fct_post_edit_history`（編集前後全文保持）は要確認 | Phase 0 |
| D1クエリ性能 | 高 | **Phase 0 PoCで主要クエリ計測**。インデックス最適化 | Phase 0 |
| Workers上のライブラリ互換性 | 高 | **Phase 0で主要ライブラリ検証**。非互換なら代替特定 | Phase 0 |
| D1トランザクション差異 | 高 | `batch()`とinteractive transactionの使い分け精査。重点テスト | Phase 2-3 |
| 外部自動化プログラムの整合性 | 高 | **Phase 4で内部API導入**。Workers移行前にDB直接接続を排除 | Phase 4 |
| セッション互換性 | 中 | Cookie名・シークレット同一。ファクトリパターンで初期化 | Phase 5 |
| `Date↔string`変換バグ | 中 | Repository層で変換を一元化。スナップショットテストで検証 | Phase 2-3 |
| カットオーバー時のデータ不整合 | 高 | 段階的トラフィック移行 + D1→PG差分同期スクリプト事前準備 | Phase 6 |

---

## 実行順序と工数見積

| Phase | 内容 | 工数目安 | Go/No-Go |
|---|---|---|---|
| 0 | D1適合性PoC | 2-3日 | **ここで中止判断の可能性あり** |
| 1 | Repository層導入 | 3-4日 | |
| 2 | Drizzle/D1実装 + データ移行 | 7-10日 | |
| 3 | テスト・データ検証 | 3-4日 | |
| 4 | 外部依存の切り離し | 2-3日 | |
| 5 | Workers ランタイム移行 | 4-5日 | |
| 6 | デプロイパイプライン + カットオーバー | 2-3日 | |
| **合計** | | **23-32日** | |

---

## 検証方法

1. **Phase 0 PoC**: 行サイズ計測、クエリベンチマーク、Workers互換性テスト
2. **Phase 1-2**: `pnpm test` 全テストパス + Prisma/D1のスナップショット比較
3. **Phase 3**: 全テーブル行数照合 + ランダムサンプル100件/テーブルのフィールドハッシュ比較
4. **Phase 5**: `wrangler dev`でローカルWorkers動作確認 + E2E手動テスト
5. **Phase 6**: 段階的トラフィック移行 + モニタリング（エラー率、レスポンスタイム）

---

## Codexレビュー結果

**総合評価: 差し戻し** → 以下を反映して改訂済み:
- PoC先行フェーズ追加（Phase 0）
- Repository層導入で段階的移行に変更（Phase 1）
- 外部依存の切り離しをWorkers移行前に配置（Phase 4）
- テスト戦略の具体化（Phase 3、スナップショットテスト等）
- ロールバック手順の明文化（Phase 6）
- 工数見積を現実的に修正（14-21日 → 23-32日）
- トランザクション戦略の精査（batch vs interactive transaction）
- Date↔string変換のRepository層一元化
