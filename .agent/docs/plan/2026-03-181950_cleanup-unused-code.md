# 不要コード・パッケージ整理

## Context

Cloud Run + Supabase → Cloudflare Workers + D1 移行完了後、不要なスクリプト・未使用エクスポート・不要パッケージを整理する。knip v5.71.0 の検出結果 + 手動調査に基づく。Codexレビューにて差し戻しを受け、フェーズ分離・検証強化・削除方針の統一を反映した改訂版。

---

## Phase 1: 確実に安全な削除（即実行）

### 1a. 不要パッケージ削除

| パッケージ | 種別         | 根拠                                 |
| ---------- | ------------ | ------------------------------------ |
| `chalk`    | dependencies | コード中にimportなし。grepで確認済み |

### 1b. 未使用 export 削除（完全に追跡済み）

**`app/modules/db.server.ts`**:

- `PostCardDataSchema`, `CommentShowCardDataSchema` の re-export 削除（外部importなし）
- `getRecentComments` wrapper 削除（routesからの利用なし）

**`app/repositories/types.ts`**:

- `PostCardDataSchema`, `CommentShowCardDataSchema` の export 削除

**`app/modules/auth.google.server.ts`**:

- `getAuthenticatorInstance` の `export` キーワード削除（関数自体は内部利用あり）

### 1c. `*ForTest` 系一括削除（interface + export + 実装すべて）

テストから一切呼ばれていないことをgrepで確認済み。中途半端に残さず一括削除。

| ファイル                        | 削除対象                                                      |
| ------------------------------- | ------------------------------------------------------------- |
| `app/modules/db.server.ts`      | 7つの `*ForTest` wrapper関数（line 85-91）                    |
| `app/repositories/types.ts`     | `DatabaseRepository` interfaceの7つの `*ForTest` メソッド定義 |
| `app/repositories/d1.server.ts` | 7つの `*ForTest` メソッド実装                                 |

### 1d. knip.json 設定更新

- `ignoreDependencies` から Remix関連3パッケージ削除（既にpackage.jsonに存在しない）
- `ignore` に `worker.ts`, `container-worker.ts` 追加（wrangler entry pointの誤検出防止）

---

### 1e. 旧スタック残骸の削除

| 対象                         | 理由                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `supabase/` ディレクトリ全体 | Supabase→D1移行完了。config.toml, .gitignore, 空のseed.sqlのみ                            |
| `.dockerignore`              | ルートのDockerfileは存在せず、container/Dockerfileは独自ディレクトリ。旧Cloud Run用の残骸 |

### 1f. 移行・POCスクリプト完全削除（6件）

git履歴から復元可能。ユーザー確認済み。

| ファイル                                     | 理由                  |
| -------------------------------------------- | --------------------- |
| `scripts/migrate-embeddings-to-vectorize.ts` | Vectorize移行完了済み |
| `scripts/migrate-pg-to-d1.ts`                | PG→D1移行完了済み     |
| `scripts/poc-d1-query-perf.ts`               | D1性能検証POC         |
| `scripts/poc-embedding-comparison.ts`        | Embedding比較POC      |
| `scripts/poc-row-size-check.ts`              | 行サイズ制約検証POC   |
| `scripts/poc-similar-articles-preview.ts`    | 類似記事プレビューPOC |

---

## Phase 2: 調査後に判断（実測で確認）

### 2a. `@types/marked`

- `marked` 本体が型を内包しているか確認
- 判定: `pnpm remove @types/marked` → `pnpm typecheck` で確認。失敗したら即復元

### 2b. `@react-router/cloudflare`

- 直接importはないが、React Router 7 の Cloudflare adapter として暗黙的に必要な可能性
- 判定: `pnpm remove @react-router/cloudflare` → `pnpm typecheck` + `pnpm build` で確認
- **失敗したら即復元**

---

## Phase 3: 保留（今回は触らない）

| 対象                                   | 理由                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `deleteVectors` (cloudflare.server.ts) | 運用時の手動クリーンアップに使える可能性。低リスクだが削除メリットも小さい |

---

## 検証手順

各フェーズ完了後に以下を実行:

1. `pnpm knip` — 検出数が減っていることを確認
2. `pnpm typecheck` （react-router typegen + tsc）— 型エラーなし
3. `pnpm build` — ビルド成功
4. `pnpm test` — テスト通過

## 対象ファイル一覧

- `package.json` — chalk削除
- `knip.json` — 設定更新
- `app/modules/db.server.ts` — re-export + wrapper削除
- `app/modules/auth.google.server.ts` — export削除
- `app/repositories/types.ts` — export + interface削除
- `app/repositories/d1.server.ts` — ForTest実装削除
- `scripts/` 配下6ファイル — 完全削除
- `supabase/` ディレクトリ — 完全削除
- `.dockerignore` — 完全削除

---

## 実施結果

### 実施内容

Phase 1, 2 すべて実施。Phase 3 は計画通り保留。

### Phase 1 結果

- ✅ `chalk` 削除
- ✅ 未使用export 14件削除（db.server.ts, types.ts, auth.google.server.ts, d1.server.ts）
- ✅ `*ForTest` 系 interface + export + 実装を一括削除
- ✅ knip.json 更新（Remix ignoreDependencies削除、wrangler entry point ignore追加）
- ✅ `supabase/` ディレクトリ・`.dockerignore` 削除
- ✅ 移行・POCスクリプト6件削除

### Phase 2 結果

- ✅ `@types/marked` 削除 — `pnpm remove` 時にdeprecated警告あり、`marked`本体が型を内包していることが判明。問題なし
- ✅ `@react-router/cloudflare` 削除 — ビルド・テストとも成功。暗黙的な依存はなかった

### プランからの変更点

- Phase 2a の `@types/marked` は調査不要で即削除可能だった（pnpm removeの警告でstub typesと判明）
- `PostCardDataSchema` / `CommentShowCardDataSchema` は db.server.ts の re-export 削除だけでなく、types.ts の定義元の `export` キーワードも削除が必要だった（初回knipで検出）
- knip.json の `ignore` に `automation.server.ts` / `d1-export.server.ts` も追加（worker.tsからの動的import）

### 検証結果

- `pnpm knip`: 残りは既知の保留事項のみ（deleteVectors, wrangler/prisma unlisted）
- `pnpm typecheck`: 変更ファイル由来のエラーなし（36件の既存エラーは変更前と同数）
- `pnpm build`: 成功
- `pnpm test`: 3ファイル7テスト全通過

### スキル提案

- knip.json の wrangler entry point 対応は今後も発生しうる。Cloudflare Workers 特有の entry point パターンをknipに認識させるカスタムプラグインか、CLAUDE.md への注意事項追記を検討
