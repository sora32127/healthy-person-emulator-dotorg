# Test Selection

このファイルは入口だけを担う。最初にこれを読み、必要なシナリオだけ開く。

## 変更種別ごとの最小セット

### 1. グローバルUI変更

対象例:

- ヘッダー
- モバイルメニュー
- フッター
- テーマ切替
- 共通レイアウト

読むファイル:

- `references/pages/top-page.md`
- `references/pages/support-page.md`
- `references/pages/readme-page.md`

理由:

- 共通レイアウトは [\_layout.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/routes/_layout.tsx) に集約され、トップ、サポート、サイト説明の3種を見れば導線と静的ページの回帰を拾いやすい。

### 2. トップ系変更

対象例:

- `/`
- `/?tab=fixed`
- `/?tab=random`
- 投稿カード
- コメントカード

読むファイル:

- `references/pages/top-page.md`

### 3. 静的コンテンツページ変更

対象例:

- `/support`
- `/readme`
- 文言修正
- 外部リンク修正

読むファイル:

- `/support` だけなら `references/pages/support-page.md`
- `/readme` だけなら `references/pages/readme-page.md`
- 共通レイアウトも触っているなら両方

### 4. 投稿フォーム変更

対象例:

- `/post`
- バリデーション
- Turnstile
- プレビュー
- タグ選択
- localStorage 保存

読むファイル:

- `references/pages/post-page.md`

### 5. 記事詳細変更

対象例:

- `/archives/:postId`
- like/dislike
- ブックマーク
- コメント
- 共有ボタン
- 関連記事

読むファイル:

- `references/pages/article-page.md`

### 6. 記事カードや一覧UI変更

対象例:

- `PostCard`
- `PostSection`
- 一覧導線

読むファイル:

- `references/pages/top-page.md`
- 必要なら `references/pages/article-page.md`

理由:

- カードはトップ、固定、ランダムで広く使われる。
- 記事詳細への遷移も合わせて確認すると回帰が見つかりやすい。

## このリポジトリで毎回は不要なもの

- 全ページ横断のフル回帰
- 投稿成功フローの毎回実行
- コメント送信の毎回実行
- ランダムページの複数回リロード

これらは、変更箇所が近いときだけ読む。
