# Readme Page Scenarios

対象実装:

- [\_layout.readme.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/routes/_layout.readme.tsx)

## シナリオ R1: 基本表示

- `/readme` を開く
- H1「サイト説明」が表示されることを確認する
- 「健常者エミュレータ事例集とは」「ユーザーガイドライン」「FAQ」など主要見出しが順に読めることを確認する

## シナリオ R2: 内部リンク

- 本文中の「投稿フォーム」が `/post` に遷移することを確認する
- 「ユーザー登録」が `/signup` を向くことを確認する
- 「ログイン」が `/login` を向くことを確認する

## シナリオ R3: 外部リンク

- Discord 招待リンク、GitHub リンク、X DM リンクが存在することを確認する
- クリック可能であることを確認する

## シナリオ R4: FAQ 表示

- FAQ 項目が複数表示されることを確認する
- 区切り線が途中項目に出ることを確認する
- 太字やリンクを含む回答が崩れずに表示されることを確認する
