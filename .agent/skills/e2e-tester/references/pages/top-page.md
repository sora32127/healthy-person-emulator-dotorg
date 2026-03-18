# Top Page Scenarios

対象実装:
- [_layout._index.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/routes/_layout._index.tsx)
- [_layout.random.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/routes/_layout.random.tsx)
- [PostSection.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/components/PostSection.tsx)
- [PostCard.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/components/PostCard.tsx)
- [CommentSection.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/components/CommentSection.tsx)
- [_layout.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/routes/_layout.tsx)
- [itemMenu.ts](/Users/sorachi/code/healthy-person-emulator-dotorg/app/utils/itemMenu.ts)

## シナリオ T1: トップ `trend` タブの初期表示

- `/` を開く
- 「最新の投稿」「最近いいねされた投稿」「最近のコメント」の3セクションが見えることを確認する
- 各セクションに少なくとも1件のカードが描画されることを確認する
- 投稿カードで日時、like/dislike数、コメント数、タグ表示が崩れていないことを確認する

## シナリオ T2: トップから一覧導線へ移動

- `/` を開く
- 「最新の投稿を見る」を押して `/feed?p=2&type=timeDesc` に遷移することを確認する
- 戻る
- 「最近いいねされた投稿を見る」を押して `/feed?p=2&likeFrom=48&likeTo=0&type=likes` に遷移することを確認する
- 戻る
- 「最近のコメントを見る」を押して `/comment?p=2&type=timeDesc` に遷移することを確認する

## シナリオ T3: 固定ページタブ

- `/?tab=fixed` を開く
- 「殿堂入り」「コミュニティ選」の2セクションが表示されることを確認する
- それぞれのカードから記事詳細へ遷移できることを確認する
- 戻ったあとも `tab=fixed` のまま表示されることを確認する

## シナリオ T4: ランダムタブ

- `/random` にアクセスする
- `/?tab=random` へリダイレクトされることを確認する
- 「ランダム投稿」「ランダムコメント」が表示されることを確認する
- Reload ボタンでリロードされることを確認する
- 可能なら1回前とカード内容が変わることを確認する

## シナリオ T5: カードから記事詳細へ遷移

- `/` または `/?tab=fixed` を開く
- 任意の投稿カードタイトルを押す
- `/archives/:postId` に遷移し、記事タイトルが表示されることを確認する
- 戻って元の一覧へ復帰できることを確認する

## シナリオ T6: 共通ヘッダーとFAB

- desktop 幅でサイドバーのメニュー項目が表示されることを確認する
- mobile 幅でハンバーガーメニューが開閉できることを確認する
- 右下FABから `/post` に遷移できることを確認する
- `/post` 上では FAB が hidden になることを確認する
- `/post` 遷移後、任意の textarea に文字列を入力できることを確認する
