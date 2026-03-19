# =============================================================================
# BigQuery Dataset: HPE_RAW (D1 → GCS Parquet external tables)
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

# =============================================================================
# BigQuery Dataset: analytics_353281755 (GA4 エクスポート)
# =============================================================================
# テーブル (events_YYYYMMDD) は GA4 が自動作成するため Terraform 管理外
# 既存データセットを terraform import で取り込むこと:
#   terraform import google_bigquery_dataset.ga4 projects/healthy-person-emulator/datasets/analytics_353281755

resource "google_bigquery_dataset" "ga4" {
  dataset_id    = "analytics_353281755"
  friendly_name = "GA4 Analytics"
  description   = "GA4 raw event data exported by Firebase/Analytics"
  location      = var.gcp_region

  access {
    role          = "OWNER"
    special_group = "projectOwners"
  }
  access {
    role          = "WRITER"
    special_group = "projectWriters"
  }
  access {
    role          = "READER"
    special_group = "projectReaders"
  }
  access {
    role       = "OWNER"
    user_by_email = "firebase-measurement@system.gserviceaccount.com"
  }
}

# =============================================================================
# BigQuery Dataset: searchconsole (Search Console エクスポート)
# =============================================================================
# テーブルは Search Console が自動作成するため Terraform 管理外
# 既存データセットを terraform import で取り込むこと:
#   terraform import google_bigquery_dataset.searchconsole projects/healthy-person-emulator/datasets/searchconsole

resource "google_bigquery_dataset" "searchconsole" {
  dataset_id    = "searchconsole"
  friendly_name = "Search Console"
  description   = "Dataset for Search Console export. All data is written by a robot user. For more information visit https://support.google.com/webmasters/answer/12918484"
  location      = "US"

  access {
    role          = "OWNER"
    special_group = "projectOwners"
  }
  access {
    role          = "WRITER"
    special_group = "projectWriters"
  }
  access {
    role          = "READER"
    special_group = "projectReaders"
  }
  access {
    role       = "OWNER"
    user_by_email = "search-console-data-export@system.gserviceaccount.com"
  }
}

# =============================================================================
# BigQuery Dataset: HPE_REPORTS (旧 dbt_sora32127 のビューを移行)
# =============================================================================

resource "google_bigquery_dataset" "hpe_reports" {
  dataset_id    = "HPE_REPORTS"
  friendly_name = "HPE Reports"
  description   = "Report views (migrated from dbt_sora32127)"
  location      = var.gcp_region
}

# --- report_weekly_summary ---
resource "google_bigquery_table" "report_weekly_summary" {
  dataset_id          = google_bigquery_dataset.hpe_reports.dataset_id
  table_id            = "report_weekly_summary"
  deletion_protection = false

  view {
    use_legacy_sql = false
    query          = <<-SQL
      WITH import_post_data AS (
        SELECT
          post_id,
          post_title,
          post_date_jst
        FROM `healthy-person-emulator.HPE_RAW.dim_posts`
        WHERE post_date_jst >= TIMESTAMP_TRUNC(
          CAST(
            DATETIME_ADD(
              CAST(CAST(TIMESTAMP(DATETIME(CURRENT_TIMESTAMP(), 'Asia/Tokyo')) AS DATE) AS DATETIME),
              INTERVAL -1 WEEK
            ) AS TIMESTAMP
          ),
          WEEK
        )
      ),

      import_vote_data AS (
        SELECT
          post_id,
          vote_user_ip_hash,
          vote_date_jst
        FROM `healthy-person-emulator.HPE_RAW.fct_post_vote_history`
        WHERE
          post_id IN (SELECT post_id FROM import_post_data)
          AND vote_type_int = 1
      ),

      agg_vote_data AS (
        SELECT
          post_id,
          COUNT(DISTINCT vote_user_ip_hash) AS vote_count
        FROM import_vote_data
        GROUP BY 1
      ),

      joined_post_vote AS (
        SELECT
          import_post_data.post_id,
          import_post_data.post_title,
          import_post_data.post_date_jst,
          COALESCE(agg_vote_data.vote_count, 0) AS vote_count
        FROM import_post_data
        LEFT JOIN agg_vote_data ON import_post_data.post_id = agg_vote_data.post_id
      ),

      final AS (
        SELECT
          post_id,
          post_title,
          post_date_jst,
          vote_count
        FROM joined_post_vote
        ORDER BY vote_count DESC, post_date_jst DESC
      )

      SELECT * FROM final
    SQL
  }
}

# --- report_new_legend_posts ---
resource "google_bigquery_table" "report_new_legend_posts" {
  dataset_id          = google_bigquery_dataset.hpe_reports.dataset_id
  table_id            = "report_new_legend_posts"
  deletion_protection = false

  view {
    use_legacy_sql = false
    query          = <<-SQL
      WITH legend_posts AS (
        SELECT post_id
        FROM `healthy-person-emulator.HPE_RAW.rel_post_tags`
        WHERE tag_id IN (575)
      ),

      new_legend_posts AS (
        SELECT post_id, post_title
        FROM `healthy-person-emulator.HPE_RAW.dim_posts`
        WHERE count_likes >= 100
          AND post_id NOT IN (SELECT post_id FROM legend_posts)
      )

      SELECT * FROM new_legend_posts
    SQL
  }
}

