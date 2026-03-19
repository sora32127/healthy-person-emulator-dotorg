# Google Cloud Terraform

D1 → BigQuery ETL パイプラインの GCP 側インフラを管理する。

## 管理対象

| リソース | 用途 |
|---------|------|
| GCS バケット (`hpe-d1-export`) | Cloudflare Worker が D1 データを Parquet で書き込む |
| BigQuery データセット (`HPE_RAW`) | D1 テーブルの外部テーブルを格納 |
| BigQuery 外部テーブル (14個) | GCS 上の Parquet ファイルを直接クエリ |
| サービスアカウント (`d1-export-writer`) | Worker → GCS 書き込み用 (最小権限) |

## Terraform 管理外のリソース

| リソース | 管理方法 |
|---------|---------|
| BigQuery テーブル (非外部) | Dataform |
| Secrets Store (Cloudflare) | wrangler CLI / Dashboard |
| GCS state バケット (`hpe-terraform-state-gcp`) | 手動作成 |

## セットアップ

```bash
# 1. .envrc を作成
cp .envrc.example .envrc
# GOOGLE_APPLICATION_CREDENTIALS を設定

# 2. terraform.tfvars を作成
cp terraform.tfvars.example terraform.tfvars
# gcp_project_id を設定

# 3. State バケットを手動作成 (初回のみ)
gsutil mb -l asia-northeast1 gs://hpe-terraform-state-gcp

# 4. 初期化
terraform init

# 5. 既存データセットを import (初回のみ)
terraform import google_bigquery_dataset.hpe_raw projects/healthy-person-emulator/datasets/HPE_RAW

# 6. 適用
terraform plan
terraform apply
```
