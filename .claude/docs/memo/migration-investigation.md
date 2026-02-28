# Cloudflare移行調査まとめ

作成日: 2026-02-28

## 目的

月額コストを ¥7,000 から可能な限り削減する。

## 現行スタック

| 関心事 | 技術 | 月額 |
|--------|------|------|
| フレームワーク | Remix (SSR / Node.js) | - |
| ホスティング | Google Cloud Run (min-instances=1) | ~¥3,250 |
| DB | Supabase Pro (PostgreSQL + pgvector) | ~¥3,750 ($25) |
| 検索 | DuckDB-WASM + GCS 上の Parquet | ~¥0 |
| 認証 | Remix Auth + Google OAuth (Cookie セッション) | ¥0 |
| CAPTCHA | Cloudflare Turnstile | ¥0 |
| 埋め込み | OpenAI text-embedding-3-small | 小額 |
| モデレーション | Gemini API | ¥0 (無料枠) |
| UI | TailwindCSS + DaisyUI | - |
| **合計** | | **~¥7,000/月** |

## 確定方針（変更不可）

| 関心事 | 採用技術 |
|--------|---------|
| データベース | **Cloudflare D1**（SQLite） |
| ホスティング | **Cloudflare Pages / Workers** |
| ベクター検索 | **Cloudflare Vectorize** |

## DB サイズ調査結果

### 当初の誤認

ユーザーは「DBは10GB」と認識していたが、これは **Supabase Pro プランの割り当て上限（8GB）** を実使用量と誤読したものと判明。

### 実測値

```
pg_database_size: 943 MB
```

| スキーマ | サイズ | 備考 |
|---------|------|------|
| public | 290 MB | アプリデータ本体 |
| pg_toast | 127 MB | 大テキストの溢れ領域（投稿・コメント本文） |
| pg_catalog | 11 MB | PostgreSQL システム |
| auth | 3 MB | Supabase Auth（ほぼ未使用） |
| storage / realtime / 他 | <1 MB | - |

**移行対象（public + TOAST）: 417 MB**
→ D1 の 5GB 上限の **8.1%**。余裕十分。

### テーブル別サイズ（移行対象のみ）

| テーブル | サイズ | 移行方針 |
|---------|------|---------|
| dim_posts | 302 MB | 移行（pgvector カラムは Vectorize へ切り出し） |
| fct_comment_vote_history | 30 MB | 移行 |
| fct_post_vote_history | 14 MB | 移行 |
| dim_comments | 10 MB | 移行 |
| rel_post_tags | 4.8 MB | 移行 |
| fct_post_edit_history | 1.76 MB | 移行 |
| fct_user_bookmark_activity | 0.168 MB | 移行 |
| dim_users | 0.160 MB | 移行 |
| dim_tags | 0.136 MB | 移行 |
| now_editing_pages | 0.112 MB | 移行 |
| dim_stop_words | 0.032 MB | 移行 |

## Supabase Auth 依存調査

- auth スキーマは 3 MB（ほぼ空）
- アプリは独自の `dim_users` テーブルと Google OAuth（Remix Auth）を使用
- **Supabase Auth への依存なし** → 移行時に auth 移植は不要

## 技術的な移行課題

### 1. ORM: Prisma → Drizzle（最大の工数）

- Prisma は Cloudflare Workers 環境で動作不可（TCP 接続が使えない）
- Drizzle ORM が D1 を公式サポート（`drizzle-orm/d1`）
- 全 `modules/*.server.ts` のクエリを書き換える必要あり

### 2. フレームワーク: Remix Node → Remix Cloudflare

- `@remix-run/node` → `@remix-run/cloudflare` アダプター
- `process.env` → `context.cloudflare.env` に変更
- Cookie セッションは同 API のまま動作
- Google OAuth は HTTP 通信のみ → Workers 互換

### 3. スキーマ型変換（PostgreSQL → SQLite）

| PostgreSQL 型 | SQLite (D1) 型 | 備考 |
|-------------|--------------|------|
| `UUID` | `TEXT` | `crypto.randomUUID()` で生成 |
| `Timestamptz` | `TEXT` | ISO 8601 UTC 固定（ソート順を保つため） |
| `String[]` (配列) | `TEXT` (JSON) | `suggestionResult` 等。検索不要なフィールドのみ |
| `Unsupported("vector")` | 削除 | Vectorize へ移行 |
| `Decimal` | `REAL` | `fct_comment_vote_history.postId` |
| `Boolean` | `INTEGER` | 0/1 |

