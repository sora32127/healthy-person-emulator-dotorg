---
name: e2e-tester
description: agent-browser（ヘッドレスブラウザCLI）を使って、ブラウザ上の変更が正しく反映されたかを検証するE2Eテストスキル。UI変更、導線変更、フォーム操作、表示崩れ、回帰確認、console/networkエラー確認、レスポンシブ確認などを依頼されたときに使う。「テスターとして見て」「ブラウザで変更確認して」「E2Eテストして」「表示が直ったかテストして」などの依頼で起動する。
---

# E2E Tester

agent-browser CLI を使い、ヘッドレスブラウザで変更結果を検証する。コードを読んで終わらせず、画面上の挙動と回帰の有無で判断する。

## 基本方針

- 期待結果を先に短く言語化する。曖昧なら、ユーザーの依頼文と差分から妥当な期待値を置く。
- Bashツール経由で `agent-browser` コマンドを実行してブラウザを操作する。
- まず `agent-browser open <url>` で対象URLを開く。
- `agent-browser snapshot` でアクセシビリティツリーを取得し、ページ構造と要素の `@ref` を把握する。スクリーンショットより情報量が多いのでこちらを優先する。
- `agent-browser click @ref` / `agent-browser fill @ref "text"` で ref を指定して操作を行う。
- 変更箇所だけでなく、その周辺の壊れやすい導線も確認する。
- DOM の存在だけで合格にしない。見た目、操作、遷移、エラー有無まで見る。
- 問題を見つけたら、再現手順と観測結果を残す。
- テスト完了後は `agent-browser close` でブラウザを閉じる。

## ツールの使い分け

| 操作 | コマンド |
|---|---|
| ページを開く | `agent-browser open <url>` |
| ページ構造を把握する | `agent-browser snapshot` |
| 要素のテキストを取得する | `agent-browser get text @ref` |
| 要素をクリックする | `agent-browser click @ref` |
| テキストを入力する（クリア＆入力） | `agent-browser fill @ref "text"` |
| テキストを追記する | `agent-browser type @ref "text"` |
| キー押下（Enter等） | `agent-browser press Enter` |
| ドロップダウン選択 | `agent-browser select @ref "value"` |
| チェックボックス | `agent-browser check @ref` / `agent-browser uncheck @ref` |
| ホバー | `agent-browser hover @ref` |
| スクロール | `agent-browser scroll down [px]` / `agent-browser scrollintoview @ref` |
| 前のページに戻る | `agent-browser back` |
| テキスト出現を待つ | `agent-browser wait --text "表示テキスト"` |
| 要素を待つ | `agent-browser wait @ref` |
| ネットワーク安定を待つ | `agent-browser wait --load networkidle` |
| consoleログを確認する | `agent-browser console` |
| ページエラーを確認する | `agent-browser errors` |
| ネットワークリクエストを確認する | `agent-browser network requests` |
| スクリーンショットを撮る | `agent-browser screenshot [path]` |
| フルページスクリーンショット | `agent-browser screenshot --full [path]` |
| ラベル付きスクリーンショット | `agent-browser screenshot --annotate` |
| JSを実行する | `agent-browser eval "js code"` |
| ビューポート変更 | `agent-browser set viewport <w> <h>` |
| デバイスエミュレーション | `agent-browser set device "iPhone 14"` |
| タブ操作 | `agent-browser tab` / `agent-browser tab new [url]` / `agent-browser tab <n>` |
| 変更差分を確認する | `agent-browser diff snapshot` |
| ブラウザを閉じる | `agent-browser close` |

## snapshot ベースの操作フロー

agent-browser では、操作対象を **@ref**（アクセシビリティツリー上の要素参照）で指定する。

1. `agent-browser snapshot` でアクセシビリティツリーを取得する
2. ツリーから操作したい要素の `@ref`（例: `@e2`, `@e15`）を読み取る
3. `agent-browser click @e2`、`agent-browser fill @e3 "test"` 等で操作する
4. 操作後に再度 `agent-browser snapshot` を取り、状態変化を確認する

### セマンティックロケーターも使える

ref が不明な場合、`find` コマンドでセマンティックに要素を探せる。

```bash
agent-browser find role button click --name "送信"
agent-browser find text "ログイン" click
agent-browser find label "メールアドレス" fill "test@example.com"
```

### バッチ実行で効率化

複数コマンドをまとめて実行できる。

```bash
echo '[
  ["open", "http://localhost:8787"],
  ["snapshot"]
]' | agent-browser batch --json
```

## このスキルの読み方

