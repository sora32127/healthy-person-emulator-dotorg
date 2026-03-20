# =============================================================================
# DNS Zone
# =============================================================================

resource "cloudflare_zone" "main" {
  account = {
    id = var.cloudflare_account_id
  }
  name = var.domain
  type = "full"
}

# =============================================================================
# DNS Records
# =============================================================================

# --- Root domain AAAA records (Google legacy) ---
resource "cloudflare_dns_record" "root_aaaa_1" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "AAAA"
  content = "2001:4860:4802:32::15"
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "root_aaaa_2" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "AAAA"
  content = "2001:4860:4802:34::15"
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "root_aaaa_3" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "AAAA"
  content = "2001:4860:4802:36::15"
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "root_aaaa_4" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "AAAA"
  content = "2001:4860:4802:38::15"
  proxied = true
  ttl     = 1
}

# --- Root domain AAAA record (Workers) ---
resource "cloudflare_dns_record" "root_aaaa_workers" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "AAAA"
  content = "100::"
  proxied = true
  ttl     = 1
}

# admin subdomain は Workers Custom Domain が DNS を自動管理するため削除
# (terraform/cloudflare/access.tf で管理)

# preview subdomain は Workers Custom Domain が DNS を自動管理するため削除

# --- CNAME: static subdomain (R2 public bucket) ---
resource "cloudflare_dns_record" "static_cname" {
  zone_id = var.cloudflare_zone_id
  name    = "static.${var.domain}"
  type    = "CNAME"
  content = "public.r2.dev"
  proxied = true
  ttl     = 1
}

# --- TXT: Google site verification ---
resource "cloudflare_dns_record" "google_verification" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "TXT"
  content = "google-site-verification=2nhX9FL_TTawzmeG6M2tSFeXITrdwRy0sYa8H9DyUSI"
  proxied = false
  ttl     = 3600
}
