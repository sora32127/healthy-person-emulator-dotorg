# 投稿フォームUI/UX改善プラン

## Context

投稿フォーム (`/post`) のUI/UXを改善する。現状の問題:

- エラーメッセージが `react-hot-toast` のトーストで表示され、どのフィールドに問題があるか分かりにくい
- プレビューがモーダル内で、画面が狭くスクロールしづらい
- フォームが非常に長いのに進捗が分からない

## 変更方針

### 1. エラーメッセージのインライン化（toast完全廃止）

**対象**: `app/routes/_layout.post.tsx`

- `react-hot-toast` の `toast.error()` / `toast.loading()` / `toast.success()` を全削除
- `<Toaster />` コンポーネントを削除
- `handleFirstSubmit` で `methods.trigger()` を使い、react-hook-form のエラー状態を発火させる
  - `zodResolver` が既に設定済みなので `trigger()` だけで `formState.errors` が更新される
- フォーム上部に `ErrorSummary` コンポーネントを追加（エラー一覧表示）
- 既存の `ErrorMessageContainer` パターン（L787-793）を全フィールドに展開
- ローディング状態は `isPreviewLoading` state で管理し、ボタンにスピナー表示

### 2. プレビューページ化（/post/preview）

**新規作成**: `app/routes/_layout.post_.preview.tsx`

- データ受け渡し: `firstSubmit` レスポンスのHTML + フォーム値を `sessionStorage` に書き込み → `navigate('/post/preview')`
- プレビューページで `sessionStorage` から読み出してHTML表示
- 「修正する」→ `navigate('/post')`（既存localStorage自動保存でフォーム値復元）
- 「投稿する」→ `secondSubmit` を実行 → 成功後 `/archives/{postId}` へリダイレクト
- Markdownコピーボタンも移設

sessionStorage データ構造:

```typescript
interface PreviewData {
  wikifiedHtml: string;
  markdownResult: string;
  title: string;
  tags: string[];
  formValues: z.infer<typeof postFormSchema>; // secondSubmit用
}
```

### 3. Turnstile をプレビューページに移動

- `/post` から Turnstile ウィジェット・`isFirstSubmitButtonOpen` state を削除
- `/post/preview` に Turnstile を配置
- `validateTurnstile` action は `/post/preview` の action に移設
- 投稿直前に認証するフローに変更

### 4. フォームプログレスバー

**新規作成**: `app/components/SubmitFormComponents/FormProgressBar.tsx`

- DaisyUI `steps` コンポーネントでセクション進捗を表示
- `IntersectionObserver` で現在のアクティブセクション検出
- `sticky top-16 z-10`（ヘッダー下）で常時表示
- セクション: 投稿タイプ / 状況説明 / ブレイクポイント等 / タグ・タイトル

### 5. スティッキー投稿ボタン

**新規作成**: `app/components/SubmitFormComponents/StickySubmitBar.tsx`

- `sticky bottom-0` でフォーム下部に常時表示
- 「プレビューする」ボタン + ローディングスピナー
- ボタンテキストを「投稿する」→「プレビューする」に変更（投稿はプレビューページで行うため）

### 6. `_layout.tsx` の toast 撤去

**対象**: `app/routes/_layout.tsx`

- `Toaster` コンポーネント (L277) 削除
- `toast.success('ログインしました')` (L271) → DaisyUI `alert alert-success` のインラインバナーに変更
- `react-hot-toast` の import 削除
- 注: 他ファイル（archives, ShareApiButton, CopyToClipboard, TurnstileModal）はスコープ外

## ファイル一覧

### 新規作成

| ファイル                                                  | 責務                                              |
| --------------------------------------------------------- | ------------------------------------------------- |
| `app/routes/_layout.post_.preview.tsx`                    | プレビューページ（HTML表示・Turnstile・投稿実行） |
| `app/components/SubmitFormComponents/FormProgressBar.tsx` | セクション進捗バー                                |
| `app/components/SubmitFormComponents/StickySubmitBar.tsx` | スティッキー投稿ボタン                            |
| `app/components/SubmitFormComponents/ErrorSummary.tsx`    | エラー一覧サマリー                                |

### 変更

