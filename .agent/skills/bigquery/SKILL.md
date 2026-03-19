---
name: bigquery
description: |
  Google BigQuery を使ったデータ探索・クエリ実行スキル。プロジェクト healthy-person-emulator のデータセット（GA4, Search Console, dbt加工済みデータなど）に対して、スキーマ確認・データ探索・SQLクエリを実行する。
  以下のようなフレーズでトリガーされる：
  - 「BigQueryで調べて」「BQでクエリして」「BigQueryのデータ見て」
  - 「GA4のデータ集計して」「アクセス数を調べて」「PV数教えて」
  - 「検索パフォーマンス見せて」「Search Consoleのデータ」「検索クエリ分析」
  - 「データセット一覧」「テーブルのスキーマ確認」「カラム一覧」
  - 「SQLで分析して」「集計して」「レポート出して」
  ユーザーがサイトのアクセスデータ、検索パフォーマンス、ユーザー行動などを分析したいと言った場合は、
  たとえ「BigQuery」という単語を使わなくてもこのスキルを使うこと。
  GA4、Search Console、サイト分析に関するリクエストには積極的にこのスキルを適用する。
---

# BigQuery データ探索・クエリスキル

プロジェクト `healthy-person-emulator` の BigQuery データに対して、探索からクエリ実行までを行う。

## 基本方針

1. **まずデータを理解してからクエリを書く** — テーブル構造がわからない状態でクエリを書かない
2. **コスト意識** — 1TB を超えるスキャンは実行前にユーザーに確認する
3. **出力はターミナル** — 結果は `bq query` の標準出力で表示する

## ワークフロー

### Step 1: データセットとテーブルの探索

ユーザーのリクエストに関連するデータがどこにあるかを特定する。

```bash
# データセット一覧
bq ls --project_id=healthy-person-emulator

# データセット内のテーブル一覧
bq ls healthy-person-emulator:<dataset_name>

# GA4 の場合、日付パーティションテーブルが多い
# events_ テーブルは events_YYYYMMDD のシャーディング
bq ls healthy-person-emulator:analytics_353281755 | head -30
```

### Step 2: スキーマの確認

クエリ対象のテーブル構造を把握する。特に GA4 の events テーブルはネストが深いので、スキーマ確認は必須。

```bash
# テーブルスキーマ
bq show --schema --format=prettyjson healthy-person-emulator:<dataset>.<table>

# テーブル情報（行数、サイズ、パーティション）
bq show healthy-person-emulator:<dataset>.<table>
```

### Step 3: コスト見積もり

クエリを書いたら、まず `--dry_run` でスキャン量を確認する。

```bash
bq query --nouse_legacy_sql --dry_run 'SELECT ...'
```

- **1TB 未満**: そのまま実行してよい
- **1TB 以上**: ユーザーにスキャン量を伝えて実行してよいか確認する

スキャン量を減らすテクニック:
- GA4 events テーブルは `_TABLE_SUFFIX` で日付範囲を絞る
- `SELECT *` を避け、必要なカラムだけ指定する
- パーティションカラム（`event_date` 等）で WHERE 絞り込みを入れる

### Step 4: クエリ実行

```bash
bq query --nouse_legacy_sql --max_rows=100 '
  SELECT ...
  FROM `healthy-person-emulator.<dataset>.<table>`
  WHERE ...
  LIMIT 100
'
```

- 常に `--nouse_legacy_sql` を付ける（Standard SQL を使う）
- 探索的なクエリには `LIMIT` を付ける
- `--max_rows` でターミナル出力量を制御する
- 大きな結果セットが必要な場合は `--format=csv` や `--format=json` を検討

## データセットの概要

| データセット | 内容 |
|---|---|
| `analytics_353281755` | GA4 の生データ。`events_*` テーブル群（日付シャーディング） |
| `searchconsole` | Google Search Console のデータ。検索クエリ、表示回数、クリック数など |
| `HPE_RAW` | D1 からエクスポートされたアプリケーションのローデータ（GCS Parquet 外部テーブル） |
| `HPE_REPORTS` | レポート用ビュー（旧 dbt_sora32127 から移行） |

## GA4 events テーブルのよく使うパターン

GA4 の events テーブルはネストされた構造を持つ。よく使うクエリパターン:

```sql
-- PV数の日別推移（直近7日）
SELECT
  event_date,
  COUNT(*) AS pageviews
FROM `healthy-person-emulator.analytics_353281755.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND event_name = 'page_view'
GROUP BY event_date
ORDER BY event_date;

-- event_params からパラメータを取り出す（例: page_location）
SELECT
  event_date,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location,
  COUNT(*) AS views
FROM `healthy-person-emulator.analytics_353281755.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20250301' AND '20250317'
  AND event_name = 'page_view'
GROUP BY 1, 2
ORDER BY views DESC
LIMIT 20;
```

## 注意点

- GA4 の `events_*` テーブルは日付でシャーディングされている。`_TABLE_SUFFIX` で日付を絞らないとフルスキャンになりコストが跳ね上がる
- `event_params` は ARRAY<STRUCT> なので `UNNEST` して取り出す
- `user_properties` も同様にネストされている
- Search Console データの日付カラム名はテーブルによって異なるので、スキーマを確認してから使う
