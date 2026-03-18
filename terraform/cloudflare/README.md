# Terraform 管理外のリソース
<!-- CI trigger test -->

以下のリソースは Cloudflare Terraform Provider が未対応のため、別途管理する。

| リソース | 管理方法 | ドキュメント |
|---------|---------|-------------|
| Vectorize Index | wrangler CLI | [Vectorize docs](https://developers.cloudflare.com/vectorize/) |
| Containers (Durable Objects) | wrangler.toml `[[containers]]` | [Containers docs](https://developers.cloudflare.com/containers/) |
| Secrets Store | Dashboard / API | [Secrets Store docs](https://developers.cloudflare.com/workers/configuration/secrets-store/) |
| Worker Secrets（環境変数） | wrangler CLI | [Secrets docs](https://developers.cloudflare.com/workers/configuration/secrets/) |

## Workers Script について

Workers Script のコードデプロイは引き続き `wrangler deploy` で行う。
Terraform は `lifecycle { ignore_changes = [content] }` で**インフラ設定（バインディング等）のみ**を管理する。
