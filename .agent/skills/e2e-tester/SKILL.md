---
name: e2e-tester
description: Claude in Chrome MCP を使って、ブラウザ上の変更が正しく反映されたかを検証するE2Eテストスキル。UI変更、導線変更、フォーム操作、表示崩れ、回帰確認、console/networkエラー確認、レスポンシブ確認などを依頼されたときに使う。「テスターとして見て」「ブラウザで変更確認して」「E2Eテストして」「表示が直ったかテストして」などの依頼で起動する。
---

# E2E Tester

Claude in Chrome MCP を使い、実ブラウザで変更結果を検証する。コードを読んで終わらせず、画面上の挙動と回帰の有無で判断する。

## 基本方針

- 期待結果を先に短く言語化する。曖昧なら、ユーザーの依頼文と差分から妥当な期待値を置く。
- Claude in Chrome MCP（`mcp__claude-in-chrome__*` ツール群）を使ってブラウザを操作する。
- まず `mcp__claude-in-chrome__tabs_context_mcp` でタブ状況を把握し、必要なら `mcp__claude-in-chrome__tabs_create_mcp` で新しいタブを開く。
- `mcp__claude-in-chrome__read_page` でページ構造を把握し、`mcp__claude-in-chrome__computer` でクリック・入力を行う。
- 変更箇所だけでなく、その周辺の壊れやすい導線も確認する。
- DOM の存在だけで合格にしない。見た目、操作、遷移、エラー有無まで見る。
- 問題を見つけたら、再現手順と観測結果を残す。

## このスキルの読み方

- すべての変更で全シナリオを読む前提にしない。
- まず `references/test-selection.md` を読み、変更種別に対応する最小セットのシナリオだけ選ぶ。
- ページ固有の確認が必要になったら `references/pages/` 配下の該当ファイルだけ読む。
- 投稿や記事詳細のように重いページは、ファイル内でも「表示」「操作」「回帰」に分けて必要部分だけ使う。

## 標準ワークフロー

### 1. テスト対象を確定する

- 対象ページ、期待挙動、関連導線を整理する。
- 対象URLへ移動する。ローカルなら `http://localhost:8787`、本番なら `https://healthy-person-emulator.org`。
- 既知の変更点があるなら、その変更が見える最短シナリオを先に試す。
- この時点で `references/test-selection.md` を開き、今回読むシナリオを絞る。

### 2. スモークテストを行う

- ページが開くかを見る。
- 主要な見出し、ボタン、入力欄、カードなどが表示されるか確認する。
- `mcp__claude-in-chrome__read_console_messages` で console error が出ていないか確認する。

### 3. 変更箇所を検証する

- `mcp__claude-in-chrome__computer` でクリック、入力、スクロールなどの実操作を行う。
- `mcp__claude-in-chrome__form_input` でフォーム入力を行う。
- 状態変化があるなら、操作前後で文言、属性、表示位置、活性状態、URL、モーダル表示を比較する。
- 非同期処理があるなら適切に待ってから判定する。

### 4. 回帰を確認する

- 変更箇所の直近にある既存UIを軽く触る。
- 1つの修正で壊れやすい観点を優先して見る。
- 例: ナビゲーション、保存操作、フォーム送信、閉じる操作、スクロール、レスポンシブ。

### 5. 必要なら追加診断する

- JSエラー疑い: `mcp__claude-in-chrome__read_console_messages` を確認する。
- API失敗疑い: `mcp__claude-in-chrome__read_network_requests` を確認する。
- 再現が不安定: 同じ操作をもう一度行い、再現性を確かめる。

### 6. 証跡を残す

- 問題がある場合は、スクリーンショットを撮って残す。
- 合格時も、判断に使った操作と観測結果を短くまとめる。

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

- スクリーンショットだけで判断しない。可能なら操作結果まで確認する。
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
