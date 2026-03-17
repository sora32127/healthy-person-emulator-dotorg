# Preview Deployment 高速化: GitHub Actions Docker Build + `--image` デプロイ

## Context

PR作成時の Preview Deployment が約5分かかっている。原因は `gcloud run deploy --source . --base-image nodejs22` が Google Cloud Buildpacks を使い、**キャッシュが一切効いていない**こと（`Warning: No cached data will be used, no cache specified`）。毎回 Node.js ランタイム、pnpm エンジン、679パッケージをゼロからダウンロードしている。

`gcloud run deploy --source` の Buildpacks モードにはキャッシュ設定オプションがないため（gcloud CLI で確認済み）、**GitHub Actions 側で Docker イメージをビルドし、`gcloud run deploy --image` でデプロイする方式**に切り替える。

目標: **5分 → 2-3分に短縮**

## 現状のビルドタイムライン（PR #273 Cloud Build ログ: `2a99ecbd`）

| ステップ | 所要時間 | 備考 |
|---|---|---|
| fetch source | 1s | 3.59 MiB |
| pre-buildpack | 5s | ビルダーイメージ準備 |
| Node.js runtime | 5s | CACHE MISS |
| pnpm engine | 3s | CACHE MISS |
| pnpm install | 22s | 679パッケージ, reused 0 |
| pnpm run build | 29s | client 23s + server 1.4s |
| pnpm prune --prod | 2s | |
| export image | 10s | |
| post-buildpack | 30s | レイヤー取得 |
| PUSH | 20s | |
| Creating Revision | 27s | |
| Routing traffic | 14s | |
| **合計** | **~5m10s** | |

## 方針

GitHub Actions で Docker イメージをビルドし、Artifact Registry に push。その後 `gcloud run deploy --image` でデプロイする。

### メリット
- `docker/build-push-action` + `cache-from/cache-to: type=gha` で **Docker レイヤーキャッシュ** が使える
- Buildpacks のオーバーヘッド（pre/post-buildpack 35s、export 10s）を排除
- ビルドとデプロイの責務が明確に分離される
- Public Repo → GitHub Actions 無料枠

### デメリット
- ワークフローが現状より複雑になる
- カスタム Dockerfile の管理が必要
- GitHub → Artifact Registry への push 時間が発生

## 変更対象ファイル

### 1. `Dockerfile` (新規作成)

```dockerfile
# Stage 1: Dependencies
FROM node:22.12.0-slim AS deps
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM deps AS build
COPY prisma ./prisma
RUN pnpm exec prisma generate
COPY . .
RUN pnpm run build
RUN pnpm prune --prod

# Stage 3: Runtime
FROM node:22.12.0-slim AS runtime
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/public ./public
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
USER appuser
CMD ["node", "build/server/index.js"]
```

**設計ポイント**:
- `deps` ステージ: `package.json` + `pnpm-lock.yaml` + `pnpm-workspace.yaml` のみコピー → lockfile 未変更時にレイヤーキャッシュ全ヒット（pnpm install スキップ）
- `build` ステージ: prisma schema を先にコピー → schema 未変更時に `prisma generate` もキャッシュヒット
- `runtime` ステージ: 最小限のファイルのみコピー（`build/`, `node_modules/`, `package.json`, `public/`）
- 非 root 実行（`appuser`）（Codex 指摘対応）
- `react-router-serve` ではなく直接 `node build/server/index.js` で起動（pnpm 不要）
- `openssl` + `ca-certificates` は Prisma の DB 接続に必要

### 2. `.github/workflows/cloud-run-preview-deployment.yml` (書き換え)

