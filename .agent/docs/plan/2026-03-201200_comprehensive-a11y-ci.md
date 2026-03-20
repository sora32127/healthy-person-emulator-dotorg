# 包括的a11y・カラーコントラストチェックのCI自動化

## Context

現在のa11yテストはコンポーネント単位（VoteButton, Footer等）でaxe-coreを実行しているが、2つの問題がある：
1. 新コンポーネント追加時にテスト追記を忘れると検出漏れ
2. happy-dom環境ではCSSが計算されずカラーコントラストチェックが効かない

→ **Playwright + @axe-core/playwright でプレビュー環境に対してページ単位のE2E a11yテストを実行する**

## 実装方針

### Playwright + axe-core でプレビュー環境の全公開ページをチェック

- `app/routes/_layout.*.tsx` を動的に走査し、テスト対象URLを自動生成
- パラメータ付き（`$postId`等）、API、認証ルートは自動除外
- 新ルート追加時、テスト追記不要で自動的にカバーされる
- 実ブラウザ (Chromium) でレンダリングするためカラーコントラストも正確にチェック
- **ライトモード・ダークモード両方でチェック**（`page.emulateMedia({ colorScheme })` で切替）
- WCAG 2.1 AA 基準
- **プレビュー環境（`https://preview.healthy-person-emulator.org`）に対して実行** — 実データが存在するためリアルなチェックが可能

### テスト対象（自動検出）

| URL | ルートファイル |
|---|---|
| `/` | `_layout._index.tsx` |
| `/post` | `_layout.post.tsx` |
| `/search` | `_layout.search.tsx` |
| `/readme` | `_layout.readme.tsx` |
| `/privacyPolicy` | `_layout.privacyPolicy.tsx` |
| `/commerceDisclosure` | `_layout.commerceDisclosure.tsx` |
| `/support` | `_layout.support.tsx` |

自動除外: パラメータ付き(`$`)、API(`api.*`)、認証(`auth.*`, `logout`, `signup.*`, `*Verified`)、非HTML(`feed[.]xml`, `sitemap[.]xml`)、`bookmark`、`comment`、`editHistory`、`feed`、`random`（DB依存/リダイレクト系）

### CI実行方式

- `preview-deploy.yml` の deploy job 完了後に a11y job を実行
- プレビュー環境のURLは固定: `https://preview.healthy-person-emulator.org`
- ローカルサーバー起動不要。実データあり

## 実装ステップ

### Step 1: パッケージ追加
```
pnpm add -D @playwright/test @axe-core/playwright
```

### Step 2: `playwright.config.ts` 作成
- `testDir: 'e2e'`
- `baseURL`: 環境変数 `BASE_URL` またはデフォルト `https://preview.healthy-person-emulator.org`
- chromium のみ（a11y目的なのでクロスブラウザ不要）
- webServer 設定なし（外部URLに対してテスト）

### Step 3: `e2e/a11y.spec.ts` 作成
- `app/routes/` を走査してテスト対象URL動的生成
- 各ページ × 各テーマ（light/dark）の組み合わせでテスト生成
- `page.emulateMedia({ colorScheme: 'light' or 'dark' })` で切替後に `AxeBuilder` で WCAG 2.1 AA チェック
- ダークモードでのコントラスト不足も自動検出

### Step 4: `package.json` にスクリプト追加
```json
"test:a11y": "playwright test"
```

### Step 5: `preview-deploy.yml` に a11y job 追加
- `deploy` job の後に `a11y` job を追加（`needs: deploy`）
- Playwright chromium インストール → プレビューURLに対してテスト実行

### Step 6: 既存 `app/components/a11y.test.tsx` の扱い
- E2Eでページ全体をカバーするため削除

## 変更対象ファイル
- `package.json` — devDependencies追加、スクリプト追加
- `playwright.config.ts` — 新規作成
- `e2e/a11y.spec.ts` — 新規作成
- `.github/workflows/preview-deploy.yml` — a11y job追加
- `app/components/a11y.test.tsx` — 削除

## 検証方法
1. ローカルで `BASE_URL=https://healthy-person-emulator.org pnpm test:a11y` を実行して本番に対してチェック
2. a11y違反がある場合、axeのレポートで具体的なルール・ノードが表示される
3. PRを作成しpreview-deploy後のa11y jobが正常動作することを確認

## 実施結果

### 実施した変更

1. **SVGアイコン修正**: 12個のSVGアイコンに `fill="currentColor"` を追加（ダークモード対応）
2. **info-contentカラー追加**: ライトテーマに `--color-info-content: #FFFFFF` を明示定義（追加ボタンのコントラスト修正）
3. **Playwright + @axe-core/playwright 導入**: `e2e/a11y.spec.ts` でルート自動走査 × light/dark チェック
4. **preview-deploy.yml に a11y job 追加**: deploy完了後にプレビュー環境に対してテスト実行
5. **サイドバーナビの aria-label 追加**: axeテストで検出された button-name/link-name 違反を修正
6. **vitest exclude に e2e を追加**: Playwright テストファイルの競合回避
7. **コンポーネント単体a11yテスト削除**: E2Eで包括的にカバーするため不要に

### プランからの変更点
- 当初は wrangler dev --local でテストする方針だったが、ユーザーの提案でプレビュー環境に変更（実データでのテスト精度向上）
- `vitest-axe` パッケージは vite-plus との互換性問題があり不採用。axe-core 直接利用に変更
- テスト実行で即座に検出されたサイドバーナビのa11y違反も修正した

### 今後の改善提案
- 記事詳細ページ（`/archives/:postId`）もテスト対象に追加するスキルまたは設定（固定の記事IDを使用）
- axeの結果をGitHub PRコメントにサマリ表示するレポート機能
