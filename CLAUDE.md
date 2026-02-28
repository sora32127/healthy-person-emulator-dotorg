# CLAUDE.md

このファイルは、リポジトリ内のコードを扱う Claude Code (claude.ai/code) へのガイダンスを提供します。

## プロジェクト概要

健常者エミュレータ事例集は、暗黙知を収集・共有するための日本語ウェブアプリケーションです。Remix・TypeScript・PostgreSQL・TailwindCSS + DaisyUI で構築されており、アクセシビリティ・匿名性・疲労に配慮したデザインを重視しています。

## 開発コマンド

**基本開発**
- `pnpm dev` - 開発サーバー起動 (localhost:3000)
- `pnpm build` - 本番ビルド (prisma generate を含む)
- `pnpm start` - 本番サーバー起動

**コード品質 (変更後に実行)**
- `pnpm lint` - Biome リンター (ESLint ではない)
- `pnpm typecheck` - TypeScript 型チェック
- `pnpm knip` - 未使用コード検出

**テスト**
- `pnpm test` - Vitest ユニットテスト (happy-dom, タイムアウト60秒)
- `pnpm test -- --reporter=verbose path/to/file.test.ts` - 特定ファイルのみ実行
- `npx playwright test` - E2E テスト

**データベース**
- `pnpm seed` - データベースのシード
- `pnpm reset:db` - スキーマのリセット・プッシュ
- `npx prisma generate` - スキーマ変更後にクライアント生成

**検索データ**
- `pnpm generate:parquet` - クライアントサイド DuckDB 検索用 Parquet ファイル生成

## アーキテクチャ

**ファイル構成**
- `app/routes/` - Remix flat-routes 規約 (remix-flat-routes 経由)
- `app/modules/` - サーバーサイドビジネスロジック (`.server.ts` ファイル)
- `app/components/` - 機能別に整理された React コンポーネント
- `app/stores/` - Jotai atom によるクライアント状態管理
- `app/schemas/` - Zod バリデーションスキーマ
- `app/utils/` - ユーティリティ関数 (meta, menu, toast)

**主要サーバーモジュール**
- `modules/db.server.ts` - Prisma クライアントのシングルトン。全 DB 操作はここに集約
- `modules/session.server.ts` - Cookie ベースのセッション管理 (`__healthy_person_emulator`、有効期限30日)。いいね/よくない/ブックマークをユーザーごとに追跡
- `modules/auth.google.server.ts` - Google OAuth による Remix Auth。開発環境では `demo@example.com` のモック戦略を使用
- `modules/security.server.ts` - Cloudflare Turnstile CAPTCHA + Gemini API によるコンテンツモデレーション + 匿名ユーザーの IP ハッシュ化
- `modules/embedding.server.ts` - 投稿の埋め込みに OpenAI `text-embedding-3-small` を使用 (Prisma ではなく raw SQL で保存)
- `modules/lightSearch.client.ts` - GCS ホスト Parquet ファイルに対するクライアントサイド DuckDB-WASM 検索

**データフローパターン**
- サーバー状態: Remix loaders/actions → コンポーネント
- クライアント状態: Jotai atoms (`app/stores/`)
- フォームバリデーション: React Hook Form + Zod スキーマ、Remix actions 経由で送信
- 検索: 3層構造 — サーバーサイド全文 DB 検索 + クライアント DuckDB-WASM (GCS の Parquet) + pgvector 埋め込み類似度

**データベース**
- PostgreSQL + Prisma ORM + pgvector 拡張
- DB カラムは snake_case、コード内は camelCase でマッピング
- モデル: `DimPosts`, `DimComments`, `DimTags`, `RelPostTags`, `DimUsers`, `FctPostVoteHistory`, `FctCommentVoteHistory`, `FctPostEditHistory`, `FctUserBookmarkActivity`, `nowEditingPages`
- **ベクターカラムは Prisma で `Unsupported("vector")`** — ベクター操作はすべて `prisma.$queryRaw` で raw SQL が必要

**主要ルートファイル**
- `_layout.tsx` - サイドバー・テーマ切替・toast プロバイダーを含むルートレイアウト
- `_layout._index.tsx` - トップページ (固定/ランダム/上限なしいいねタブ)
- `_layout.post.tsx` - 投稿作成 (5W1H+Then 構成)
- `_layout.archives.$postId.tsx` - 投稿詳細
- `_layout.search.tsx` - DuckDB-WASM 検索インターフェース
- `feed[.]xml.tsx` / `sitemap[.]xml.tsx` - RSS と SEO サイトマップ

**スタイリング**
- TailwindCSS 3.4 + DaisyUI 4.12
- カスタムテーマカラー: primary `#99D9EA`、secondary `#264AF4`、tertiary `#00118F`
- tailwind config にカスタム投票アニメーション (`like`, `dislike`, `voteSpin`)
- Noto Sans JP フォント

**コードスタイル**
- TypeScript strict モード、ES2022 ターゲット
- リンターは **Biome** (ESLint ではない) — `biome.json` に設定 (シングルクォート、末尾カンマ)
- コンポーネントは PascalCase、ユーティリティは camelCase
- サーバー専用コードには `.server.ts`、クライアント専用には `.client.ts` サフィックス
- 内部インポートパスは `~/*` を使用

## 環境変数

必要な変数は `.env.example` を参照:
- `DATABASE_URL` / `SUPABASE_CONNECTION_STRING` - PostgreSQL
- `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` - Supabase クライアント
- `HPE_SESSION_SECRET` - セッション Cookie の署名
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` - OAuth
- `GOOGLE_CLOUD_PROJECT_ID` / `GOOGLE_CLOUD_BUCKET_NAME` / `SEARCH_PARQUET_FILE_NAME` / `TAGS_PARQUET_FILE_NAME` - GCS 検索データ
- `OPENAI_API_KEY` - 埋め込みベクター生成
- `GOOGLE_GENERATIVE_API_KEY` - Gemini コンテンツモデレーション
- `CF_TURNSTILE_SITEKEY` / `CF_TURNSTILE_SECRET_KEY` - CAPTCHA
- `BASE_URL` - アプリの完全な URL

## Remix 設定

Vite プラグインで v3 future フラグを有効化: `v3_singleFetch`, `v3_routeConfig`, `v3_lazyRouteDiscovery`, `v3_throwAbortReason`, `v3_relativeSplatPath`, `v3_fetcherPersist`

## 投稿スキーマ (Zod)

投稿は `createPostFormSchema` ファクトリ関数を使用 (DB から `stopWords` 配列を受け取る)。フィールド: カテゴリ enum (`misDeed`|`goodDeed`|`wanted`)、5W1H 状況フィールド (who/what/when/where/why/how/then)、反省/反反省の配列 (各1件以上必須)、タイトル配列 (`#` 記号不可)。エラーメッセージは日本語。

## アクセシビリティと UX

- Biome で JSX a11y ルールを強制
- 疲労に配慮したデザインを維持 (情報密度を最小限に)
- UI テキストはすべて日本語
- モバイル/デスクトップ両対応のレスポンシブデザイン

## パッケージ管理

- pnpm を使用 (preinstall フックで強制)
- Node.js 22.12.0 必須
