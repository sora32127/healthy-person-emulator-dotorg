# =============================================================================
# Queues
# =============================================================================

resource "cloudflare_queue" "social_post" {
  account_id = var.cloudflare_account_id
  queue_name = "social-post"
}

resource "cloudflare_queue" "social_post_dlq" {
  account_id = var.cloudflare_account_id
  queue_name = "social-post-dlq"
}
