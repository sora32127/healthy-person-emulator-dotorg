# Cloudflare Container コスト削減

## Context

Cloudflareの月額請求 $24.94 のうち、Container Memory が $15.62（69%）を占めている。原因は：
- cron 10分間隔 + sleepAfter 5分 → コンテナが頻繁に起動
- instance_type `standard-1`（4 GiB メモリ）がOGP画像生成には過剰
- max_instances = 2 で2インスタンス起動される可能性

cron間隔を30分に、sleepAfterを1分に、インスタンスサイズをbasicに縮小してコストを削減する。

## 変更内容

### 1. `terraform/cloudflare/environments.tf` — cron間隔変更（Terraform管理）

行16: `*/10 * * * *` → `*/30 * * * *`

```hcl
cron_schedules = [
  { cron = "*/30 * * * *" }, # OGP生成 + ソーシャル投稿
  { cron = "0 12 * * *" },   # 殿堂入り記事レポート
  { cron = "0 12 * * 1" },   # 週間サマリーレポート
  { cron = "0 16 * * *" },   # BigQuery ETLエクスポート
]
```

### 2. `wrangler.toml` — cron間隔変更 + インスタンスサイズ縮小（wrangler deploy用）

- 行12: `*/10 * * * *` → `*/30 * * * *`
- 行106: `instance_type = "standard-1"` → `instance_type = "basic"`（1/4 vCPU, 1 GiB, 4 GB disk）

### 3. `container-worker.ts` — sleepAfter短縮

- 行6: `sleepAfter = '5m'` → `sleepAfter = '1m'`

### 4. `worker.ts` — cron判定文字列の更新

- 行35: `controller.cron === '*/10 * * * *'` → `controller.cron === '*/30 * * * *'`

## コスト試算

| 項目 | 変更前 | 変更後 |
|---|---|---|
| cron間隔 | 10分 | 30分 |
| sleepAfter | 5分 | 1分 |
| メモリサイズ | 4 GiB | 1 GiB |
| 稼働時間/回 | ~6分 | ~2分 |
| Memory課金 | $15.62 | ~$0.42 |

## 検証

1. コード変更後 `pnpm build` でビルド確認
2. `cd terraform/cloudflare && terraform plan` でcron変更のdiffを確認
3. `terraform apply` でcronトリガーを適用
4. `pnpm deploy` でWorker + Containerをデプロイ
5. Cloudflare dashboardでContainerが正常起動・OGP生成できることを確認
