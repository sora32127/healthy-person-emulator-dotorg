# 投稿プレビュー時に類似投稿を表示する機能

## Context

健常者エミュレータ事例集では似た内容の投稿が多い。投稿をブロックするのではなく、プレビューページで「類似度の高い投稿」を表示し、ユーザーに気づきを与えたい。

既存インフラとして Cloudflare Vectorize + embeddinggemma-300m による類似投稿検索が投稿詳細ページで使われており、これを投稿前チェックにも活用する。

## 方針

`firstSubmit` action（Wikify処理と同時）にフォーム入力テキストからembeddingを生成し、Vectorizeで類似投稿を検索。結果を `sessionStorage` 経由でプレビューページに渡し、上位5件を類似度スコア付きで表示する。

## 変更ファイル

### 1. `app/routes/_layout.post.tsx` — action + クライアント側

**action関数 (682行目〜):**
- `firstSubmit` action 内で、Wikify処理と並行して類似投稿検索を実行
- `getEmbedding()` と `querySimilar()` を `cloudflare.server.ts` から import して使用
- 入力テキストは既存の `getEmbeddingInputText` と同じフォーマット（`タイトル: ...\nタグ: ...\n本文: ...`）で組み立てる
  - `embedding.server.ts` の `getEmbeddingInputText` は private 関数なので、`_layout.post.tsx` にヘルパー関数 `buildSimilarSearchText` を追加
- API失敗時は空配列を返し、投稿フローをブロックしない
- レスポンスに `similarPosts: Array<{ postId, postTitle, score }>` を追加

**クライアント側 (147行目〜 useEffect):**
- `sessionStorage.previewData` に `similarPosts` を追加保存

### 2. `app/routes/_layout.post_.preview.tsx` — 型定義 + UI

**型定義:**
- `PreviewData` インターフェースに `similarPosts` フィールドを追加

**UI (プレビューカードと投稿ボタンの間):**
- `similarPosts.length > 0` の場合のみ表示
- DaisyUI `card` + `badge` + `link` で一覧表示
- 各投稿: タイトル（別タブリンク） + 類似度バッジ（パーセント表示）
- リンクは `/archives/{postId}` へ `target="_blank"`

## 実装順序（コミット単位）

1. **action に類似検索ロジック追加** — `_layout.post.tsx` の `firstSubmit` action を変更
2. **クライアント側で similarPosts を sessionStorage に保存** — 同ファイルの useEffect を変更
3. **プレビューページに類似投稿表示UIを追加** — `_layout.post_.preview.tsx` を変更

## エラーハンドリング

- サーバー: `try-catch` で API 失敗を捕捉 → 空配列返却（既存の `createEmbedding` と同パターン）
- クライアント: `?? []` で undefined ガード
- 表示: 0件時は非表示、古い sessionStorage データにも対応

## 既存コード再利用

| 関数 | ファイル | 用途 |
|---|---|---|
| `getEmbedding(text)` | `app/modules/cloudflare.server.ts` | テキスト→ベクトル変換 |
| `querySimilar(vector, topK)` | `app/modules/cloudflare.server.ts` | ベクトル類似検索 |

## 検証方法

1. `pnpm build` でビルドエラーがないこと
2. `pnpm lint` でlintエラーがないこと
3. ローカル起動（`pnpm start:local`）でフォーム入力→プレビュー遷移が正常に動作すること（ローカルではAPI不可のため類似投稿は空になるが、エラーにならないこと）
4. リモートバインディング使用（`pnpm start:remote`）で実際に類似投稿が表示されること

## 実施結果

### コミット
1. `d44f8d2` — firstSubmit actionに類似投稿検索ロジックを追加
2. `164ec4b` — プレビューページに類似投稿の表示UIを追加
3. `4808a22` — 並列化をPromise.allに変更、スコアの二重丸めを修正

### プランからの変更点
- ヘルパー関数名を `buildSimilarSearchText` → `searchSimilarPosts` に変更。テキスト生成だけでなくembedding取得+類似検索までを1つの関数にまとめた
- レビューで指摘された二重丸め問題を修正（サーバー側では生スコアを保持、UI表示時のみ丸める）
- `Promise.all` で Wikify と類似検索を並列実行するよう改善

### 未対応の既存課題（レビューで発見）
- `Wikify` 関数でユーザー入力をHTMLエスケープせずに埋め込んでいる（既存XSSリスク、今回のスコープ外）
- `sessionStorage` から読んだデータの型検証がない（既存問題、今回のスコープ外）
