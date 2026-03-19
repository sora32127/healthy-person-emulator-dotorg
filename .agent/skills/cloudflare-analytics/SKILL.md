---
name: cloudflare-analytics
description: |
  Cloudflare GraphQL Analytics API を使ったトラフィック分析スキル。ユーザーエージェント分析、ボット検出、リクエスト数の確認などを行う。
  以下のようなフレーズでトリガーされる：
  - 「Cloudflareのログ確認して」「アクセスログ見て」「トラフィック分析して」
  - 「ユーザーエージェント調べて」「どんなボットが来てる？」「クローラー確認」
  - 「リクエスト数を調べて」「アクセス状況確認して」
  サイトへのアクセス状況、ボット、ユーザーエージェントについて聞かれた場合はこのスキルを使う。
---

# Cloudflare Analytics スキル

Cloudflare GraphQL Analytics API を使って、サイトのトラフィックを分析する。

## 認証情報

- **Zone ID**: `5834c4765c7ffc8e843d024cbfa2f1a2`
- **API Token**: 環境変数 `CF_API_TOKEN` を使用する（`.zshrc` に設定済み）

## 制約事項（Free プラン）

- `httpRequestsAdaptiveGroups` の時間範囲は **最大1日（24時間）**
- `botScore` フィルタは **使用不可**（有料機能）
- ボット判定は UA 文字列ベースで行う

## ワークフロー

### Step 1: 期間の決定

ユーザーが期間を指定しない場合は、直近24時間をデフォルトにする。
Free プランでは1日が上限なので、それ以上の期間が必要な場合は日ごとに分割してクエリする。

### Step 2: データ取得

```bash
curl -s https://api.cloudflare.com/client/v4/graphql \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "query": "{ viewer { zones(filter: {zoneTag: \"5834c4765c7ffc8e843d024cbfa2f1a2\"}) { httpRequestsAdaptiveGroups(filter: {datetime_gt: \"<START_ISO8601>\", datetime_lt: \"<END_ISO8601>\"}, limit: <LIMIT>, orderBy: [count_DESC]) { count dimensions { userAgent } } } } }"
  }'
```

- `<START_ISO8601>` / `<END_ISO8601>`: ISO 8601 形式（例: `2026-03-16T00:00:00Z`）
- `<LIMIT>`: 取得件数。概要なら 50、詳細分析なら 500
- 期間は必ず24時間以内に収める

### Step 3: 分析と分類

取得した UA を以下のカテゴリに分類してレポートする：

#### ブラウザ（実ユーザー）

- **モバイル**: iPhone Safari, Android Chrome, Twitter/X アプリ内ブラウザ, その他アプリ内ブラウザ
- **デスクトップ**: Chrome, Firefox, Edge, Safari

#### ボット・クローラー

以下のカテゴリで分類する：

| カテゴリ       | 主なボット                                                                               |
| -------------- | ---------------------------------------------------------------------------------------- |
| 検索エンジン   | Googlebot, Bingbot, YandexBot, Applebot                                                  |
| SNS プレビュー | Twitterbot, facebookexternalhit, meta-externalagent, Discordbot, SummalyBot（Misskey系） |
| SEO ツール     | SemrushBot, AhrefsBot, MJ12bot（Majestic）, DotBot（Moz）                                |
| AI クローラー  | GPTBot（OpenAI）, Amazonbot, ClaudeBot（Anthropic）, Bytespider                          |
| Fediverse      | Mastodon 各インスタンス（http.rb UA）, Akkoma, Misskey                                   |
| その他         | curl, got, wget, 空UA                                                                    |

#### ボット判定ロジック（UA文字列ベース）

ブラウザ系UA を除外してボットを抽出する方法：

```bash
# 結果を jq でTSV化し、ブラウザ系を除外
| jq -r '.data.viewer.zones[0].httpRequestsAdaptiveGroups[] | "\(.count)\t\(.dimensions.userAgent)"' \
| grep -ivE 'Mobile/.*Twitter|Mobile/.*Safari|iPhone.*Version/|Android.*Chrome/[0-9].*Mobile Safari|Windows NT.*Chrome/|Windows NT.*Firefox/|Macintosh.*Chrome/|Macintosh.*Safari/' \
| head -80
```

上記で漏れるケースもあるので、最終的には目視で判断する。

### Step 4: レポート出力

以下の形式でユーザーに報告する：

1. **全体サマリ**: 期間、総リクエスト数（概算）、ブラウザ/ボット比率
2. **ブラウザ内訳**: デバイス別・流入元別（Twitter アプリ内ブラウザ等）
3. **ボット詳細**: カテゴリ別にテーブルで整理
4. **注目ポイント**: 異常なパターン、急増しているボット、対策が必要そうなもの

## よく使うクエリバリエーション

### リクエストメソッド別

```
dimensions { clientRequestHTTPMethodName userAgent }
```

### ステータスコード別

```
dimensions { edgeResponseStatus userAgent }
```

### パス別のリクエスト数

```
dimensions { clientRequestPath }
```

## トラブルシューティング

- **"cannot request a time range wider than 1d"**: 期間を24時間以内に絞る
- **"does not have access to the field 'botscore'"**: Free プランでは botScore 使用不可。UA文字列で判定する
- **認証エラー**: `CF_API_TOKEN` が正しいか、Analytics Read 権限があるか確認
