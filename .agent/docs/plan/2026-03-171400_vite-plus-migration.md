# Vite+ 本格移行

## Context

互換性スパイク（`spike/vite-plus-compat` ブランチ）で Vite 8 + vite-plus が React Router v7 と互換性があることを確認済み。
本プランでは、スパイクで残した課題を解決し vite-plus 移行を完了させる。

Codex レビューで差し戻しを受け、以下の問題を修正したプラン:

- Node 22 での `vp` CLI 動作確認を Phase 0 に追加
- pnpm.overrides を vite-plus README 準拠のグローバル override に変更
- OxLint カテゴリ設定を拡充（correctness のみ → 複数カテゴリ）
- 生成物（`.react-router/types`）の ignorePatterns を追加
- CSS/Tailwind パーサーの検証ステップを追加
- Biome 並走期間を設けるロールバック設計

---

## Phase 0: Node 22 での vp CLI 動作確認

Node 25 固有の .ts ESM 問題かもしれないため、engines 指定の Node 22.12.0 で再確認。

```bash
vp env use 22.12.0  # or nvm use 22.12.0
vp lint
vp fmt --check
vp build
```

**ここで動かない場合**: `vp lint`/`vp fmt` の scripts 移行は見送り、`npx oxlint` / `npx oxfmt` に直接差し替えるか Biome 維持を検討。

---

## Phase 1: `vite-tsconfig-paths` 除去 + pnpm overrides

**`vite.config.ts`:**

- `import tsconfigPaths from 'vite-tsconfig-paths'` を削除
- `tsconfigPaths()` プラグインを削除
- `resolve: { tsconfigPaths: true }` を追加

**`package.json`:**

- `vite-tsconfig-paths` を devDependencies から削除
- vite-plus README 準拠のグローバル overrides を追加:
  ```json
  "pnpm": {
    "overrides": {
      "vite": "npm:@voidzero-dev/vite-plus-core@latest",
      "vitest": "npm:@voidzero-dev/vite-plus-test@latest"
    }
  }
  ```

**検証:** `vp build`, `pnpm test -- --run`, `pnpm exec react-router typegen && tsc`

---

## Phase 2: OxLint 並走導入（Biome は残す）

Biome を即削除せず、OxLint を並走導入して rule gap を確認する。

### 2a: `.oxlintrc.json` 作成

Biome `recommended` に近づけるため、複数カテゴリを有効化:

```json
{
  "plugins": ["react", "typescript", "unicorn", "jsx-a11y"],
  "categories": {
    "correctness": "error",
    "suspicious": "warn",
    "perf": "warn"
  },
  "ignorePatterns": [".react-router/types/**", "build/**", "node_modules/**"]
}
```

### 2b: `.oxfmtrc.json` 作成

```json
{
  "singleQuote": true,
  "trailingComma": "all"
}
```

### 2c: `biome-ignore` → `eslint-disable` 変換（対象箇所のみ）

| ファイル                                  | Biome ルール                | OxLint 対応           | アクション                                                      |
| ----------------------------------------- | --------------------------- | --------------------- | --------------------------------------------------------------- |
| `app/routes/_layout.post.tsx:109,131,309` | `noThenProperty`            | `unicorn/no-thenable` | `eslint-disable-next-line unicorn/no-thenable` に変換           |
| `app/schemas/post.schema.ts:46`           | `noThenProperty`            | `unicorn/no-thenable` | 同上                                                            |
| `app/routes/_layout.post.tsx:474`         | `noDangerouslySetInnerHtml` | ルールなし            | コメントは残す（TODO: OxLint で同等ルールが追加されたら有効化） |
| `app/routes/_layout.post.tsx:9`           | `useImportType`             | ルールなし            | コメントは残す                                                  |
| `app/utils/makeToastMessage.ts:1`         | `useImportType`             | ルールなし            | コメントは残す                                                  |
| `app/components/MarkdownEditor.tsx:22`    | `noExplicitAny`             | デフォルト無効        | コメントは残す                                                  |

→ Biome がまだ残っているので、biome-ignore コメントは OxLint 用の eslint-disable を**追加**し、biome-ignore は削除しない。

### 2d: package.json scripts に並走コマンド追加

```json
"lint": "vp lint",
"lint:biome": "biome lint .",
"format": "vp fmt --write .",
"format:biome": "biome format --write ."
```

Phase 0 で `vp lint` が動かない場合:

```json
"lint": "oxlint -c .oxlintrc.json .",
"format": "oxfmt --write ."
```

### 2e: CSS/Tailwind 検証

- `vp fmt --check app/tailwind.css` を実行し、`@tailwind`/`@apply` ディレクティブが正しくパースされるか確認
- OxFmt が CSS を壊す場合、CSS ファイルは OxFmt の対象外にして Biome formatter を残す

**検証:**

1. `vp lint` — 生成物由来の大量エラーが出ないこと
2. `vp fmt --check` — CSS/Tailwind ファイルが壊れないこと
3. `pnpm run lint:biome` — 既存 Biome lint も引き続き通ること
4. 両方の lint 結果を比較し、OxLint でカバーできていないルールを特定

---

## Phase 3: Biome 削除判定

Phase 2 の並走結果を確認し、以下の条件をすべて満たす場合のみ Biome を削除:

- [ ] `vp lint` のルールカバレッジが Biome recommended と同等以上
- [ ] CSS/Tailwind ファイルの formatter が正常動作
- [ ] 生成物の ignore が機能している

**条件を満たした場合:**

- `biome.json` 削除
- `@biomejs/biome` アンインストール
- `lint:biome` / `format:biome` scripts 削除
- biome-ignore コメントを整理（OxLint にルールがないものは削除、あるものは eslint-disable のみ残す）

**条件を満たさない場合:**

- Biome は formatter + CSS 用に残す
- OxLint は追加の lint レイヤーとして併用

---

## Phase 4: CLAUDE.md 更新

- ビルドツールチェーンの変更を反映
- lint/format コマンドの更新
- `vite-tsconfig-paths` 不要の記載

---

## 対象ファイル一覧

| ファイル                      | 変更内容                                                    |
| ----------------------------- | ----------------------------------------------------------- |
| `vite.config.ts`              | tsconfigPaths プラグイン除去、`resolve.tsconfigPaths: true` |
| `package.json`                | deps 整理、グローバル overrides、scripts 更新               |
| `.oxlintrc.json`              | 新規作成（ignorePatterns 含む）                             |
| `.oxfmtrc.json`               | 新規作成                                                    |
| `app/routes/_layout.post.tsx` | eslint-disable コメント追加 (4箇所)                         |
| `app/schemas/post.schema.ts`  | eslint-disable コメント追加 (1箇所)                         |
| `CLAUDE.md`                   | ツールチェーン情報更新                                      |
| `pnpm-lock.yaml`              | 自動更新                                                    |
| `biome.json`                  | Phase 3 判定後に削除（条件付き）                            |

## 検証手順

1. `pnpm install` — overrides 適用確認
2. `vp build` — ビルド成功
3. `vp lint` — lint エラーなし（生成物除外確認）
4. `vp fmt --check` — フォーマット差分なし（CSS 含む）
5. `pnpm run lint:biome` — Biome lint も通ること（並走確認）
6. `pnpm test -- --run` — テスト全パス
7. `pnpm exec react-router typegen && tsc` — 型チェック通過

## ロールバック

- Phase 2 まではBiome が残っているため、`lint:biome`/`format:biome` で即座に切り戻し可能
- Phase 3 の Biome 削除は条件付きのため、条件未達なら削除しない
- 全体ロールバックは `git checkout main` で即座に戻せる
