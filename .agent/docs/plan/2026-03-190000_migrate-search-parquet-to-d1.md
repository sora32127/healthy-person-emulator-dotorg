# 検索機能: Parquetフロントエンド検索 → D1バックエンド検索への移行

## Context

現在の検索機能はParquetファイル + DuckDB WASMによるクライアントサイド検索を採用している。この方式には以下の課題がある：

- Parquetファイルの生成・アップロード・管理が面倒
- DuckDB WASMの初期化が遅い（WASMダウンロード + Parquetファイルダウンロード）
- duckdb-wasmのコードが複雑

既にCloudflare D1に`dim_posts`, `rel_post_tags`, `dim_tags`テーブルがあり、検索に必要なデータはすべてDB側に存在する。既存の`d1.server.ts`リポジトリには`getFeedPosts`等のページネーション付きクエリパターンが確立されているため、同じパターンで検索APIを実装する。

## 方針

- **D1のLIKE検索を使ったバックエンド検索API**を新設
- loaderでサーバーサイド検索を実行し、結果をクライアントに返す
- DuckDB WASM / Parquet関連コードをすべて削除
- 既存の`SearchResult`型とUI（無限スクロール、タグフィルタ等）はできるだけ維持

> **注意**: D1 (SQLite) にはFTS5等の全文検索拡張もあるが、まずはシンプルなLIKE検索で移行し、パフォーマンス問題が出たら後からFTSを検討する。

## 実装ステップ

### Step 0: 現状の検索挙動をブラウザで確認し、E2Eテストシナリオを作成

**ツール**: `/e2e-tester` スキル + Chrome MCP

1. 本番サイトの `/search` ページにアクセスし、以下の挙動を確認・記録:
   - 初期表示状態（検索結果なし or 全件表示）
   - テキスト検索の入力→結果表示の流れ
   - タグフィルタの選択→結果絞り込み
   - ソート切り替え（新着/古い順/いいね順）
   - 無限スクロール（下にスクロールして追加読み込み）
   - 検索結果カードの表示内容（タイトル、日付、いいね数、タグ等）
   - 検索結果クリック→記事詳細パネル表示（デスクトップ時）
2. 確認した挙動をE2Eテストシナリオとして文書化

### Step 1: リポジトリに検索メソッドを追加

**ファイル**: `app/repositories/d1.server.ts`

`searchPosts`メソッドを追加。`getFeedPosts`パターンに従う：

- 引数: `query`, `orderby`, `page`, `tags[]`, `pageSize`
- LIKE検索: `postTitle LIKE '%query%' OR postContent LIKE '%query%'`
- タグフィルタ: `rel_post_tags` + `dim_tags`をJOINしてフィルタ
- ソート: `timeDesc` / `timeAsc` / `like`
- ページネーション: offset/limit
- 戻り値: `SearchResult`型（metadata + tagCounts + results）に合わせた構造

タグカウント集計も同メソッド内で実行（検索条件に合致する記事のタグを集計）。

### Step 2: 検索ページのloader/actionを書き換え

**ファイル**: `app/routes/_layout.search.tsx`

- loaderでURL SearchParams (`q`, `tags`, `orderby`, `page`, `pageSize`) を受け取る
- `d1Repository.searchPosts()`を呼び出し
- 結果をそのままJSON返却（Parquet URLの生成は不要に）
- actionは`firstSearch`リダイレクトのみ残す

### Step 3: 検索ページUIをサーバーデータに切り替え

**ファイル**: `app/routes/_layout.search.tsx`

- `useLoaderData()`で検索結果を取得
- DuckDB WASMの初期化・検索呼び出しをすべて削除
- 検索パラメータ変更時はURL SearchParamsを更新→loaderが再実行される形に
- 無限スクロール: fetcherを使って追加ページをロード

### Step 4: Jotaiストアの簡素化

**ファイル**: `app/stores/search.ts`

- DuckDB依存のatomを削除
- loaderデータをそのまま使うか、必要最小限のatomに整理

### Step 5: DuckDB / Parquet関連コードの削除

