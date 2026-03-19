# =============================================================================
# Service Account + IAM (最小権限)
# =============================================================================

# Cloudflare Worker が GCS にアップロードするための SA
resource "google_service_account" "gcs_writer" {
  account_id   = "d1-export-writer"
  display_name = "D1 Export GCS Writer (Cloudflare Worker)"
  description  = "Cloudflare Worker から GCS に Parquet ファイルをアップロードするための SA"
}

# GCS バケットへの書き込みのみ (objectCreator = 作成のみ、読み取り・削除不可)
resource "google_storage_bucket_iam_member" "writer" {
  bucket = google_storage_bucket.d1_export.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.gcs_writer.email}"
}
