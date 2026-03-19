# =============================================================================
# GCS Bucket for D1 Parquet exports
# =============================================================================

resource "google_storage_bucket" "d1_export" {
  name     = "hpe-d1-export"
  location = var.gcp_region

  # 外部テーブル用なので最新ファイルだけあれば良い
  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }

  uniform_bucket_level_access = true
}