| ファイル                      | 変更内容                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `app/routes/_layout.post.tsx` | toast撤去、Modal撤去、secondSubmit削除、sessionStorage書込み+navigate追加、ErrorSummary/FormProgressBar/StickySubmitBar組込み |
| `app/routes/_layout.tsx`      | Toaster削除、ログイン成功通知をインラインバナーに                                                                             |

### 削除候補

| ファイル                        | 理由                                      |
| ------------------------------- | ----------------------------------------- |
| `app/utils/makeToastMessage.ts` | toast廃止で不要（他で使われていなければ） |

## 再利用する既存コード

- `ErrorMessageContainer` (`_layout.post.tsx` L787-793): インラインエラー表示パターン
- `Wikify()` 関数 (`_layout.post.tsx` L930-1030): プレビューページのactionでも使用
- `createPostFormSchema` (`app/schemas/post.schema.ts`): プレビューページのactionでも使用
- `isUserValid` / `getSession` / `commitSession` (`app/modules/session.server.ts`): セッション管理
- `createPostWithTags` / `getStopWords` (`app/modules/db.server.ts`): DB操作
- `createEmbedding` (`app/modules/embedding.server.ts`): ベクトルDB
- `getJudgeWelcomedByGenerativeAI` / `validateRequest` / `getTurnStileSiteKey` / `getHashedUserIPAddress` (`app/modules/security.server.ts`): セキュリティ

## 実装順序とコミット戦略

CLAUDE.mdのルールに従い、**1つの論理的な変更単位ごとにコミット**する。未コミット変更が50行を超えたら即コミット。

### Commit 1: `feat: ErrorSummaryコンポーネントを作成`

- `app/components/SubmitFormComponents/ErrorSummary.tsx` を新規作成

### Commit 2: `feat: FormProgressBarコンポーネントを作成`

- `app/components/SubmitFormComponents/FormProgressBar.tsx` を新規作成

### Commit 3: `feat: StickySubmitBarコンポーネントを作成`

- `app/components/SubmitFormComponents/StickySubmitBar.tsx` を新規作成

### Commit 4: `refactor: /postページからtoast/Modalを撤去しインラインエラーに移行`

- `app/routes/_layout.post.tsx` の変更:
  - toast/Toaster/Modal/MakeToastMessage のimport削除
  - handleFirstSubmit を methods.trigger() ベースに変更
  - secondSubmitFetcher/handleSecondSubmit/handleCopy/isPreviewModalOpen 関連削除
  - Turnstile/isFirstSubmitButtonOpen 削除
  - ErrorSummary/FormProgressBar/StickySubmitBar を組込み
  - firstSubmitFetcher 成功時に sessionStorage 書込み + navigate('/post/preview')
  - 各セクション div に id 属性追加
- 注: この変更は大きいが、toast撤去とインラインエラー導入は1つの論理単位

### Commit 5: `feat: /post/previewプレビューページを作成`

- `app/routes/_layout.post_.preview.tsx` を新規作成
  - loader: getTurnStileSiteKey
  - action: validateTurnstile + secondSubmit（\_layout.post.tsx から移設）
  - UI: sessionStorage読込、HTML表示、Turnstile、投稿ボタン、修正ボタン、コピーボタン

### Commit 6: `refactor: _layout.tsxからToasterを削除しログイン通知をインライン化`

- `app/routes/_layout.tsx` の変更:
  - Toaster/toast import削除
  - ログイン成功通知を alert-success バナーに変更

### Commit 7: `chore: 不要になったmakeToastMessage.tsを削除`

- `app/utils/makeToastMessage.ts` を削除（他で参照されていない場合）

## 検証方法

1. `pnpm dev` でローカル起動
2. `/post` でフォームを空のまま「プレビューする」→ インラインエラーが各フィールド下+上部サマリーに表示されること
3. フォームを正しく入力して「プレビューする」→ `/post/preview` に遷移しHTMLプレビューが表示されること
4. プレビューページで「修正する」→ `/post` に戻りフォーム値がlocalStorageから復元されていること
5. プレビューページでTurnstile認証完了後「投稿する」が有効になること
6. フォーム操作中にトーストが一切表示されないこと
7. プログレスバーがスクロールに応じて更新されること
8. スティッキーボタンがフォーム下部に常時表示されること
