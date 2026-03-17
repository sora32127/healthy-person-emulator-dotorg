# Vite+ 導入 — 互換性スパイク

## Context

React Router v7 移行完了後、Vite+ (VoidZero 統合ツールチェーン) の導入を検討中。
しかし `@react-router/dev` の peerDependencies が `vite: ^5|^6|^7` で Vite 8 未対応。
Vite+ は Vite 8+ が前提のため、まず互換性を検証してから Go/No-Go を判定する。

**このプランのスコープ: 互換性スパイクのみ。**
本格的な Vite+ 移行（Biome 廃止、CI 更新等）は互換性確認後に別プランで行う。

---

## Phase 1: 環境準備

### 1a: 作業ブランチ作成

```bash
git checkout -b spike/vite-plus-compat
```

### 1b: Vite+ CLI インストール

```bash
curl -fsSL https://vite.plus | bash
# シェル再読み込み
```

## Phase 2: Vite 8 + Vitest 4.1 アップグレード

```bash
pnpm add -D vite@^8 vitest@^4.1 @vitest/coverage-v8@^4.1 @vitest/ui@^4.1
```

- peerDep 警告が出た場合は `pnpm.overrides` で対応
- この時点で **@react-router/dev は現行バージョンのまま**

## Phase 3: 互換性チェックポイント（Vite 8 単体）

Vite+ を入れる前に、Vite 8 単体で React Router が動くか確認。

1. `pnpm exec react-router typegen` — 型生成が動くか
2. `pnpm exec react-router build` — ビルドが通るか
3. `pnpm dev` — 開発サーバーが起動するか
4. `pnpm test` — テストが通るか

**ここで失敗したら → No-Go。Vite+ 導入は @react-router/dev の Vite 8 対応を待つ。**

## Phase 4: vite-plus パッケージ導入

Phase 3 が通った場合のみ進む。

```bash
pnpm add -D vite-plus
```

### 4a: vite.config.ts 最小変更

- `defineConfig` のインポート元のみ `vite-plus` に変更
- プラグインはそのまま維持
- lint/fmt 設定は **この段階では追加しない**

### 4b: vitest.config.ts 最小変更

- `defineConfig` のインポート元を `vite-plus` に変更
- 注意: `vite-plus/test` には `defineConfig` が存在しないため `vite-plus` から直接インポート

## Phase 5: 互換性チェックポイント（vite-plus）

1. `pnpm exec react-router typegen` — 型生成
2. `pnpm exec react-router build` — ビルド
3. `pnpm dev` — 開発サーバー起動 + トップページ表示確認
4. `pnpm test` — ユニットテスト
5. `vp dev` — vp CLI 経由で開発サーバーが起動するか
6. `vp build` — vp CLI 経由でビルドが通るか
7. `vp test` — vp CLI 経由でテストが通るか

**ここで失敗したら → 失敗箇所を記録し、回避策を検討。回避不能なら No-Go。**

## Phase 6: 結果判定

### Go の場合

- 互換性スパイクの結果を記録
- 本格移行プランを別途作成（スコープ: scripts 更新、Biome 廃止、CI 更新、ロールバック計画）

### No-Go の場合

- 失敗箇所と原因を記録
- `spike/vite-plus-compat` ブランチは参照用に保持
- @react-router/dev の Vite 8 対応を待つ

## 対象ファイル（最小変更）

| ファイル           | 変更内容                             |
| ------------------ | ------------------------------------ |
| `package.json`     | devDependencies のバージョン更新のみ |
| `vite.config.ts`   | defineConfig のインポート元変更のみ  |
| `vitest.config.ts` | defineConfig のインポート元変更のみ  |

## ロールバック

```bash
git checkout main
git branch -D spike/vite-plus-compat  # 不要な場合
```

---

# スパイク結果

**実施日**: 2026-03-17
**ブランチ**: `spike/vite-plus-compat`
**判定**: 条件付き Go

## バージョン

| パッケージ          | 変更前  | 変更後            |
| ------------------- | ------- | ----------------- |
| vite                | ^5.4.21 | ^8 (8.0.0)        |
| vitest              | ^2.1.9  | ^4.1 (4.1.0)      |
| @vitest/coverage-v8 | 2.1.9   | ^4.1 (4.1.0)      |
| @vitest/ui          | ^3.2.4  | ^4.1 (4.1.0)      |
| vite-plus           | -       | 0.1.12 (新規追加) |

## チェックポイント結果

### Phase 3: Vite 8 単体

| チェック               | 結果 | 備考                                                 |
| ---------------------- | ---- | ---------------------------------------------------- |
| `react-router typegen` | OK   | esbuild→oxc 警告、vite-tsconfig-paths 置換可能の警告 |
| `react-router build`   | OK   | client + SSR 両方成功                                |
| `pnpm test`            | OK   | 3ファイル7テスト全パス (415ms)                       |

**@react-router/dev の peer dep**: `vite@"^5.1.0 || ^6.0.0 || ^7.0.0"` で Vite 8 未対応だが、実際には動作する。

### Phase 5: vite-plus

| チェック               | 結果 | 備考                                    |
| ---------------------- | ---- | --------------------------------------- |
| `react-router typegen` | OK   | Phase 3 と同じ警告                      |
| `react-router build`   | OK   | Phase 3 と同じ                          |
| `pnpm test` (vitest)   | OK   | 3ファイル7テスト全パス (407ms)          |
| `vp build`             | OK   | vp CLI 経由でもビルド成功               |
| `vp test`              | FAIL | jest-dom マッチャー非対応 (4テスト失敗) |

## 変更ファイル

### vite.config.ts

- `defineConfig` のインポート元を `vite` → `vite-plus` に変更

### vitest.config.ts

- `defineConfig` のインポート元を `vitest/config` → `vite-plus` に変更
- 注意: `vite-plus/test` には `defineConfig` が存在しない

### package.json

- devDependencies のバージョン更新のみ

## 本格移行時の対応事項

1. **`vp test` と jest-dom**: `vp` の内蔵テストランナーは独自 Chai インスタンスを使い、`@testing-library/jest-dom` のカスタムマッチャーを認識しない。セットアップファイルでの明示的 extend または `pnpm test` (vitest 直接) で回避。
2. **esbuild → oxc**: `@react-router/dev` が esbuild を指定しており Vite 8 で deprecated 警告。React Router 側の対応待ち。
3. **vite-tsconfig-paths 置換**: Vite 8 は `resolve.tsconfigPaths: true` をネイティブサポート。プラグイン不要になる。
4. **peer dep 対応**: `@react-router/dev` の peerDependencies に Vite 8 が追加されるまで `pnpm.overrides` で警告抑制可能。
5. **Biome 廃止**: vite-plus は lint/fmt を内蔵するが、この段階では追加していない。本格移行時に検討。
