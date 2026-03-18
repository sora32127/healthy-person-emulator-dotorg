# =============================================================================
# R2 Buckets
# =============================================================================

resource "cloudflare_r2_bucket" "static" {
  account_id = var.cloudflare_account_id
  name       = "healthy-person-emulator-static"
}

resource "cloudflare_r2_bucket" "parquet" {
  account_id = var.cloudflare_account_id
  name       = "hpe-parquet"
}

resource "cloudflare_r2_bucket" "terraform_state" {
  account_id = var.cloudflare_account_id
  name       = "hpe-terraform-state"
}

# =============================================================================
# R2 Custom Domain
# NOTE: Terraform provider が import をサポートしていないため管理外。
#       static.healthy-person-emulator.org → healthy-person-emulator-static
#       Cloudflare Dashboard で管理する。
# =============================================================================
