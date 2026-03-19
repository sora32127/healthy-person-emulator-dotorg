# Support Page Scenarios

対象実装:

- [\_layout.support.tsx](/Users/sorachi/code/healthy-person-emulator-dotorg/app/routes/_layout.support.tsx)

## シナリオ S1: 基本表示

- `/support` を開く
- H1「サポートする」が表示されることを確認する
- 説明本文、料金一覧、Fanbox 導線、QRコードが表示されることを確認する

## シナリオ S2: 外部リンク

- Supabase の価格リンクを押せることを確認する
- Vercel の価格リンクを押せることを確認する
- 「サポートする」ボタンが `https://contradiction29.fanbox.cc/` を向くことを確認する

## シナリオ S3: レスポンシブ

- mobile 幅でボタンが全幅近く表示され、押下しやすいことを確認する
- QR画像が横にはみ出さないことを確認する