### 4. pgvector → Cloudflare Vectorize

- 埋め込みモデル: `text-embedding-3-small`（1536次元）
- Vectorize インデックス作成: `wrangler vectorize create hpe-embeddings --dimensions=1536 --metric=cosine`
- 既存埋め込みのバルクインポート（1リクエスト最大1,000件制限に注意）
- 埋め込み生成は OpenAI API 継続（または Workers AI に切り替え可）

**Vectorize コスト試算（dim_posts が 302 MB ≒ 推定 1〜5 万件）:**

| 投稿数 | 月額（有料時） |
|--------|--------------|
| 1 万件 | ~$0.77 |
| 5 万件 | ~$3.84 |

Workers 有料プラン ($5/月) が前提でも現状より大幅に安い。

### 5. 検索データ: GCS → R2

- DuckDB-WASM のコードはそのまま
- Parquet ファイルの参照 URL を GCS → R2 に変更するだけ
- R2 は出力転送費用ゼロ

### 6. Node.js 固有 API の棚卸（要作業）

Workers 環境では `node:crypto`・`Buffer`・`fs`・`stream` 等が使えないか制限される。
移行前に `grep -r "from 'node:"` でインポートを列挙し、代替実装を確認する。

## 残課題・未確認事項

### 🔴 移行前に必ず解決（Codexレビュー指摘）

| 課題 | 内容 |
|------|------|
| **SQL 互換性の棚卸** | PostgreSQL 固有機能（JSONB 演算子・CTE・ウィンドウ関数・部分インデックス・トリガー・外部キー制約）が SQLite/D1 で再現できるか全クエリを確認。互換不可なクエリが1つでも残れば移行は止まる。 |
| **D1 書き込み競合の設計** | D1 は単一プライマリで書き込み競合時はロールバック。いいね等の高頻度書き込みに対して、リトライ・楽観ロック・キュー等の改修方針を事前に確定する。 |
| **D1 バックアップ設計** | D1 は自動 PITR を提供しない。`wrangler d1 export` の定期スケジュールと、リストア手順を移行前に確定する。 |

### 🟡 移行中に注意

| 課題 | 優先度 | 内容 |
|------|--------|------|
| Node.js API 棚卸 | 高 | `grep -r "from 'node:"` で使用箇所を特定。`Buffer`・`stream`・`zlib`・`process` 等も対象。完了条件を定義する。 |
| Drizzle スキーマ設計 | 高 | 型変換確定。特に `Decimal → REAL` は精度劣化リスクあり（`fct_comment_vote_history.postId`）。TEXT + アプリ側変換も検討。 |
| 廃棄テーブルのデータ確認 | 中 | 「コードにない＝廃棄」としたが、手動 SQL や分析用途での使用がないか念のため確認。データ保持義務がないか確認。 |
| Vectorize バルクインポート | 中 | 1リクエスト 1,000件制限。エラーハンドリング・再実行設計を事前に用意。 |
| GCS → R2 互換性確認 | 中 | DuckDB-WASM が使う Range リクエスト・CORS 設定が R2 で動くか検証。 |
| wrangler.toml 設計 | 低 | D1・Vectorize・R2 のバインディング構成。 |

### 補足: D1 容量について

`pg_total_relation_size`（インデックス含む）の合計は 415 MB。
`pg_database_size` は 943 MB（WAL・システム領域含む）。
移行対象データはインデックス込みで 415 MB であり、D1 の 5 GB 上限に対して十分な余裕がある。
成長率は別途評価が必要。

## 期待コスト（移行後）

| サービス | 月額 |
|---------|------|
| Cloudflare Pages | ¥0 |
| Cloudflare Workers（無料枠超の場合） | $5 |
| Cloudflare D1 | ¥0（無料枠内） |
| Cloudflare Vectorize | $1〜4（規模による） |
| Cloudflare R2 | ¥0（無料枠内） |
| OpenAI（埋め込み生成） | 小額 |
| Gemini API | ¥0（無料枠） |
| **合計** | **~$6〜10/月（¥900〜1,500）** |

現状 ¥7,000 → 移行後 **¥1,500 以下**（推定 **-80%**）
