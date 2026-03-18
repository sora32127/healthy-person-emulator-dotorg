# =============================================================================
# Workers Script
# =============================================================================

resource "cloudflare_workers_script" "main" {
  account_id          = var.cloudflare_account_id
  script_name         = "healthy-person-emulator-dotorg"
  main_module         = "worker.js"
  compatibility_date  = "2025-04-01"
  compatibility_flags = ["nodejs_compat"]

  # Assets
  assets = {
    config = {
      html_handling      = "auto-trailing-slash"
      not_found_handling = "none"
    }
  }

  # Observability
  observability = {
    enabled = true
  }

  # --- Bindings (アルファベット順 - Cloudflare API の返却順に合わせる) ---

  bindings = [
    # AI
    {
      name = "AI"
      type = "ai"
    },
    # Durable Object (Container)
    {
      name       = "AUTOMATION_CONTAINER"
      type       = "durable_object_namespace"
      class_name = "AutomationContainer"
    },
    # Plain text vars
    {
      name = "BASE_URL"
      type = "plain_text"
      text = "https://healthy-person-emulator.org"
    },
    # D1 Database
    {
      name = "DB"
      type = "d1"
      id   = cloudflare_d1_database.main.id
    },
    {
      name = "GCS_PARQUET_BASE_URL"
      type = "plain_text"
      text = "https://storage.googleapis.com/hpe-temp"
    },
    # R2 Buckets
    {
      name        = "PARQUET_BUCKET"
      type        = "r2_bucket"
      bucket_name = cloudflare_r2_bucket.parquet.name
    },
    # Queue Producer
    {
      name       = "SOCIAL_POST_QUEUE"
      type       = "queue"
      queue_name = cloudflare_queue.social_post.queue_name
    },
    # Secrets Store (アルファベット順)
    {
      name        = "SS_AUTOMATION_DRY_RUN"
      type        = "secrets_store_secret"
      store_id    = "52f3d1be601046039169fad4f66570d1"
      secret_name = "AUTOMATION_DRY_RUN"
    },
    {
      name        = "SS_BLUESKY_PASSWORD"
      type        = "secrets_store_secret"
      store_id    = "52f3d1be601046039169fad4f66570d1"
      secret_name = "BLUESKY_PASSWORD"
    },
    {
      name        = "SS_BLUESKY_USER"
      type        = "secrets_store_secret"
      store_id    = "52f3d1be601046039169fad4f66570d1"
      secret_name = "BLUESKY_USER"
    },
    {
      name        = "SS_MISSKEY_TOKEN"
      type        = "secrets_store_secret"
      store_id    = "52f3d1be601046039169fad4f66570d1"
      secret_name = "MISSKEY_TOKEN"
    },
    {
      name        = "SS_R2_ACCESS_KEY_ID"
      type        = "secrets_store_secret"
      store_id    = "52f3d1be601046039169fad4f66570d1"
      secret_name = "R2_ACCESS_KEY_ID"
    },
    {
      name        = "SS_R2_ENDPOINT"
      type        = "secrets_store_secret"
      store_id    = "52f3d1be601046039169fad4f66570d1"
      secret_name = "R2_ENDPOINT"
    },
    {
      name        = "SS_R2_SECRET_ACCESS_KEY"
      type        = "secrets_store_secret"
      store_id    = "52f3d1be601046039169fad4f66570d1"
      secret_name = "R2_SECRET_ACCESS_KEY"
    },
    {
      name        = "SS_TWITTER_AT"
      type        = "secrets_store_secret"
      store_id    = "52f3d1be601046039169fad4f66570d1"
      secret_name = "TWITTER_AT"
    },
    {
      name        = "SS_TWITTER_ATS"
      type        = "secrets_store_secret"
      store_id    = "52f3d1be601046039169fad4f66570d1"
      secret_name = "TWITTER_ATS"
    },
    {
      name        = "SS_TWITTER_CK"
      type        = "secrets_store_secret"
      store_id    = "52f3d1be601046039169fad4f66570d1"
      secret_name = "TWITTER_CK"
    },
    {
      name        = "SS_TWITTER_CS"
      type        = "secrets_store_secret"
      store_id    = "52f3d1be601046039169fad4f66570d1"
      secret_name = "TWITTER_CS"
    },
    {
      name        = "STATIC_BUCKET"
      type        = "r2_bucket"
      bucket_name = cloudflare_r2_bucket.static.name
    },
    # Vectorize
    {
      name       = "VECTORIZE"
      type       = "vectorize"
      index_name = "embeddings-index"
    },
  ]

  # Durable Object migrations
  migrations = {
    new_sqlite_classes = ["AutomationContainer"]
    new_tag            = "v2"
  }

  lifecycle {
    # コードのデプロイは wrangler deploy で行うため、これらの変更は無視する
    # Workers Script のデプロイは wrangler deploy で行うため、全属性の変更を無視する
    # Terraform は state でリソースの存在を追跡するのみ
    ignore_changes = all
  }
}

# =============================================================================
# Cron Triggers
# =============================================================================

resource "cloudflare_workers_cron_trigger" "main" {
  account_id  = var.cloudflare_account_id
  script_name = cloudflare_workers_script.main.script_name

  schedules = [
    { cron = "*/10 * * * *" }, # OGP生成 + ソーシャル投稿
    { cron = "0 12 * * *" },   # 殿堂入り記事レポート
    { cron = "0 12 * * 1" },   # 週間サマリーレポート
    { cron = "0 16 * * *" },   # BigQuery ETLエクスポート
  ]
}

# =============================================================================
# Workers Custom Domain
# =============================================================================

resource "cloudflare_workers_custom_domain" "main" {
  account_id  = var.cloudflare_account_id
  zone_id     = var.cloudflare_zone_id
  hostname    = var.domain
  service     = cloudflare_workers_script.main.script_name
  environment = "production"
}
