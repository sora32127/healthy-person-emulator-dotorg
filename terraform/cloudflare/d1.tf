# =============================================================================
# D1 Database
# =============================================================================

resource "cloudflare_d1_database" "main" {
  account_id = var.cloudflare_account_id
  name       = "healthy-person-emulator-db"

  read_replication = {
    mode = "disabled"
  }
}
