# 投稿フォーム改修: プレビューページ遷移 + 類似記事表示

## Context

現在、投稿フォーム(`/post`)では「投稿する」ボタンを押すとモーダル（ポップアップ）でプレビューが表示される。これを通常のページ遷移に変更し、プレビューページで類似記事をベクトル検索で表示する。

## 変更方針

### 1. プレビューをモーダル → ページ遷移に変更

**新フロー:**
```
/post (フォーム入力)
  → バリデーション通過 → localStorage即時保存 → /post/confirm に navigate
  → /post/confirm (プレビュー + 類似記事)
    → 「修正する」→ /post に戻る（localStorageからフォーム復元）
    → 「投稿する」→ DB保存 → /archives/:postId にリダイレクト
```

**フォームデータ受け渡し方法: localStorage**
- 既にフォームデータが `post-form` キーで5秒ごとlocalStorageに保存されている
- 「プレビュー」ボタン押下時に即時保存してから遷移
- 追加インフラ不要で最もシンプル

### 2. プレビュー段階で類似記事表示（ベクトル検索）

**既存インフラを再利用:**
- `getEmbedding(text)` → Workers AI でベクトル生成 (`cloudflare.server.ts:87`)
- `querySimilar(vector, topK)` → Vectorize で類似検索 (`cloudflare.server.ts:148`)
- 投稿前なのでpostIdがない → テキストから直接ベクトル生成して検索

**類似記事の表示:** 情報表示のみ（タイトル + リンクのリスト）。投稿ブロックはしない。

## 実装詳細

### ファイル1: `app/utils/wikify.server.ts` (新規)

`_layout.post.tsx` の末尾にある `Wikify()` 関数（930-1030行）を切り出す。確認ページからも呼び出すため共有化する。

```typescript
// Wikify関数 + removeEmptyString をそのまま移動
// NodeHtmlMarkdown のimportも移動
export async function Wikify(postData, postFormSchema) { ... }
```

### ファイル2: `app/modules/db.server.ts` (変更)

`getSimilarPostsByText()` 関数を追加:

```typescript
export async function getSimilarPostsByText(text: string): Promise<SimilarPostsData[]> {
  try {
    const { getEmbedding, querySimilar } = await import('./cloudflare.server');
    const vector = await getEmbedding(text);
    const matches = await querySimilar(vector, 16);
    return matches
      .slice(0, 15)
      .map((m) => ({
        postId: Number(m.metadata?.postId ?? m.id),
        postTitle: String(m.metadata?.postTitle ?? ''),
      }));
  } catch (error) {
    console.warn('getSimilarPostsByText failed:', (error as Error).message);
    return [];
  }
}
```

### ファイル3: `app/routes/_layout.post.confirm.tsx` (新規)

**action** (3つの `_action` を処理):
- `getPreview`: フォームデータを受け取り → `Wikify()` でHTML生成 → 返却
- `getSimilarPosts`: テキストを受け取り → `getSimilarPostsByText()` で類似検索 → 返却
- `submitPost`: フォームデータを受け取り → DB保存 + embedding生成 + AI審査 → リダイレクト（現行 `secondSubmit` と同じロジック）

**loader:**
- `isUserValid(request)` チェック → 無効なら `/post` にリダイレクト

**コンポーネント:**
```
ConfirmPage mount
  ├── useEffect: localStorage('post-form')からフォームデータ読み込み
  │   └── データなし → navigate('/post')
  ├── useFetcher('getPreview'): Wikify呼び出し → HTML表示
  ├── useFetcher('getSimilarPosts'): Wikify完了後にembedding検索 → 類似記事リスト表示
  ├── 「修正する」ボタン → navigate('/post')
  ├── クリップボードコピーボタン
  └── 「投稿する」ボタン → submitPost実行
```

**類似記事の入力テキスト:**
`embedding.server.ts` の `getEmbeddingInputText()` と同じ形式:
```
タイトル: ${title}\nタグ: ${[...selectedTags, ...createdTags].join(',')}\n本文: ${wikifiedHTML}
```

**類似記事UIは既存パターンを踏襲** (`_layout.archives.$postId.tsx:437-446`):
```jsx
<H2>類似した記事</H2>
<ul className="list-disc list-outside mb-4 ml-4">
  {similarPosts.map(post => (
    <li key={post.postId}>
      <CommonNavLink to={`/archives/${post.postId}`}>{post.postTitle}</CommonNavLink>
    </li>
  ))}
</ul>
```

### ファイル4: `app/routes/_layout.post.tsx` (変更)

削除するもの:
- `Modal` import、`FaCopy` import
- `isPreviewModalOpen` state
- `firstSubmitFetcher`, `secondSubmitFetcher` と関連 useEffect (158-267行)
- `handleCopy`, `handleSecondSubmit`
- `isSecondSubmitButtonOpen` state
- モーダルJSX (425-465行)

