# GitHub Actions デプロイワークフロー統一プラン

## Context

Preview と Production で異なるビルド・デプロイ方式を使用しており、保守性・再現性が低い。統一してメンテナンスコストを下げる。

## 変更内容

### 1. `Dockerfile.preview` → `Dockerfile` にリネーム
- 内容は基本そのまま
- ただし `prisma generate` の重複実行を修正（`pnpm build` の中で既に `prisma generate` が走るため、Stage 2 の明示的な `RUN pnpm exec prisma generate` を削除）

### 2. `Dockerfile.dev` を削除 + `compose.dev.yaml` を更新
- `compose.dev.yaml:65` が `Dockerfile.dev` を参照しているため、app サービスの build 定義を変更
- `Dockerfile.dev` は deps install + prisma generate + dev server 起動をしているだけなので、`compose.dev.yaml` で直接 `node:22.12.0-slim` イメージを使い、command で pnpm install → dev 起動する方式に変更（既に volumes で `.:/app` をマウントしており、command でも `pnpm dev` を実行しているため、Dockerfile.dev はほぼ不要）

### 3. Production ワークフロー書き換え
`cloud-run-production-deployment.yml` を Preview と同じ方式に統一：

```yaml
name: Production Deployment

on:
  push:
    branches:
      - main

concurrency:
  group: production-deploy
  cancel-in-progress: false  # 本番は進行中デプロイをキャンセルしない

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Auth to GCP
        uses: google-github-actions/auth@v3
        with:
          workload_identity_provider: '...'
          service_account: '...'

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker asia-northeast1-docker.pkg.dev --quiet

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile
          push: true
          tags: asia-northeast1-docker.pkg.dev/healthy-person-emulator/cloud-run-source-deploy/healthy-person-emulator-dotorg:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy healthy-person-emulator-dotorg \
            --image asia-northeast1-docker.pkg.dev/healthy-person-emulator/cloud-run-source-deploy/healthy-person-emulator-dotorg:${{ github.sha }} \
            --region=asia-northeast1 \
            --concurrency=1 \
            --memory=2Gi \
            --cpu=2 \
            --timeout=300 \
            --project=healthy-person-emulator \
            --service-account=github-actions@healthy-person-emulator.iam.gserviceaccount.com
```

### 4. Preview ワークフローの微修正
- `file: Dockerfile.preview` → `file: Dockerfile`

### 5. actions ピン留め
- タグ指定 (`@v4`, `@v3`, `@v6`) で統一（ユーザー指定）

## ロールバック戦略
- Cloud Run は revision ベースなので、デプロイ失敗時は前の revision にトラフィックを戻すだけで復旧可能
- `gcloud run services update-traffic --to-revisions=PREVIOUS_REVISION=100` で即時ロールバック
- Artifact Registry にイメージが SHA タグで残るため、任意の過去バージョンを再デプロイ可能

## 対象ファイル

| ファイル | 操作 |
|---|---|
| `Dockerfile.preview` | `Dockerfile` にリネーム + prisma generate 重複修正 |
| `Dockerfile.dev` | 削除 |
| `compose.dev.yaml` | app サービスの build 定義を変更 |
| `.github/workflows/cloud-run-production-deployment.yml` | 全面書き換え |
| `.github/workflows/cloud-run-preview-deployment.yml` | Dockerfile 参照を修正 |

## 検証方法

1. PR を作成して Preview Deployment が正常に動作するか確認
2. main にマージして Production Deployment が正常に動作するか確認
3. Cloud Run コンソールで新しい revision が作成され、トラフィックが切り替わっていることを確認

## 実施結果 (2026-03-17)

### 実装時のプランからの変更点

1. **Production ワークフローをビルドレスに変更**: プラン当初は Production でも Docker ビルドを行う想定だったが、Preview で作成済みのイメージを再利用する方式に変更。Production ワークフローは GCP 認証 → `gcloud run deploy` のみとなり、デプロイ時間が **17秒** に短縮された。
2. **PR head SHA の取得ステップを追加**: `on: push` トリガーではマージコミットの SHA しか取れないため、`gh api repos/{repo}/commits/{sha}/pulls` で元 PR の head SHA を取得し、Preview イメージのタグと照合する仕組みを追加。
3. **`prisma generate` の削除は撤回**: `pnpm build` に `prisma generate` が含まれるため削除したが、`pnpm prune --prod` が Query Engine バイナリを削除することが判明。元の Dockerfile.preview と同じ `COPY prisma → prisma generate → COPY . → build → prune` の順序を維持。
4. **`prisma/schema.prisma` に `binaryTargets` を追加**: Docker ビルドキャッシュにより `debian-openssl-1.1.x` 用のエンジンのみがキャッシュされるケースがあったため、`binaryTargets = ["native", "debian-openssl-3.0.x"]` を明示的に追加。
5. **Branch protection を設定**: Preview Deployment の `deploy` job が成功しないと main にマージ不可（`enforce_admins: true` で管理者もバイパス不可）。

### PR

- [#278](https://github.com/sora32127/healthy-person-emulator-dotorg/pull/278): デプロイワークフロー統一 (Dockerfile リネーム、Dockerfile.dev 削除、Production をビルドレスに)
- [#279](https://github.com/sora32127/healthy-person-emulator-dotorg/pull/279): Prisma binaryTargets 修正 + prisma generate 復元

### 発生した問題と対応

1. **Production デプロイ後に Service Unavailable**: `prisma generate` を削除した結果、`pnpm prune --prod` 後に Query Engine が消失。ロールバック (`gcloud run services update-traffic --to-revisions=...=100`) で即時復旧し、PR #279 で修正。
2. **`pnpm prune --prod` 後の `prisma generate` 実行失敗**: `prisma` は devDependency のため prune 後には CLI が消えて実行不可。prune 前に戻す方式で解決。
3. **Docker ビルドキャッシュによる OpenSSL バージョン不一致**: `cache-from: type=gha` で古いレイヤーが使い回され、`debian-openssl-1.1.x` 用エンジンのみが含まれていた。`binaryTargets` の明示指定で解決。

### 最終状態

- Preview Deployment: PR 作成 → Docker ビルド → Artifact Registry push → Preview Cloud Run デプロイ
- Production Deployment: main マージ → PR head SHA 取得 → Preview イメージを Production Cloud Run にデプロイ（ビルドなし、17秒）
- ロールバック: `gcloud run services update-traffic` で即時復旧可能（実際に使用して復旧済み）
