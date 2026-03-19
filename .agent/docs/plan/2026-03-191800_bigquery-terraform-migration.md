# BigQueryデータセットのTerraform化 & dbt_sora32127移行

## Context

BigQueryに4つのデータセットが存在する：

- `HPE_RAW` — 既にTerraform管理済み（D1→GCS Parquet外部テーブル）
- `analytics_353281755` — GA4エクスポート。Terraform管理外
- `searchconsole` — Search Consoleエクスポート。Terraform管理外
- `dbt_sora32127` — dbtが生成したビュー4つ。dbtは廃止済みで、ビューだけが残っている

ユーザーの要望：

1. `analytics_353281755` と `searchconsole` をTerraform化
2. `dbt_sora32127` を削除し、同等のビューをTerraformで定義

## 現状分析

### dbt_sora32127のビュー4つ

| ビュー                    | 依存先                              | Python参照                    |
| ------------------------- | ----------------------------------- | ----------------------------- |
| `report_weekly_summary`   | HPE_RAW のみ                        | `report_weekly_summary.py`    |
| `report_new_legend_posts` | HPE_RAW のみ                        | `report_legendary_article.py` |
| `report_daily_kpi`        | HPE_RAW + `stg_ga4`（既に削除済み） | なし                          |
| `report_pv`               | `stg_ga4`（既に削除済み）           | なし                          |

`stg_ga4`は削除済みなので、`report_daily_kpi`と`report_pv`はGA4テーブルへの直接クエリにインライン化する。

### GA4 / Search Console データセット

- テーブルはGoogleサービスが自動作成するため、**データセット定義のみ**Terraform管理
- 特別なアクセス権限（firebase-measurement SA、search-console-data-export SA）を保持する必要あり
- `searchconsole`はlocation=US、他はasia-northeast1

## 実装方針

### 1. `terraform/google-cloud/bigquery.tf` に追加

- `google_bigquery_dataset.ga4` — analytics_353281755
- `google_bigquery_dataset.searchconsole` — searchconsole
- `google_bigquery_dataset.hpe_reports` — 新データセット `HPE_REPORTS`（dbt_sora32127の代替）
- 4つのビュー（`google_bigquery_table` + `view` ブロック）:
  - `report_weekly_summary` — そのまま移行（HPE_RAW参照に書き換え済み）
  - `report_new_legend_posts` — そのまま移行
  - `report_daily_kpi` — `stg_ga4`部分をGA4 events\_\*への直接クエリに置換
  - `report_pv` — 同上。event_params のUNNEST、device/geo/traffic_sourceの展開をインライン化

### 2. Python参照の更新

- `container/tasks/report_weekly_summary.py` — `dbt_sora32127` → `HPE_REPORTS`
- `container/tasks/report_legendary_article.py` — `dbt_sora32127` → `HPE_REPORTS`

### 3. スキルドキュメント更新

- `.agent/skills/bigquery/SKILL.md` — データセット一覧を更新

## 適用手順

1. 既存データセットをTerraform stateにimport:
   ```
   terraform import google_bigquery_dataset.ga4 projects/healthy-person-emulator/datasets/analytics_353281755
   terraform import google_bigquery_dataset.searchconsole projects/healthy-person-emulator/datasets/searchconsole
   ```
2. `terraform plan` で差分確認
3. `terraform apply` でHPE_REPORTSデータセットとビューを作成
4. ビューの動作確認（BQコンソールでクエリ実行）
5. 旧データセット削除: `bq rm -r -f healthy-person-emulator:dbt_sora32127`

## 検証方法

- `terraform validate` — 構文チェック
- `terraform plan` — 差分確認（import後）
- BQで各ビューに `SELECT * FROM HPE_REPORTS.report_weekly_summary LIMIT 5` 等を実行して動作確認
- `report_daily_kpi` と `report_pv` はGA4直接クエリになるので、旧ビューと同じ結果が出ることを確認

## 実施状況

既に以下を実装済み：

- [x] bigquery.tf — 3データセット + 4ビュー追加
- [x] Python参照更新（2ファイル）
- [x] スキルドキュメント更新
- [ ] terraform import（適用時）
- [ ] terraform apply（適用時）
- [ ] dbt_sora32127 削除（動作確認後）
