# =============================================================================
# BigQuery Dataset + External Tables
# =============================================================================

resource "google_bigquery_dataset" "hpe_raw" {
  dataset_id    = "HPE_RAW"
  friendly_name = "HPE Raw Data"
  description   = "Raw data from D1, via GCS Parquet external tables"
  location      = var.gcp_region
}

# D1 テーブル一覧 (app/modules/gcs-export.server.ts の TABLES と一致)
# GCS に Parquet ファイルが存在するテーブルのみ (0行のテーブルはスキップされる)
locals {
  d1_tables = [
    "dim_tags",
    "dim_posts",
    "dim_comments",
    "dim_stop_words",
    "dim_users",
    "rel_post_tags",
    "fct_post_vote_history",
    "fct_comment_vote_history",
    "fct_post_edit_history",
    "fct_user_bookmark_activity",
    "now_editing_pages",
    "social_post_jobs",
  ]
}

resource "google_bigquery_table" "d1_external" {
  for_each   = toset(local.d1_tables)
  dataset_id = google_bigquery_dataset.hpe_raw.dataset_id
  table_id   = each.value

  external_data_configuration {
    source_format = "PARQUET"
    autodetect    = true
    source_uris   = ["gs://${google_storage_bucket.d1_export.name}/d1/${each.value}.parquet"]
  }

  deletion_protection = false
}