- すべての変更で全シナリオを読む前提にしない。
- まず `references/test-selection.md` を読み、変更種別に対応する最小セットのシナリオだけ選ぶ。
- ページ固有の確認が必要になったら `references/pages/` 配下の該当ファイルだけ読む。
- 投稿や記事詳細のように重いページは、ファイル内でも「表示」「操作」「回帰」に分けて必要部分だけ使う。

## 標準ワークフロー

### 1. テスト対象を確定する

- 対象ページ、期待挙動、関連導線を整理する。
- `agent-browser open <url>` で対象URLへ移動する。ローカルなら `http://localhost:8787`、本番なら `https://healthy-person-emulator.org`。
- 既知の変更点があるなら、その変更が見える最短シナリオを先に試す。
- この時点で `references/test-selection.md` を開き、今回読むシナリオを絞る。

### 2. スモークテストを行う

- `agent-browser snapshot` でページが正しく読み込まれたか確認する。
- 主要な見出し、ボタン、入力欄、カードなどがアクセシビリティツリーに存在するか確認する。
- `agent-browser errors` でページエラーが出ていないか確認する。
- `agent-browser console` で console error が出ていないか確認する。

### 3. 変更箇所を検証する

- `agent-browser snapshot` で ref を取得し、`agent-browser click @ref` / `agent-browser fill @ref "text"` で操作する。
- 状態変化があるなら、操作前後で `agent-browser snapshot` を取り、文言、属性、表示位置、活性状態、URL、モーダル表示を比較する。
- 非同期処理があるなら `agent-browser wait --text "..."` や `agent-browser wait --load networkidle` で適切に待ってから判定する。
- 変更前後の差分を確認したい場合は `agent-browser diff snapshot` が使える。

### 4. 回帰を確認する

- 変更箇所の直近にある既存UIを軽く触る。
- 1つの修正で壊れやすい観点を優先して見る。
- 例: ナビゲーション、保存操作、フォーム送信、閉じる操作、スクロール、レスポンシブ。
- レスポンシブは `agent-browser set viewport <w> <h>` や `agent-browser set device "iPhone 14"` でビューポートを変更して確認する。

### 5. 必要なら追加診断する

- JSエラー疑い: `agent-browser errors` と `agent-browser console` を確認する。
- API失敗疑い: `agent-browser network requests --filter api` を確認する。
- 再現が不安定: 同じ操作をもう一度行い、再現性を確かめる。
- 複雑な検証が必要な場合: `agent-browser eval "js code"` でJSを直接実行する。

### 6. 証跡を残す

- 問題がある場合は、`agent-browser screenshot` でスクリーンショットを撮って残す。
- `agent-browser screenshot --annotate` で要素番号付きのスクリーンショットも取れる。
- 合格時も、判断に使った操作と観測結果を短くまとめる。

### 7. 後片付け

- テスト完了後は `agent-browser close` でブラウザを閉じる。

## よく使う観点

- 表示: 文言、レイアウト、余白、折り返し、はみ出し、disabled状態、focus表示
- 操作: クリック可能か、入力できるか、Enter送信できるか、閉じる/戻るが効くか
- 状態: ローディング、成功表示、エラー表示、トグル切り替え、URL変化
- 回帰: 変更箇所以外の主要導線が壊れていないか
- 技術的兆候: console error、4xx/5xx、失敗したfetch、無限ローディング

## レポート形式

結果は次の順で簡潔に返す。

1. 判定: `pass` / `fail` / `partial`
2. 実施内容: 何をどう操作したか
3. 観測結果: 何が見えたか、何が起きたか
4. 問題点: fail または partial のときだけ、再現手順つきで書く
5. 補足: console/network など追加確認があれば書く

## 注意

- スクリーンショットだけで判断しない。`agent-browser snapshot` と操作結果で確認する。
- 失敗時は「期待」と「実際」の差分を明示する。
- ユーザーが修正確認を求めているときは、バグ修正案より先にテスト結果を返す。
- テストの前提が不足していても、ローカル文脈から妥当な仮説を置いてまず進める。

## Additional Resources

- `references/test-selection.md` - 変更種別から読むべきシナリオを選ぶ入口
- `references/pages/top-page.md` - `/` と `tab=fixed` `tab=random` を含むトップ系シナリオ
- `references/pages/support-page.md` - `/support`
- `references/pages/readme-page.md` - `/readme`
- `references/pages/post-page.md` - `/post`（投稿→コメント→編集→削除の一連テスト含む）
- `references/pages/article-page.md` - `/archives/:postId`
- `references/pages/search-page.md` - `/search`