# --- report_daily_kpi ---
# 旧 stg_ga4 のロジックを GA4 テーブルへの直接クエリにインライン化
resource "google_bigquery_table" "report_daily_kpi" {
  dataset_id          = google_bigquery_dataset.hpe_reports.dataset_id
  table_id            = "report_daily_kpi"
  deletion_protection = false

  view {
    use_legacy_sql = false
    query          = <<-SQL
      WITH import_posts AS (
        SELECT post_id, post_date_jst
        FROM `healthy-person-emulator.HPE_RAW.dim_posts`
      ),

      count_posts AS (
        SELECT
          DATE(post_date_jst) AS date,
          COUNT(DISTINCT post_id) AS count_post
        FROM import_posts
        GROUP BY 1
      ),

      import_comments AS (
        SELECT comment_id, comment_date_jst
        FROM `healthy-person-emulator.HPE_RAW.dim_comments`
      ),

      count_comments AS (
        SELECT
          DATE(comment_date_jst) AS date,
          COUNT(DISTINCT comment_id) AS count_comment
        FROM import_comments
        GROUP BY 1
      ),

      import_post_vote_history AS (
        SELECT post_vote_id, vote_date_jst, vote_type_int
        FROM `healthy-person-emulator.HPE_RAW.fct_post_vote_history`
      ),

      count_post_likes_and_dislikes AS (
        SELECT
          DATE(vote_date_jst) AS date,
          SUM(CASE WHEN vote_type_int = 1 THEN 1 ELSE 0 END) AS count_post_likes,
          SUM(CASE WHEN vote_type_int = -1 THEN 1 ELSE 0 END) AS count_post_dislikes
        FROM import_post_vote_history
        GROUP BY 1
      ),

      import_comment_vote_history AS (
        SELECT comment_vote_date_jst, vote_type
        FROM `healthy-person-emulator.HPE_RAW.fct_comment_vote_history`
      ),

      count_comment_likes_and_dislikes AS (
        SELECT
          DATE(comment_vote_date_jst) AS date,
          SUM(CASE WHEN vote_type = 1 THEN 1 ELSE 0 END) AS count_comment_likes,
          SUM(CASE WHEN vote_type = -1 THEN 1 ELSE 0 END) AS count_comment_dislikes
        FROM import_comment_vote_history
        GROUP BY 1
      ),

      ga4_page_views AS (
        SELECT
          PARSE_DATE('%Y%m%d', event_date) AS date,
          COUNT(*) AS count_page_views
        FROM `healthy-person-emulator.analytics_353281755.events_*`
        WHERE event_name = 'page_view'
        GROUP BY 1
      ),

      all_dates AS (
        SELECT date FROM count_posts
        UNION DISTINCT
        SELECT date FROM count_comments
        UNION DISTINCT
        SELECT date FROM count_post_likes_and_dislikes
        UNION DISTINCT
        SELECT date FROM count_comment_likes_and_dislikes
        UNION DISTINCT
        SELECT date FROM ga4_page_views
      )

      SELECT
        all_dates.date,
        COALESCE(count_post, 0) AS count_post,
        COALESCE(count_comment, 0) AS count_comment,
        COALESCE(count_post_likes, 0) AS count_post_likes,
        COALESCE(count_post_dislikes, 0) AS count_post_dislikes,
        COALESCE(count_comment_likes, 0) AS count_comment_likes,
        COALESCE(count_comment_dislikes, 0) AS count_comment_dislikes,
        COALESCE(count_page_views, 0) AS count_page_views
      FROM all_dates
      LEFT JOIN count_posts ON all_dates.date = count_posts.date
      LEFT JOIN count_comments ON all_dates.date = count_comments.date
      LEFT JOIN count_post_likes_and_dislikes ON all_dates.date = count_post_likes_and_dislikes.date
      LEFT JOIN count_comment_likes_and_dislikes ON all_dates.date = count_comment_likes_and_dislikes.date
      LEFT JOIN ga4_page_views ON all_dates.date = ga4_page_views.date
      ORDER BY all_dates.date
    SQL
  }
}

# --- report_pv ---
# 旧 stg_ga4 のロジックを GA4 テーブルへの直接クエリにインライン化
resource "google_bigquery_table" "report_pv" {
  dataset_id          = google_bigquery_dataset.hpe_reports.dataset_id
  table_id            = "report_pv"
  deletion_protection = false

  view {
    use_legacy_sql = false
    query          = <<-SQL
      WITH ga4_events AS (
        SELECT
          PARSE_DATE('%Y%m%d', event_date) AS event_date,
          DATETIME(TIMESTAMP_MICROS(event_timestamp), 'Asia/Tokyo') AS event_datetime_jst,
          event_name,
          (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title') AS page_title,
          (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location,
          device.category AS device_category,
          device.web_info.browser AS device_web_info_browser,
          geo.country AS geo_country,
          geo.region AS geo_region,
          geo.metro AS geo_metro,
          traffic_source.name AS traffic_source_name,
          traffic_source.medium AS traffic_source_medium,
          traffic_source.source AS traffic_source_source
        FROM `healthy-person-emulator.analytics_353281755.events_*`
      ),

      agg_ga4_data AS (
        SELECT
          event_date,
          CASE
            WHEN EXTRACT(DAYOFWEEK FROM event_date) = 1 THEN 7
            ELSE EXTRACT(DAYOFWEEK FROM event_date) - 1
          END AS week,
          EXTRACT(HOUR FROM event_datetime_jst) AS hour,
          page_title,
          page_location,
          device_category,
          device_web_info_browser,
          geo_country,
          geo_region,
          geo_metro,
          traffic_source_name,
          traffic_source_medium,
          traffic_source_source,
          COUNT(1) AS count_page_views
        FROM ga4_events
        GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13
      )

      SELECT * FROM agg_ga4_data
    SQL
  }
}
