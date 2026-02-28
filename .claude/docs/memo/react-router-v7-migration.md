# React Router v7 移行メモ

作成日: 2026-02-28

## 概要

Cloudflare 移行の前提作業として、Remix v2 → React Router v7 に移行する。
React Router v7 は Remix v3 として開発されたもので、両者は事実上同じプロダクト。

## 現状

```
@remix-run/* v2.17.2（v3 フューチャーフラグ全部 ON）
```

`vite.config.ts` に以下のフラグがすべて有効になっている：

```ts
v3_fetcherPersist: true,
v3_relativeSplatPath: true,
v3_throwAbortReason: true,
v3_lazyRouteDiscovery: true,
v3_singleFetch: true,
v3_routeConfig: true,
```

**これはすでに React Router v7 と同じ動作をしている状態。**
移行作業はほぼパッケージ置き換えのみ。

## 移行理由

Cloudflare Workers 向けのアダプターは `@react-router/cloudflare` として提供されている。
Remix のまま Cloudflare 移行を進めると、アダプター・ドキュメント・サポートが全て RR v7 ベースになるため、先に揃えておく。

## 移行作業

### 1. パッケージ置き換え

| 現行パッケージ | 置き換え後 |
|---------------|-----------|
| `@remix-run/react` | `react-router` |
| `@remix-run/node` | `@react-router/node` |
| `@remix-run/dev` | `@react-router/dev` |
| `@remix-run/serve` | `@react-router/serve` |
| `@remix-run/route-config` | `@react-router/dev` に統合（削除） |
| `@remix-run/routes-option-adapter` | `@react-router/dev` に統合（削除） |

### 2. vite.config.ts の変更

```ts
// Before
import { vitePlugin as remix } from '@remix-run/dev'
plugins: [remix({ future: { v3_*: true } })]

// After
import { reactRouter } from '@react-router/dev/vite'
plugins: [reactRouter()]  // フラグ不要（デフォルトで v7 動作）
```

### 3. import パスの一括変換

```
from '@remix-run/react' → from 'react-router'
from '@remix-run/node'  → from 'react-router' または '@react-router/node'
```

`modules/*.server.ts` と全 `routes/*.tsx` が対象。

### 4. 要確認パッケージ

移行前に React Router v7 対応状況を確認する：

| パッケージ | 確認事項 |
|-----------|---------|
| `remix-auth@3.7.0` | RR v7 対応版があるか（`react-router-auth` 等） |
| `remix-auth-google@2.0.0` | 同上 |
| `remix-flat-routes@0.8.5` | `v3_routeConfig` 有効時は不要になる可能性あり |

### 5. 型変更

`LoaderFunctionArgs` 等の型のインポート元が変わる。
TypeScript エラーを確認しながら修正。

## 移行手順（順序）

```
1. ブランチを切る（feature/react-router-v7）
2. パッケージ置き換え（pnpm install）
3. vite.config.ts 修正
4. import パス一括変換
5. TypeScript エラーを修正
6. pnpm dev で動作確認
7. Playwright E2E テストを実行（ローカル）
8. マージ
```

## 注意事項

- Cloudflare 移行との混在は禁止。RR v7 移行を完了してから Cloudflare 移行に進む
- v3 フラグがすでに全 ON なので、動作の差異は最小限のはず
- `remix-flat-routes` が不要になった場合は、`routes.ts` への移行も検討
