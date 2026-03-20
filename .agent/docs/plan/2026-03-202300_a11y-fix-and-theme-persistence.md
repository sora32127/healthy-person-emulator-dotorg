# アクセシビリティ修正 & テーマ状態管理の一元化

## 実施結果

### タスク1: アクセシビリティ違反の修正

すべて完了。以下の aria-label を追加:

- `/feed`: ソート select に `aria-label="表示順"`、RSS リンク+ボタンに `aria-label="RSSフィード"`
- `/post`: DynamicTextInput textarea に `aria-label="{description} {index}"`、StaticTextInput textarea に `aria-label="{title} {index}"`
- `/post` TagSelectionBox: select に `aria-label="タグ並び替え"`
- `/search`: ソート select に `aria-label="並び替え"`
- SNSLinks: collapse checkbox に `aria-label="共有リンクを開閉"`

### タスク2: テーマ状態管理の一元化

完了。cookie ベースで永続化:

1. `app/stores/theme.ts`: 初期値を cookie から読む `getThemeFromCookie()` を追加。`toggleThemeAtom` で cookie にも保存するように変更
2. `app/root.tsx`: `<head>` 内にインラインスクリプトを追加し、cookie からテーマを読んで `data-theme` を設定（FOUC防止）

### プランからの変更点

特になし。プラン通りに実装。

### 検証結果

- `pnpm lint`: エラー0件（既存の警告51件のみ）
- `pnpm build`: 成功
