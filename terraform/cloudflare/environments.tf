# =============================================================================
# Production Environment
# =============================================================================
module "prd" {
  source = "./modules/worker-env"

  account_id  = var.cloudflare_account_id
  zone_id     = var.cloudflare_zone_id
  worker_name = "healthy-person-emulator-dotorg"
  d1_name     = "healthy-person-emulator-db"
  queue_name  = "social-post"
  base_url    = "https://${var.domain}"
  hostname    = var.domain

  cron_schedules = [
    { cron = "*/10 * * * *" }, # OGP生成 + ソーシャル投稿
    { cron = "0 12 * * *" },   # 殿堂入り記事レポート
    { cron = "0 12 * * 1" },   # 週間サマリーレポート
    { cron = "0 16 * * *" },   # BigQuery ETLエクスポート
  ]

  r2_static_bucket_name  = cloudflare_r2_bucket.static.name
  r2_parquet_bucket_name = cloudflare_r2_bucket.parquet.name
}

# =============================================================================
# Preview Environment
# =============================================================================
module "preview" {
  source = "./modules/worker-env"

  account_id  = var.cloudflare_account_id
  zone_id     = var.cloudflare_zone_id
  worker_name = "healthy-person-emulator-dotorg-preview"
  d1_name     = "healthy-person-emulator-db-preview"
  queue_name  = "social-post-preview"
  base_url    = "https://preview.${var.domain}"
  hostname    = "preview.${var.domain}"

  cron_schedules = [] # プレビューではCron無効

  r2_static_bucket_name  = cloudflare_r2_bucket.static.name  # 共有
  r2_parquet_bucket_name = cloudflare_r2_bucket.parquet.name # 共有
}
