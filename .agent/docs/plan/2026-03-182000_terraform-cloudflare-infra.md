# Terraform化プラン: 既存Cloudflareインフラの取り込み

## Context

現在すべてのインフラが `wrangler.toml` + 手動 `wrangler deploy` で管理されている。インフラの全体像を明示的にコードで持ち、変更の差分管理・レビューを可能にするため Terraform 化する。デプロイパイプライン（CI/CD）はスコープ外。

## 実施結果

### 完了: 20リソースを Terraform state に取り込み、差分ゼロを達成

```
terraform state list:
  cloudflare_zone.main
  cloudflare_dns_record.root_aaaa_1〜4, root_aaaa_workers, admin_cname, preview_cname, static_cname, google_verification
  cloudflare_d1_database.main
  cloudflare_r2_bucket.static, parquet, terraform_state
  cloudflare_queue.social_post, social_post_dlq
  cloudflare_turnstile_widget.main
  cloudflare_workers_script.main
  cloudflare_workers_cron_trigger.main
  cloudflare_workers_custom_domain.main
```

### プランからの変更点

1. **Workers Script は `ignore_changes = all` に変更**
   - 当初は `content` のみ ignore の予定だったが、Durable Object の migration tag 不整合（`old_tag` が必要）と Secrets Store バインディングの権限問題により、Terraform から Workers Script を更新できなかった
   - Workers Script は `wrangler deploy` が唯一の更新手段として機能するため、Terraform は state での存在追跡のみに留める

2. **R2 Custom Domain (`static.healthy-person-emulator.org`) は Terraform 管理外**
   - provider が import をサポートしておらず、既存リソースとの重複で create も 409 Conflict
   - r2.tf にコメントとして記載

3. **Queue Consumer は未管理**
   - 当初プランにあったが、Consumer は Workers Script 側の設定で wrangler deploy 時に自動反映されるため不要

4. **S3 Backend の設定は TF 1.5 向けに調整**
   - `endpoints` → `endpoint`、`use_path_style` → `force_path_style` 等
   - TF 1.5 では import ブロックに変数・locals が使えず、リテラル文字列が必要

5. **認証情報の管理方法**
   - `.envrc` に `CLOUDFLARE_API_TOKEN` と R2 S3互換 API 認証を配置、`source .envrc` で読み込み
   - `terraform.tfvars` には `cloudflare_zone_id` のみ

### スキル提案

- Terraform の import → plan → apply の一連の流れをスキル化すると、新規リソース追加時に便利
- Cloudflare API からリソース ID を取得する手順（Queue ID, Domain ID, Sitekey, DNS Record ID）もスキルとしてまとめておくと再利用しやすい