変更するもの:
- `handleFirstSubmit` → `handlePreviewNavigate` にリネーム
  - Zodバリデーション通過後、fetcherではなく `localStorage.setItem` + `navigate('/post/confirm')` に変更
- ボタンラベル「投稿する」→「プレビュー」
- action から `firstSubmit`, `secondSubmit` 分岐を削除（確認ページ側に移動）
  - `validateTurnstile` のみ残す
- `Wikify` 関数を削除（`wikify.server.ts` に移動済み）

## 対象外

- 編集フォーム (`/archives/edit/:postId`) は今回変更しない

---

## UI/UX 設計ガイドライン

### ステップインジケータ

確認ページ(`/post/confirm`)にはステップインジケータを表示し、ユーザーが投稿フローのどこにいるか視覚的に示す。

```
[1. 入力] ──── [2. 確認 (現在)] ──── [3. 完了]
```

**実装:**
```jsx
<div className="flex items-center justify-center gap-2 mb-8">
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-sm font-bold">1</div>
    <span className="text-sm text-base-content/60">入力</span>
  </div>
  <div className="w-8 h-px bg-base-300" />
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-bold">2</div>
    <span className="text-sm font-bold text-base-content">確認</span>
  </div>
  <div className="w-8 h-px bg-base-300" />
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-sm text-base-content/40">3</div>
    <span className="text-sm text-base-content/40">完了</span>
  </div>
</div>
```

### 確認ページのレイアウト構成

```
┌─────────────────────────────────────────┐
│  ステップインジケータ (1.入力 → 2.確認)  │
├─────────────────────────────────────────┤
│                                         │
│  [プレビュー領域]                        │
│  ┌─────────────────────────────────┐    │
│  │ H1: タイトル                     │    │
│  │ タグ一覧                         │    │
│  │ Wikified HTML プレビュー         │    │
│  │ (ローディング中はスケルトン)       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [類似記事セクション]                     │
│  ┌─────────────────────────────────┐    │
│  │ H2: 類似した記事                  │    │
│  │ (ローディング中はスケルトン)       │    │
│  │ ・記事タイトル1                   │    │
│  │ ・記事タイトル2                   │    │
│  │ ・...                            │    │
│  │ (0件の場合: 空欄表示なし)         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [アクションバー]                        │
│  ┌─────────────────────────────────┐    │
│  │  [修正する]  [コピー]  [投稿する] │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### ローディング状態 (Content Jumping 防止)

プレビューと類似記事は非同期取得のため、**スケルトンスクリーン**でレイアウトシフトを防止する。

**プレビュー領域のスケルトン:**
```jsx
{previewFetcher.state !== 'idle' ? (
  <div className="space-y-4 animate-pulse">
    <div className="h-8 bg-base-300 rounded w-3/4 mx-auto" />  {/* タイトル */}
    <div className="flex gap-2 justify-center">
      <div className="h-6 bg-base-300 rounded-full w-16" />    {/* タグ */}
      <div className="h-6 bg-base-300 rounded-full w-20" />
      <div className="h-6 bg-base-300 rounded-full w-14" />
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-base-300 rounded w-full" />       {/* 本文行 */}
      <div className="h-4 bg-base-300 rounded w-5/6" />
      <div className="h-4 bg-base-300 rounded w-4/5" />
      <div className="h-4 bg-base-300 rounded w-full" />
      <div className="h-4 bg-base-300 rounded w-2/3" />
    </div>
  </div>
) : (
  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
)}
```

**類似記事セクションのスケルトン:**
```jsx
{similarPostsFetcher.state !== 'idle' ? (
  <div className="space-y-3 animate-pulse">
    <div className="h-6 bg-base-300 rounded w-32" />           {/* H2 */}
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-4 bg-base-300 rounded w-4/5 ml-4" />
    ))}
  </div>
) : similarPosts.length > 0 ? (
  <>
    <H2>類似した記事</H2>
    <ul className="list-disc list-outside mb-4 ml-4">...</ul>
  </>
) : null}
```

**`prefers-reduced-motion` 対応:** `animate-pulse` はTailwindがデフォルトで `prefers-reduced-motion: reduce` 時にアニメーションを無効化するため、追加対応は不要。

### ボタン設計

既存のDaisyUIクラスに準拠する。

| ボタン | クラス | 状態管理 |
|--------|--------|----------|
| プレビュー (`/post`) | `btn btn-primary` | Turnstile未通過 → `disabled:btn-disabled` |
| 修正する (`/post/confirm`) | `btn btn-secondary` | 常に有効 |
| コピー (`/post/confirm`) | `btn btn-circle btn-ghost` + Lucideの`Copy`アイコン | コピー後アイコンを`Check`に切替(1.5秒) |
| 投稿する (`/post/confirm`) | `btn btn-primary` | 送信中 → `disabled` + `loading`クラス (DaisyUI spinner) |

**投稿ボタンのローディング状態:**
```jsx
<button
  className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}
  disabled={isSubmitting}
  onClick={handleSubmit}
