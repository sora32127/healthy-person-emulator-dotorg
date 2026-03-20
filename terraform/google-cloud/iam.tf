# =============================================================================
# Service Account + IAM (最小権限)
# =============================================================================

# Cloudflare Worker が GCS・BigQuery にアクセスするための SA
resource "google_service_account" "gcs_writer" {
  account_id   = "d1-export-writer"
  display_name = "Cloudflare Worker SA (GCS + BigQuery)"
  description  = "Cloudflare Worker から GCS アップロード・BigQuery 読み取りを行うための SA"
}

# GCS バケットへの書き込みのみ (objectCreator = 作成のみ、読み取り・削除不可)
resource "google_storage_bucket_iam_member" "writer" {
  bucket = google_storage_bucket.d1_export.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.gcs_writer.email}"
}

# BigQuery データ閲覧 (HPE_REPORTS データセット)
resource "google_bigquery_dataset_iam_member" "worker_reports_viewer" {
  dataset_id = "HPE_REPORTS"
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${google_service_account.gcs_writer.email}"
}

# BigQuery データ閲覧 (GA4 データセット — ビューが events_intraday_* を参照するため必要)
resource "google_bigquery_dataset_iam_member" "worker_ga4_viewer" {
  dataset_id = "analytics_353281755"
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${google_service_account.gcs_writer.email}"
}

# BigQuery ジョブ実行 (クエリ実行に必要)
resource "google_project_iam_member" "worker_bq_job_user" {
  project = var.gcp_project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.gcs_writer.email}"
}

# SA キー (Cloudflare Worker の GCS_CREDENTIALS シークレットとして使用)
resource "google_service_account_key" "gcs_writer_key" {
  service_account_id = google_service_account.gcs_writer.name
}

output "gcs_writer_key_json" {
  value     = base64decode(google_service_account_key.gcs_writer_key.private_key)
  sensitive = true
}
