# Remix v2 → React Router v7 移行 + remix-auth-google 置換

## Context

Vite+ 導入の前提として Vite 7 + Vitest 4 が必要。Remix v2 は Vite 5 に依存するため、React Router v7 に移行する。`remix-auth-google` は RR7 非対応のため、同時に `remix-auth-oauth2` ベースに置き換える必要がある（PR分割不可）。

v3 future flags はすべて有効化済み。公式アップグレードガイド (https://reactrouter.com/upgrading/remix) に準拠する。

---

## Phase 0: 事前検証

1. 公式アップグレードガイドを WebFetch で取得し、最新手順を確認
2. `remix-auth` v4 + `remix-auth-oauth2` の API を npm README で確認:
   - `Authenticator` コンストラクタの変更
   - `isAuthenticated` / `logout` / `authenticate` のシグネチャ
   - `OAuth2Strategy` の使い方
3. 特殊ルート名の `@react-router/fs-routes` 互換性確認:
   - `feed[.]xml.tsx`, `sitemap[.]xml.tsx`（ブラケット記法）
   - `$.tsx`（スプラットルート）
   - `_layout.*` 系（レイアウトグループ）

## Phase 1: パッケージ入れ替え

**削除:**
```
@remix-run/node @remix-run/react @remix-run/route-config
@remix-run/routes-option-adapter @remix-run/serve @remix-run/dev
remix-auth remix-auth-google remix-flat-routes
```

**追加（dependencies）:**
```
react-router @react-router/node @react-router/serve
remix-auth@^4 remix-auth-oauth2
```

**追加（devDependencies）:**
```
@react-router/dev @react-router/fs-routes
```

## Phase 2: 設定ファイル更新

### react-router.config.ts（新規作成）
```typescript
import type { Config } from '@react-router/dev/config';
export default {} satisfies Config;
```

### vite.config.ts
- `import { vitePlugin as remix } from '@remix-run/dev'` → `import { reactRouter } from '@react-router/dev/vite'`
- `remix({ future: { ... } })` → `reactRouter()`
- `declare module '@remix-run/node'` ブロック削除

### tsconfig.json
- `types`: `["@remix-run/node", "vite/client", "vitest/globals"]` → `["@react-router/node", "vite/client", "vitest/globals"]`
- `include` に `.react-router/types/**/*` を追加
- `rootDirs` に `[".", "./.react-router/types"]` を追加

### package.json scripts
- `"build"`: `"prisma generate && remix vite:build"` → `"prisma generate && react-router build"`
- `"dev"`: `"remix vite:dev ..."` → `"react-router dev --host 0.0.0.0 --port 3000"`
- `"start"`: `"remix-serve ./build/server/index.js"` → `"react-router-serve ./build/server/index.js"`
- `"typecheck"`: `"tsc"` → `"react-router typegen && tsc"`

### app/routes.ts
```typescript
import type { RouteConfig } from '@react-router/dev/routes';
import { flatRoutes } from '@react-router/fs-routes';
export default flatRoutes() satisfies RouteConfig;
```

### .gitignore
- `.react-router/` を追加

## Phase 3: エントリポイント更新

### entry.client.tsx
- `RemixBrowser` from `@remix-run/react` → `HydratedRouter` from `react-router/dom`

### entry.server.tsx
- `AppLoadContext`, `EntryContext` → from `react-router`
- `createReadableStreamFromReadable` → from `@react-router/node`
- `RemixServer` → `ServerRouter` from `react-router`
- JSX: `<RemixServer>` → `<ServerRouter>`

## Phase 4: 認証モジュール書き換え

### session.server.ts
- `import { createCookieSessionStorage, redirect } from '@remix-run/node'` → `from 'react-router'`

### auth.google.server.ts（全面書き換え）

Phase 0 で確認した remix-auth v4 + remix-auth-oauth2 の API に基づいて実装。

**方針:**
- `remix-auth-google` の `GoogleStrategy` → `remix-auth-oauth2` の `OAuth2Strategy` を継承したカスタム `GoogleStrategy`
- Google endpoints: `accounts.google.com/o/oauth2/v2/auth`, `oauth2.googleapis.com/token`
- userinfo 取得: `googleapis.com/oauth2/v2/userinfo` を access token で呼ぶ
- `MockGoogleStrategy`: `authenticate` オーバーライドで OAuth フローをバイパス
- remix-auth v4 API に合わせてセッション管理方式を調整:
  - `isAuthenticated` 廃止の場合 → ヘルパー `getAuthenticatedUser()` を追加
  - `logout` 廃止の場合 → ヘルパー `logoutUser()` を追加
  - `authenticate` の `successRedirect`/`failureRedirect` 廃止の場合 → callback で手動セッション管理
- visitor-cookie (`getVisitorCookieURL`) との連携を維持

### 認証使用ルートの変更（8ファイル）
| ファイル | 変更内容 |
|---------|---------|
| `api.googleLogin.tsx` | import + v4 API対応 |
| `auth.google.callback.tsx` | セッション手動管理（v4 API に応じて）+ visitor-cookie 連携維持 |
| `logout.tsx` | セッション手動破棄（v4 API に応じて）|
| `_layout.tsx` | `authenticator.isAuthenticated` → ヘルパー関数 |
| `_layout.bookmark.tsx` | 同上 |
| `_layout.editHistory.tsx` | 同上 |
| `_layout.archives.edit.$postId.tsx` | 同上 |
| `_layout.archives.$postId.tsx` | 同上 |

## Phase 5: インポート一括置換

全ファイル（約35個）で:
- `from '@remix-run/node'` → `from 'react-router'`
- `from '@remix-run/react'` → `from 'react-router'`

**例外**: `createReadableStreamFromReadable` のみ `@react-router/node` から（entry.server.tsx）

## Phase 6: 型生成 + 検証

1. `react-router typegen` を実行し `.react-router/types/` を生成
2. `pnpm typecheck`（= `react-router typegen && tsc`）— 型エラーなし
3. `pnpm lint` — Biome 通過
4. `pnpm dev` — 開発サーバー起動確認
5. ルート確認:
   - トップ `/`, 投稿詳細 `/archives/:postId`, 検索 `/search`
   - RSS `/feed.xml`, サイトマップ `/sitemap.xml`
   - 認証: MockGoogleStrategy でログイン → `/bookmark` → ログアウト
   - 保護ページ未認証リダイレクト (`/bookmark`, `/editHistory`)
6. `pnpm test` — ユニットテスト通過
7. `npx playwright test` — E2E テスト通過

## ロールバック計画

- git ブランチ上で作業。問題時は `main` に revert
- パッケージ変更は `pnpm-lock.yaml` で追跡可能
- 認証フローが壊れた場合は revert が最優先（全ユーザーログイン不能リスク）

## リスク・注意点

1. **remix-auth v4 API**: Phase 0 で事前に API を確認し、不明点を潰してから着手
2. **fs-routes 互換**: ブラケット記法・スプラットルート・レイアウトグループの互換性を Phase 0 で検証
3. **`data()` ユーティリティ**: RR7 での存在・動作を確認
4. **singleFetch**: デフォルト化により型推論が変わる可能性
5. **visitor-cookie 連携**: `auth.google.callback.tsx` の成功時リダイレクト先決定ロジックを壊さないこと

## 対象ファイル一覧

| ファイル | 変更種別 |
|---------|---------|
| `react-router.config.ts` | 新規作成 |
| `vite.config.ts` | プラグイン変更 |
| `tsconfig.json` | types, include, rootDirs |
| `package.json` | scripts, dependencies |
| `.gitignore` | `.react-router/` 追加 |
| `app/routes.ts` | fs-routes に切替 |
| `app/entry.client.tsx` | HydratedRouter |
| `app/entry.server.tsx` | ServerRouter + @react-router/node |
| `app/modules/session.server.ts` | import パス |
| `app/modules/visitor.server.ts` | import パス |
| `app/modules/auth.google.server.ts` | 全面書き換え |
| `app/routes/*` (25ファイル) | import パス + 認証API変更(8ファイル) |
| `app/components/*` (約8ファイル) | import パス |
