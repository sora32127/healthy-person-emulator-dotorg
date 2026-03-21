# 公開API (/api/v1/*) のレートリミット
# フェーズ1: IPベースで10req/min
# フェーズ2: APIキー単位のプレミアム区別はアプリ層で実装予定

resource "cloudflare_ruleset" "api_rate_limit" {
  zone_id = var.cloudflare_zone_id
  name    = "API Rate Limiting"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules = [{
    action      = "block"
    expression  = "(http.request.uri.path matches \"^/api/v1/\")"
    description = "Public API rate limit (free tier: 10 req/min)"
    enabled     = true
    ratelimit = {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 10
      mitigation_timeout  = 60
    }
  }]
}
