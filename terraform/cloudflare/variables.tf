# API Token は環境変数 CLOUDFLARE_API_TOKEN で渡す

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
  default     = "9ecb9a8692f7c2c5c56387d93a9a1e60"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for healthy-person-emulator.org"
  type        = string
}

variable "domain" {
  description = "Primary domain name"
  type        = string
  default     = "healthy-person-emulator.org"
}

variable "admin_emails" {
  description = "管理画面へのアクセスを許可するメールアドレスのリスト"
  type        = list(string)
}
