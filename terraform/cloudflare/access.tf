# =============================================================================
# Admin Subdomain: Workers Custom Domain + Zero Trust Access
# =============================================================================

# admin サブドメインをプロダクション Worker にルーティングする
resource "cloudflare_workers_custom_domain" "admin" {
  account_id = var.cloudflare_account_id
  zone_id    = var.cloudflare_zone_id
  hostname   = "admin.${var.domain}"
  service    = module.prd.worker_script_name
}

# Zero Trust Access Policy: 許可メールアドレスのみアクセス可
resource "cloudflare_zero_trust_access_policy" "admin_allow" {
  account_id = var.cloudflare_account_id
  name       = "Allow admin emails"
  decision   = "allow"

  include = [for email in var.admin_emails : {
    email = { email = email }
  }]
}

# Zero Trust Access Application
resource "cloudflare_zero_trust_access_application" "admin" {
  zone_id          = var.cloudflare_zone_id
  name             = "Admin Panel"
  domain           = "admin.${var.domain}"
  type             = "self_hosted"
  session_duration = "24h"

  policies = [{
    id         = cloudflare_zero_trust_access_policy.admin_allow.id
    precedence = 1
  }]
}
