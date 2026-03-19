# fix: vp lint / vp fmt が実行できない問題の修正

## Context

`pnpm lint` (`vp lint`) と `pnpm format` (`vp fmt --write .`) が `ERR_REQUIRE_CYCLE_MODULE` で失敗する。
原因: `vp` が lint/fmt 実行時にも `vite.config.ts` を読み込み、`@react-router/dev/vite/cloudflare.js` (CJS) が `require("react-router")` で ESM (`.mjs`) を解決する際に Node.js 22.12.0 の `require(esm)` 機能が循環参照エラーを出す。

## 修正

`.env` と `.env.example` に以下を追加:

```
NODE_OPTIONS=--no-experimental-require-module
```

これにより `require()` が ESM ファイルではなく CJS (`.js`) にフォールバックし、循環参照が回避される。

### 検証済み

- `pnpm lint` ✅
- `pnpm format` ✅
- `pnpm build` ✅
- `pnpm test` ✅

## 対象ファイル

- `.env` - NODE_OPTIONS 追加
- `.env.example` - NODE_OPTIONS 追加

## 検証手順

```bash
pnpm lint
pnpm format
pnpm build
pnpm test
```
