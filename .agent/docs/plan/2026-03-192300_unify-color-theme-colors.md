# 色使い改善: ハードコード色のテーマ色統一 & ダークモード対応

## Context

UI/UX Pro Maxレビューとブラウザ確認により、サイト全体で以下の色使いの問題が判明した:
- ダークテーマの `info`, `error`, `base-200`, `base-300` が未定義でDaisyUIデフォルトに暗黙依存
- 15+ファイルでTailwindのハードコード色 (`blue-500`, `gray-300`, `red-500` 等) がテーマ色の代わりに使われている
- アニメーション色が原色 (`#0000ff`, `#ff0000`)
- `btn-primary` の hover が `teal-100` でハードコード
- SNSシェアボタンが各ブランドカラーのままでカラーハーモニーが崩れている
- FABボタンがライト/ダークで不統一

## 方針

ハードコードされた色をDaisyUIのセマンティックカラー (`text-info`, `text-error`, `bg-base-300` 等) に置換する。
SNSシェアボタンのブランドカラーは「通常時モノクロ、hover時ブランドカラー」パターンに変更。

## 作業単位

### Unit 1: テーマ基盤 (tailwind.css)
**ファイル**: `app/tailwind.css`
**変更内容**:
- ダークテーマに `--color-info`, `--color-error`, `--color-base-200`, `--color-base-300` を追加
- アニメーション色 `#0000ff` → secondary色系, `#ff0000` → error色系に変更
- `.btn-primary` の `hover:bg-teal-100` → `hover:bg-primary/80` に変更
- テーブルの `border-gray-300` → `border-base-300` に変更
- `.btn-primary` の `text-slate-950` → `text-primary-content` に変更

### Unit 2: SNSシェアボタン + 投票ボタン
**ファイル**:
- `app/components/PostShareButtonGroup.tsx`
- `app/components/VoteButton.tsx`
**変更内容**:
- SNSボタン: 通常時 `bg-base-300` (モノクロ), hover時にブランドカラーを表示するパターンに変更
- VoteButton: `text-blue-500` → `text-secondary`, `text-red-500` → `text-error` に変更

### Unit 3: コメント・フォーム系コンポーネント
**ファイル**:
- `app/components/CommentCard.tsx`
- `app/components/CommentInputBox.tsx`
- `app/components/GoogleAuthButton.tsx`
**変更内容**:
- CommentCard: `text-green-700` → `text-success` (著者名), `text-blue-500` → `text-info` (返信ボタン)
- CommentInputBox: `text-red-500` → `text-error` (エラーメッセージ)
- GoogleAuthButton: `border-gray-300` → `border-base-300`

### Unit 4: タグ関連コンポーネント
**ファイル**:
- `app/components/SubmitFormComponents/TagPreviewBox.tsx`
- `app/components/SubmitFormComponents/TagCreateBox.tsx`
- `app/components/SubmitFormComponents/TagSelectionBox.tsx`
**変更内容**:
- TagPreviewBox: `bg-blue-500 text-white` → `bg-secondary text-secondary-content`, `bg-green-500 text-white` → `bg-success text-success-content`
- TagCreateBox: `text-gray-700 bg-gray-200` → `text-base-content bg-base-200`
- TagSelectionBox: `text-gray-400` → `text-base-content/50`

### Unit 5: ルート・プログレスバー
**ファイル**:
- `app/root.tsx`
- `app/components/PageTransitionProgressBar.tsx`
**変更内容**:
- root.tsx: `text-green-300` → `text-primary` (スピナー), `bg-red-100` → `bg-error/10` (エラー背景), `bg-blue-500 hover:bg-blue-700` → `bg-secondary hover:bg-secondary/80` (エラーページボタン)
- ProgressBar: `from-blue-500 to-blue-700` → `from-secondary to-secondary/80`, dark variantを削除（テーマ色で自動対応）

### Unit 6: ルートページのハードコード色
**ファイル**:
- `app/routes/_layout.bookmark.tsx`
- `app/routes/_layout.search.tsx`
- `app/routes/_layout.editHistory.tsx`
- `app/routes/_layout.readme.tsx`
**変更内容**:
- 全般: `text-gray-*` → `text-base-content/60` 等のテーマ色に統一
- `border-gray-*` → `border-base-300`
- `hover:bg-gray-50` → `hover:bg-base-200`
- `text-blue-600` → `text-info`
- `bg-blue-50` → `bg-info/10`

## 検証方法

各Unit完了後:
1. `pnpm build` でビルドが通ることを確認
2. `pnpm lint` でlintエラーがないことを確認

## 実施結果

PR: https://github.com/sora32127/healthy-person-emulator-dotorg/pull/312
21ファイル変更、55行追加、48行削除。

### プランからの変更点

1. **SNSボタンのモノクロ化を撤回**: 当初「通常時モノクロ、hover時ブランドカラー」としたが、ライトモードでグレーアウトして見えるとのフィードバックを受け、ブランドカラー常時表示に戻した
2. **DaisyUI組み込みテーマの無効化が必要だった**: カスタムテーマが`:where()`セレクタで定義される一方、組み込みテーマは`:is()`セレクタで高い詳細度を持つため、`themes: false`で無効化しないとカスタム色が反映されなかった
3. **`--color-primary-content`の追加が必要だった**: DaisyUIの`btn btn-primary`コンポーネントが`--color-primary-content`を参照するため、テーマ定義に追加する必要があった
4. **SVGアイコンの`fill`ハードコードを発見**: `ClipboardIcon`と`ShareIcon`が`fill="#e8eaed"`でハードコードされており、ライトモードでグレーアウトして見えた。`fill="currentColor"`に変更
5. **`cursor-pointer`の追加**: 当初のプランになかったが、編集ボタン・SNSボタン・コピー/シェアボタンにカーソルが矢印のままだった問題を修正

### 今後の改善提案

- **e2e-testerスキル**: 色のコントラスト比を自動チェックする機能があると便利。agent-browserのevalでgetComputedStyleを使って背景色と文字色のコントラスト比を計算できる
- **DaisyUIテーマの知見**: `themes: false`の設定はCLAUDE.mdに記載しておくと、今後テーマ関連の変更時に同じ罠にハマらない
