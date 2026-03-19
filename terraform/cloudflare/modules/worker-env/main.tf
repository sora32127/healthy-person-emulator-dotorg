resource "cloudflare_workers_script" "worker" {
  account_id          = var.account_id
  script_name         = var.worker_name
  main_module         = "worker.js"
  compatibility_date  = "2025-04-01"
  compatibility_flags = ["nodejs_compat"]

  assets = {
    config = {
      html_handling      = "auto-trailing-slash"
      not_found_handling = "none"
    }
  }

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
      text = var.base_url
    },
    # D1 Database
    {
      name = "DB"
      type = "d1"
      id   = cloudflare_d1_database.db.id
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
      bucket_name = var.r2_parquet_bucket_name
    },
    # Queue Producer
    {
      name       = "SOCIAL_POST_QUEUE"
      type       = "queue"
      queue_name = cloudflare_queue.main.queue_name
    },
    # Secrets Store (アルファベット順)
    {
      name        = "SS_AUTOMATION_DRY_RUN"
      type        = "secrets_store_secret"
      store_id    = var.secrets_store_id
      secret_name = "AUTOMATION_DRY_RUN"
    },
    {
      name        = "SS_BLUESKY_PASSWORD"
      type        = "secrets_store_secret"
      store_id    = var.secrets_store_id
      secret_name = "BLUESKY_PASSWORD"
    },
    {
      name        = "SS_BLUESKY_USER"
      type        = "secrets_store_secret"
      store_id    = var.secrets_store_id
      secret_name = "BLUESKY_USER"
    },
    {
      name        = "SS_MISSKEY_TOKEN"
      type        = "secrets_store_secret"
      store_id    = var.secrets_store_id
      secret_name = "MISSKEY_TOKEN"
    },
    {
      name        = "SS_R2_ACCESS_KEY_ID"
      type        = "secrets_store_secret"
      store_id    = var.secrets_store_id
      secret_name = "R2_ACCESS_KEY_ID"
    },
    {
      name        = "SS_R2_ENDPOINT"
      type        = "secrets_store_secret"
      store_id    = var.secrets_store_id
      secret_name = "R2_ENDPOINT"
    },
    {
      name        = "SS_R2_SECRET_ACCESS_KEY"
      type        = "secrets_store_secret"
      store_id    = var.secrets_store_id
      secret_name = "R2_SECRET_ACCESS_KEY"
    },
    {
      name        = "SS_TWITTER_AT"
      type        = "secrets_store_secret"
      store_id    = var.secrets_store_id
      secret_name = "TWITTER_AT"
    },
    {
      name        = "SS_TWITTER_ATS"
      type        = "secrets_store_secret"
      store_id    = var.secrets_store_id
      secret_name = "TWITTER_ATS"
    },
    {
      name        = "SS_TWITTER_CK"
      type        = "secrets_store_secret"
      store_id    = var.secrets_store_id
      secret_name = "TWITTER_CK"
    },
    {
      name        = "SS_TWITTER_CS"
      type        = "secrets_store_secret"
      store_id    = var.secrets_store_id
      secret_name = "TWITTER_CS"
    },
    # GCS_CREDENTIALS は wrangler secret put で設定 (Secrets Store は RSA鍵に対してサイズ制限あり)
    {
      name        = "STATIC_BUCKET"
      type        = "r2_bucket"
      bucket_name = var.r2_static_bucket_name
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
    # Workers Script のデプロイは wrangler deploy で行うため、全属性の変更を無視する
    # Terraform は state でリソースの存在を追跡するのみ
    ignore_changes = all
  }
}

# Cron Triggers（cron_schedules が空なら作成しない）
resource "cloudflare_workers_cron_trigger" "cron" {
  count       = length(var.cron_schedules) > 0 ? 1 : 0
  account_id  = var.account_id
  script_name = cloudflare_workers_script.worker.script_name

  schedules = var.cron_schedules
}

# Custom Domain
resource "cloudflare_workers_custom_domain" "domain" {
  account_id  = var.account_id
  zone_id     = var.zone_id
  hostname    = var.hostname
  service     = cloudflare_workers_script.worker.script_name
  environment = "production"
}
