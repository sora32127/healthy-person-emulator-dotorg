# Terraform 管理外のリソース

| リソース                                       | 管理方法              |
| ---------------------------------------------- | --------------------- |
| BigQuery テーブル (非外部)                     | Dataform              |
| GCS state バケット (`hpe-terraform-state-gcp`) | 手動作成              |
| Worker Secret (`GCS_CREDENTIALS`)              | `wrangler secret put` |