- `app/modules/lightSearch.client.ts` — 削除
- `app/modules/gcloud.server.ts` — Parquet URL生成関数の削除（他で使われていなければファイルごと削除）
- `scripts/generateParquetFiles.ts` — 削除
- `package.json` から `@duckdb/duckdb-wasm`, `@duckdb/node-api` を削除
- 環境変数 `SEARCH_PARQUET_FILE_NAME`, `TAGS_PARQUET_FILE_NAME`, `GCS_PARQUET_BASE_URL` を削除

### Step 6: 型定義の整理

**ファイル**: `app/types/env.ts`

- Parquet関連の環境変数型を削除

## 主要ファイル

| ファイル                            | 変更内容                  |
| ----------------------------------- | ------------------------- |
| `app/repositories/d1.server.ts`     | `searchPosts`メソッド追加 |
| `app/repositories/types.ts`         | 必要なら検索用型追加      |
| `app/routes/_layout.search.tsx`     | loader/UI全面書き換え     |
| `app/stores/search.ts`              | 簡素化                    |
| `app/modules/lightSearch.client.ts` | 削除                      |
| `app/modules/gcloud.server.ts`      | Parquet関連削除           |
| `scripts/generateParquetFiles.ts`   | 削除                      |
| `app/types/env.ts`                  | Parquet環境変数削除       |
| `package.json`                      | duckdb依存削除            |

## 検証方法

1. `pnpm test` で既存テストがパスする
2. `pnpm build` でビルドが通る
3. `pnpm dev` でローカル起動し、Step 0で作成したE2Eシナリオを `/e2e-tester` で実行:
   - テキスト検索が動作する
   - タグフィルタが動作する
   - ソート切り替え（新着/古い順/いいね順）が動作する
   - 無限スクロールが動作する
   - 検索結果のPostCardが正しく表示される
   - 移行前後で同等の挙動であることを確認

## 実施結果

### 完了事項

- Step 0: 本番サイトで検索挙動を確認し、E2Eテストシナリオを `.claude/skills/e2e-tester/references/pages/search-page.md` に作成
- Step 1: `app/repositories/d1.server.ts` に `searchPosts` メソッドを追加（`SearchOrderBy`, `SearchPostsResult` 型も追加）
- Step 2-3: `app/routes/_layout.search.tsx` を全面書き換え。loaderでD1に直接クエリ、無限スクロールは`useFetcher`で実装
- Step 4: `app/stores/search.ts` を削除（Jotaiストア不要に）
- Step 5: `lightSearch.client.ts`, `gcloud.server.ts`, `generateParquetFiles.ts` を削除。`@duckdb/duckdb-wasm`, `@duckdb/node-api` をアンインストール。`load-context.ts` から `initGcloud` 呼び出しを削除
- Step 6: `app/types/env.ts` から Parquet関連環境変数型（`SEARCH_PARQUET_FILE_NAME`, `TAGS_PARQUET_FILE_NAME`, `GCS_PARQUET_BASE_URL`）を削除

### プランからの変更点

- 初期表示では「検索キーワードを入力してください」メッセージと共に全件を新着順で表示する（DuckDB版と同じ挙動）
- `useFetcher`を使った無限スクロール実装では、fetcherの`load`メソッドで`/search?page=N`をリクエストしてloader経由で追加ページを取得する
- Jotaiストアは完全に削除（簡素化ではなく削除）。loaderデータとローカルstate（`allResults`, `currentSearchResult`）で管理

### 未完了・今後の対応

- wrangler.toml の `GCS_PARQUET_BASE_URL`, `.env` の `SEARCH_PARQUET_FILE_NAME`, `TAGS_PARQUET_FILE_NAME` の環境変数定義を削除する（本PRでは型定義のみ削除）
- 本番環境でのパフォーマンス検証（記事数が多い場合のLIKE検索速度）
- 必要に応じてD1 FTS5への移行を検討
- GCS/R2上のParquetファイルの削除

### スキル提案

- なし（今回は既存スキルの `/e2e-tester` で十分対応できた）
