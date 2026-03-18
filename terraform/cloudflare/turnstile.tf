# =============================================================================
# Turnstile Widget
# =============================================================================

resource "cloudflare_turnstile_widget" "main" {
  account_id = var.cloudflare_account_id
  name       = "healthy-person-emulator.org"
  domains = [
    "healthy-person-emulator-dotorg.sora32127.workers.dev",
    var.domain,
  ]
  mode = "managed"
}
