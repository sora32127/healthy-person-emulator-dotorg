# E2E テスト（Playwright Agent Skills）メモ

作成日: 2026-02-28

## 前提：使用するスキル

**Anthropic Agent Skills の `webapp-testing` スキルを使う。**

未インストールの場合は以下で導入：

```
/plugin install webapp-testing@anthropic-agent-skills
```

このスキルは Python Playwright + `with_server.py` ヘルパーを使って
ブラウザ操作・スクリーンショット・DOM 検査をエージェントが自律的に行う。
既存の TypeScript テストファイル（`tests/*.spec.ts`）とは別の仕組み。

---

## 既存のテストケース一覧（参照用）

`tests/*.spec.ts` は TypeScript で書かれた既存テスト。
webapp-testing スキルでテストを実装する際の **仕様書・参照ドキュメント** として使う。

| ファイル | カバー範囲 |
|---------|-----------|
| `readOnlyTest.spec.ts` | トップページ・フィード・検索・各種静的ページの閲覧 |
| `writeTest.spec.ts` | 投稿フォームのバリデーション・投稿完了・フォームクリア |
| `searchResponsiveness.spec.ts` | 検索のレスポンシブ挙動 |
| `axeTest.spec.ts` | axe-core によるアクセシビリティ検査 |

---

## ローカル E2E テスト

### 目的

- 移行（React Router v7 / Cloudflare）後のデグレード確認
- 実装中の機能の動作確認

### 実行方法

webapp-testing スキルを有効化した Claude Code で、以下のように依頼する：

```
# 例
「webapp-testing スキルを使って、localhost:3000 のトップページが
 正しく表示されているか確認して」

「webapp-testing スキルで pnpm dev を起動した上で、
 投稿フォームのバリデーションが正常に動くか検証して」
```

スキル内部では `with_server.py` がサーバーを自動起動・管理する：

```bash
# スキルが内部で行う処理のイメージ
python scripts/with_server.py \
  --server "pnpm dev" --port 3000 \
  -- python your_test.py
```

### ローカルでテストすべき内容

| テストカテゴリ | 参照ファイル | 優先度 |
|-------------|------------|--------|
| トップページ表示 | `readOnlyTest.spec.ts` | 高 |
| フィードページ・ページネーション | `readOnlyTest.spec.ts` | 高 |
| 検索（DuckDB-WASM） | `readOnlyTest.spec.ts` | 高 |
| 投稿フォーム（バリデーション） | `writeTest.spec.ts` | 高 |
| 投稿フォーム（投稿完了） | `writeTest.spec.ts` | 中 |
| アクセシビリティ | `axeTest.spec.ts` | 中 |

### CAPTCHA（Cloudflare Turnstile）の注意

`writeTest.spec.ts` 相当の投稿テストは CAPTCHA が壁になる。
ローカル環境の `.env` に Turnstile のテスト用キーを設定すること：

```env
CF_TURNSTILE_SITEKEY=1x00000000000000000000AA   # 常に成功するテスト用キー
CF_TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

---

## リリース後 E2E テスト（本番確認）

### 目的

- Cloudflare 移行完了後の本番動作確認
- デプロイ後のスモークテスト

### 実行方法

本番サーバーはすでに起動しているので `with_server.py` は不要。
Reconnaissance-then-action パターンで直接検査する：

```
「webapp-testing スキルを使って、
 https://healthy-person-emulator.org のトップページと
 検索ページが正常に動作しているか確認して」
```

### 本番で実行すべき／すべきでないテスト

| テストカテゴリ | 本番実行 | 理由 |
|-------------|---------|------|
| トップページ・フィード閲覧 | ✅ | 読み取りのみ、副作用なし |
| 検索（DuckDB-WASM） | ✅ | 読み取りのみ |
| アクセシビリティ | ✅ | 読み取りのみ |
| 投稿フォーム（送信） | ⚠️ 慎重に | 本番 DB に実際の投稿が作成される |

投稿テストを本番で実行する場合は、テスト後に作成された投稿を削除すること。

---

## 移行フェーズ別の活用方針

### React Router v7 移行時

1. 移行前に主要ページをスクリーンショットで記録（ベースライン）
2. 移行後に同じページを再確認してデグレードがないことを目視確認
3. 特にルーティング・フォーム送信・セッションが絡む箇所を重点的に

### Cloudflare 移行時

1. Cloudflare Pages のプレビュー URL に対して E2E テストを実行
2. 本番デプロイ後に読み取り系テストで最終確認
3. DuckDB-WASM 検索は R2 URL 変更後に動作確認が特に重要

---

## 参考：webapp-testing スキルの動作概要

```
ユーザーの依頼
  └→ Claude がスキルを起動
      └→ with_server.py でサーバー起動（ローカルの場合）
          └→ Python Playwright で DOM 検査・操作
              └→ スクリーンショット・ログを返却
                  └→ Claude が結果を報告
```

- `page.wait_for_load_state('networkidle')` で JS 実行完了を待つ
- DuckDB-WASM のような重い初期化がある検索ページは待機時間を長めに設定
