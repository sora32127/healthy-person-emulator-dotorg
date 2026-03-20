# =============================================================================
# Admin Path: Zero Trust Access (パスベース保護)
# =============================================================================

# Zero Trust Access Policy: 許可メールアドレスのみアクセス可
resource "cloudflare_zero_trust_access_policy" "admin_allow" {
  account_id = var.cloudflare_account_id
  name       = "Allow admin emails"
  decision   = "allow"

  include = [for email in var.admin_emails : {
    email = { email = email }
  }]
}

# Zero Trust Access Application: /admin パスを保護
resource "cloudflare_zero_trust_access_application" "admin" {
  zone_id          = var.cloudflare_zone_id
  name             = "Admin Panel"
  domain           = "${var.domain}/admin"
  type             = "self_hosted"
  session_duration = "24h"

  policies = [{
    id         = cloudflare_zero_trust_access_policy.admin_allow.id
    precedence = 1
  }]
}
