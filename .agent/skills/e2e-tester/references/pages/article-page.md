# Article Page Scenarios

対象実装:

- [\_layout.archives.$postId.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/routes/_layout.archives.$postId.tsx)
- [CommentInputBox.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/components/CommentInputBox.tsx)
- [CommentCard.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/components/CommentCard.tsx)
- [PostShareButtonGroup.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/components/PostShareButtonGroup.tsx)
- [SNSLinks.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/components/SNSLinks.tsx)
- [UserWarningMessage.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/components/UserWarningMessage.tsx)

## シナリオ A1: 基本表示

- 任意の `/archives/:postId` を開く
- タイトル、日時、タグ、本文が表示されることを確認する
- タグが複数ある場合でも折り返し崩れがないことを確認する

## シナリオ A2: 導線

- 「関連記事」のリンクが機能することを確認する
- 前後記事リンクがある場合に遷移できることを確認する
- シェアボタン群が表示されることを確認する

## シナリオ A3: 非ログイン操作

- 非ログイン状態で「編集する」を押す
- ログインModalが開くことを確認する
- 非ログイン状態でブックマークを押す
- エラートーストとログインModalが出ることを確認する

## シナリオ A4: 投票

- like または dislike を押す
- ボタン状態が変化することを確認する
- 結果toast または user validation 要求が返ることを確認する
- validation 要求時は TurnstileModal が出ることを確認する

## シナリオ A5: コメント入力

- コメント欄が開いている記事では、author 初期値が `Anonymous` であることを確認する
- 空コメントではバリデーションエラーが出ることを確認する
- コメント送信変更を触ったときだけ、実送信まで試す

## シナリオ A6: コメント返信

- 既存コメントの「返信」を押す
- 返信フォームが開くことを確認する
- もう一度押して閉じることを確認する

## シナリオ A7: コメントアンカー

- `#comment-{id}` 付きURLで開く
- 対応コメント位置までスクロールすることを確認する

## シナリオ A8: 外部反応リンク

- SNS反応データがある記事で collapse を開く
- X / Bluesky / Misskey の該当リンクが表示されることを確認する

## シナリオ A9: 警告表示

- `isWelcomed=false` の記事で warning バナーが表示されることを確認する
- `isWelcomed=true` の記事で warning が出ないことを確認する