>
  {isSubmitting ? '投稿中...' : '投稿する'}
</button>
```

**コピーボタンのフィードバック:**
```jsx
const [isCopied, setIsCopied] = useState(false);
const handleCopy = async () => {
  await navigator.clipboard.writeText(previewText);
  setIsCopied(true);
  setTimeout(() => setIsCopied(false), 1500);
};

<button className="btn btn-circle btn-ghost" onClick={handleCopy}>
  {isCopied ? <Check className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5" />}
</button>
```

### アクションバーの配置

アクションボタン群はページ下部に固定し、スクロールしても常にアクセス可能にする。

```jsx
<div className="sticky bottom-0 bg-base-100 border-t border-base-300 p-4 -mx-4">
  <div className="flex items-center justify-between max-w-3xl mx-auto">
    <button className="btn btn-secondary" onClick={() => navigate('/post')}>
      修正する
    </button>
    <div className="flex items-center gap-2">
      <button className="btn btn-circle btn-ghost" onClick={handleCopy}>
        {isCopied ? <Check className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5" />}
      </button>
      <button
        className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}
        disabled={isSubmitting || previewFetcher.state !== 'idle'}
        onClick={handleSubmit}
      >
        {isSubmitting ? '投稿中...' : '投稿する'}
      </button>
    </div>
  </div>
</div>
```

**「投稿する」ボタンはプレビュー取得完了まで`disabled`** → プレビューを見ずに投稿するミスを防止。

### トースト通知 (既存パターン踏襲)

既存の `react-hot-toast` パターンをそのまま使う:
- 投稿成功: `toast.success('投稿しました。リダイレクトします...')`
- 投稿失敗: `toast.error(errorMessage)`
- コピー成功: ボタンアイコン切替で表現（トースト不要）

### エラーハンドリングのUI

| エラー | 表示方法 |
|--------|----------|
| localStorageにデータなし | `/post` にリダイレクト（トースト: `toast.error('フォームデータが見つかりません')`) |
| プレビュー取得失敗 | プレビュー領域にインラインエラー: `<p className="text-error">プレビューの取得に失敗しました</p>` + 「再試行」ボタン |
| 類似記事取得失敗 | セクションごと非表示（サイレント失敗、投稿フローをブロックしない） |
| 投稿失敗 | `toast.error(message)` + ボタン再有効化 |

### アクセシビリティ

- **キーボードナビゲーション:** Tab順序は `修正する → コピー → 投稿する` の順
- **フォーカスリング:** DaisyUIデフォルトの `focus-visible:outline` をそのまま活用
- **aria-label:** アイコンのみのコピーボタンに `aria-label="プレビューをクリップボードにコピー"` を付与
- **ローディング中のaria:** スケルトン表示中は `aria-busy="true"` を親要素に設定

---

## ビルド順序

1. `app/utils/wikify.server.ts` を作成（Wikify関数の切り出し）
2. `app/modules/db.server.ts` に `getSimilarPostsByText()` を追加
3. `app/routes/_layout.post.confirm.tsx` を新規作成（UI/UXガイドラインに従い実装）
4. `app/routes/_layout.post.tsx` からモーダル関連コードを削除・変更
5. 型チェック (`npx tsc --noEmit`)
6. ローカル動作確認

## 検証方法

### 機能テスト
1. `npx tsc --noEmit` で型エラーがないこと
2. `/post` でフォーム入力 → 「プレビュー」ボタン → `/post/confirm` に遷移すること
3. プレビューページでHTML表示 + 類似記事リストが表示されること
4. 「修正する」で `/post` に戻り、フォーム内容が保持されていること
5. 「投稿する」で記事が保存され `/archives/:postId` にリダイレクトされること
6. Turnstile未通過の場合、「プレビュー」ボタンが無効であること
7. セッションが無効な場合、確認ページから `/post` にリダイレクトされること

### UI/UX テスト
8. ステップインジケータが現在のステップ(確認)をハイライトしていること
9. プレビュー取得中にスケルトンスクリーンが表示され、レイアウトシフトが起きないこと
10. 類似記事取得中にスケルトンが表示されること
11. 「投稿する」ボタンがプレビュー取得完了前は`disabled`であること
12. 投稿中にボタンがローディング表示になり、二重送信できないこと
13. コピーボタン押下後、アイコンがチェックマークに切り替わること
14. アクションバーがスクロール時もstickyで表示されること
15. コピーボタンに`aria-label`が設定されていること
16. モバイル(375px)でレイアウトが崩れないこと

## 対象外

- 編集フォーム (`/archives/edit/:postId`) は今回変更しない