```yaml
name: Preview Deployment

on:
  pull_request_target:
    types: [opened, synchronize, reopened]
  workflow_dispatch:

concurrency:
  group: preview-${{ github.event.pull_request.number || github.run_id }}
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: preview
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Checkout
        uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
        with:
          ref: ${{ github.event.pull_request.head.sha }}

      - name: Auth to GCP
        uses: google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093 # v3
        with:
          workload_identity_provider: 'projects/793318155385/locations/global/workloadIdentityPools/github-actions-pool-3/providers/github-actions-provider-3'
          service_account: 'github-actions@healthy-person-emulator.iam.gserviceaccount.com'

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker asia-northeast1-docker.pkg.dev --quiet

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@b5ca514318bd6ebac0fb2aedd5d36ec1b5c232a2 # v3.10.0

      - name: Build and push
        uses: docker/build-push-action@14487ce63c7a62a4a0e84f15b657163f7fb78dd4 # v6.16.0
        with:
          context: .
          push: true
          tags: asia-northeast1-docker.pkg.dev/healthy-person-emulator/cloud-run-source-deploy/preview-healthy-person-emulator-dotorg:${{ github.event.pull_request.head.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy preview-healthy-person-emulator-dotorg \
            --image asia-northeast1-docker.pkg.dev/healthy-person-emulator/cloud-run-source-deploy/preview-healthy-person-emulator-dotorg:${{ github.event.pull_request.head.sha }} \
            --region=asia-northeast1 \
            --concurrency=1 \
            --memory=2Gi \
            --cpu=2 \
            --timeout=300 \
            --project=healthy-person-emulator \
            --service-account=github-actions@healthy-person-emulator.iam.gserviceaccount.com
```

**変更点まとめ**:
- `--source .` + `--base-image nodejs22` → `--image` でプリビルトイメージを指定
- `docker/setup-buildx-action` + `docker/build-push-action` を追加
- `gcloud auth configure-docker` で Artifact Registry 認証を追加
- `concurrency` 制御を追加（同一 PR の連続 push で古いデプロイをキャンセル）
- `reopened` イベントを追加
- アクションは SHA pin 済み（Codex 指摘対応）

### 3. `.dockerignore` (変更)

`Dockerfile*` の除外ルールを削除する（Docker build のコンテキストに Dockerfile を含める必要はないが、除外しているとビルドに支障が出る可能性がある）。

### 4. 本番ワークフローは変更なし

本番 (`cloud-run-production-deployment.yml`) は現状の `--source . --base-image nodejs22` のまま維持する。Preview で実績を積んでから本番移行を検討する。

## 期待される効果

### キャッシュヒット時（lockfile 未変更、通常のコード変更）

| ステップ | 所要時間 | 備考 |
|---|---|---|
| Checkout + Auth | ~10s | |
| Docker Buildx setup | ~5s | |
| Docker build: deps | ~0s | レイヤーキャッシュヒット |
| Docker build: prisma generate | ~0s | レイヤーキャッシュヒット |
| Docker build: COPY . . + build | ~30s | ソース変更分のみ再実行 |
| Docker build: prune | ~2s | |
| Docker build: runtime stage | ~0s | ベース + apt-get キャッシュヒット |
| Push to Artifact Registry | ~15-30s | 差分レイヤーのみ（未知数） |
| gcloud run deploy --image | ~30-40s | revision 作成 |
| **合計** | **~90-120s** | |

### キャッシュミス時（lockfile 変更）

| ステップ | 所要時間 | 備考 |
|---|---|---|
| Docker build: deps | ~25s | pnpm install フル |
| Docker build: build | ~35s | prisma generate + react-router build |
| Push to Artifact Registry | ~30-45s | 全レイヤー push（未知数） |
| gcloud run deploy --image | ~30-40s | |
| **合計** | **~140-170s** | |

> **注意**: GitHub Actions → Artifact Registry への push 時間は未知数。初回実測で要確認。Codex は「楽観的」と指摘しており、保守的に見積もっている。

## セキュリティに関する注記

Codex は `pull_request_target` + PR head checkout を「pwn-request パターン」と指摘した。ただし：
- **現状のワークフローも全く同じ構成** (`pull_request_target` + `ref: head.sha`)
- `environment: preview` による **手動承認ゲート** が設定されている
- 今回の変更でセキュリティモデルは変わらない（既存の信頼境界を維持）
- セキュリティモデルの改善は別タスクとして切り出す

## ロールバック

ワークフローを旧版に戻す（git revert）だけで、元の Buildpacks デプロイに戻る。Artifact Registry 上の不要イメージは手動削除が必要。

## 検証手順

1. ローカルで `docker build` が通ることを確認
   ```bash
   docker build -t preview-test .
   docker run -p 8080:8080 preview-test  # 起動確認のみ（DB接続なしでもクラッシュしなければOK）
   ```
2. PR を作成し、Preview Deployment が成功することを確認
3. GitHub Actions のログで以下を確認:
   - Docker build が成功していること
   - Artifact Registry への push が成功していること
   - `gcloud run deploy --image` が成功していること
4. 2回目のコミットを push し、キャッシュがヒットしていることを確認
5. Preview URL でアプリが正常に動作することを確認
6. 合計時間を計測し、目標（2-3分）を達成しているか確認
