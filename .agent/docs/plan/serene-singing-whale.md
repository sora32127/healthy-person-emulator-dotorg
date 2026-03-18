# デプロイパイプライン整備プラン

## Context

Phase 1（CI強化）が完了し、PR時のテスト・ビルド・Terraform plan・コンテナチェック・マージゲートが動作している。
現在、本番デプロイは `wrangler deploy` と `terraform apply` を手動で実行している。
mainブランチへのマージ時に自動デプロイするCDパイプラインを構築する。

## 方針

- ワークフローは**デプロイ対象ごと**に分離（関心の分離）
- `ci.yml`（test/build）は PR 専用のまま変更しない
- 新規 `cf-workers.yml` で Workers デプロイを担当
- `terraform-plan.yml` → `terraform.yml` にリネームし plan + apply を統合

## ワークフロー構成（変更後）

| ファイル | トリガー | 役割 |
|---|---|---|
| `ci.yml` | PR | テスト + ビルド検証（**変更なし**） |
| `cf-workers.yml` | main push | Workers ビルド + デプロイ（**新規**） |
| `terraform.yml` | PR + main push | plan（PR）/ apply（main push） |
| `container-check.yml` | PR | コンテナビルド + テスト（**変更なし**） |
| `merge-gate.yml` | PR | 全チェック集約（**変更なし**） |

## 変更内容

### 1. `.github/workflows/cf-workers.yml` — 新規作成

main push 時に Workers をビルド＆デプロイ。CI はマージ前に通過済みなのでテストは再実行しない。

```yaml
name: Deploy Workers
on:
  push:
    branches: [main]
    paths-ignore:
      - "**/*.md"
      - ".agent/**"
      - ".claude/**"
      - "docs/**"
      - "terraform/**"

concurrency:
  group: production-deploy
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: "package.json"
          cache: "pnpm"
      - run: pnpm install
      - run: pnpm build
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

**ポイント:**
- CI（test/build）はマージゲートで通過済みなので再実行不要
- `paths-ignore` で terraform のみの変更ではデプロイしない
- `concurrency: production-deploy` で同時デプロイを防止（`cancel-in-progress: false`）

### 2. `.github/workflows/terraform.yml` — plan + apply（リネーム+編集）

既存の `terraform-plan.yml` をリネームし、apply job を追加。

```yaml
name: Terraform
on:
  pull_request:
    paths:
      - "terraform/**"
  push:
    branches: [main]
    paths:
      - "terraform/**"

jobs:
  plan:
    if: github.event_name == 'pull_request'
    # ... 既存のplan job（変更なし）

  apply:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    concurrency:
      group: terraform-apply
      cancel-in-progress: false
    defaults:
      run:
        working-directory: terraform/cloudflare
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
      AWS_ENDPOINT_URL_S3: ${{ secrets.R2_ENDPOINT }}
      TF_VAR_cloudflare_zone_id: ${{ secrets.TF_VAR_CLOUDFLARE_ZONE_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "~> 1.5"
      - run: terraform init
      - run: terraform apply -auto-approve
```

**ポイント:**
- PRでは plan（既存動作）、main push では apply
- `concurrency: terraform-apply` で同時実行を防止
- PR時の plan job は PR コメントへの差分表示を維持

### 3. `.github/workflows/terraform-plan.yml` — 削除

`terraform.yml` に統合されるため削除。

## 必要なGitHub Secrets（追加分）

| Secret | 用途 |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | wrangler deploy に必要 |

既存のsecrets（`CLOUDFLARE_API_TOKEN`, `R2_*`, `TF_VAR_CLOUDFLARE_ZONE_ID`）はそのまま利用。

## ファイル変更まとめ

| 操作 | ファイル |
|---|---|
| 変更なし | `.github/workflows/ci.yml` |
| 新規 | `.github/workflows/cf-workers.yml`（Workers デプロイ） |
| リネーム+編集 | `.github/workflows/terraform-plan.yml` → `terraform.yml`（apply job 追加） |

## 検証方法

1. `CLOUDFLARE_ACCOUNT_ID` secretをGitHubに追加
2. アプリコード変更をmainにマージ → ci.yml の deploy job が発動、wrangler deploy 成功を確認
3. terraform/ 変更をmainにマージ → terraform.yml の apply job が発動、terraform apply 成功を確認
4. terraform/ のみの変更 → ci.yml の deploy job は発動しないことを確認
5. PR時は既存動作（test, build, plan, merge-gate）が変わらないことを確認

## ロールバック

- Workers: `wrangler rollback`（手動）
- Terraform: git revert → main push で自動 apply
- D1 migration: 戻せない → 破壊的変更は段階デプロイ
