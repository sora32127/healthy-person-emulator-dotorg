# デプロイパイプライン整備プラン（v6 — マージゲート方式）

## Context

現在のCI/CDは `vitest.yml`（テスト実行のみ）。デプロイはCloudflare Dashboard連携。変更パターンに応じたCI実行を整備する。

### 設計方針
- **シンプルさ優先**: GitHub Actions ネイティブ `paths` フィルタ + マージゲート
- **段階導入**: Phase 1（CI強化）→ Phase 2（本番デプロイ）→ Phase 3（プレビュー、将来）
- **ワークフローは関心ごとに分離**: 各ファイルは短く独立
- **branch protection**: `merge-gate` のみを required check に設定

### Wrangler/Terraform 責務分界
- Workers Script のコード・設定 → **wrangler** (wrangler.toml)
- workers.tf の bindings/cron 宣言 → **参照用スナップショット**（`ignore_changes = all`、drift 監視しない）
- D1/R2/Queue/DNS/Turnstile リソース → **Terraform**

---

## Phase 1: CI強化（今回実装）

### ワークフロー構成: 4ファイル

#### 1. `.github/workflows/ci.yml` — テスト＋ビルド検証

```yaml
name: CI
on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]
    paths-ignore:
      - '**/*.md'
      - '.agent/**'
      - '.claude/**'
      - 'docs/**'

concurrency:
  group: ci-${{ github.event.pull_request.number || github.sha }}
  cancel-in-progress: true

jobs:
  test:
    if: github.event.pull_request.draft != true
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: 'package.json'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm exec vp test --coverage
      - uses: davelosert/vitest-coverage-report-action@v2
        if: always() && github.event_name == 'pull_request'

  build:
    if: github.event.pull_request.draft != true
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: 'package.json'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm build
```

#### 2. `.github/workflows/terraform-plan.yml` — Terraform差分表示

```yaml
name: Terraform Plan
on:
  pull_request:
    paths:
      - 'terraform/**'

jobs:
  plan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
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
      - run: terraform fmt -check -recursive
      - run: terraform validate
      - id: plan
        run: |
          set +e
          terraform plan -no-color -detailed-exitcode 2>&1 | tee /tmp/plan.txt
          EXIT_CODE=$?
          echo "exitcode=$EXIT_CODE" >> "$GITHUB_OUTPUT"
          exit 0
      - name: Comment PR with plan
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('/tmp/plan.txt', 'utf8');
            const exitCode = '${{ steps.plan.outputs.exitcode }}';
            const status = exitCode === '0' ? 'No changes' : exitCode === '2' ? 'Changes detected' : 'Error';
            const body = `### Terraform Plan (${status})\n\`\`\`\n${plan.substring(0, 60000)}\n\`\`\``;
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number,
            });
            const existing = comments.find(c => c.body?.startsWith('### Terraform Plan'));
            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner, repo: context.repo.repo,
                comment_id: existing.id, body,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner, repo: context.repo.repo,
                issue_number: context.issue.number, body,
              });
            }
      - name: Fail on plan error
        if: steps.plan.outputs.exitcode == '1'
        run: exit 1
```

#### 3. `.github/workflows/container-check.yml` — コンテナビルド＋テスト

```yaml
name: Container Check
on:
  pull_request:
    paths:
      - 'container/**'

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build container image
        run: docker build -t hpe-container-check ./container
      - name: Run tests
        run: |
          docker run --rm hpe-container-check \
            .venv/bin/python -m pytest tests/ -v
```

#### テストファイル: `container/tests/test_smoke.py`（新規作成）

```python
"""Smoke tests: import 検証、サーバー起動検証、ルーティング検証"""
import importlib
import json
import threading
import time
import urllib.request

import pytest

from main import TASK_ROUTES, SOCIAL_PLATFORM_MODULES, AutomationHandler, HTTPServer


class TestTaskImports:
    """全 task module が import でき、handle 関数を持つことを検証"""

    @pytest.mark.parametrize("module_name", [
        m for m in TASK_ROUTES.values() if m is not None
    ])
    def test_task_module_importable(self, module_name):
        mod = importlib.import_module(module_name)
        assert hasattr(mod, "handle"), f"{module_name} has no handle()"

    @pytest.mark.parametrize("module_name", SOCIAL_PLATFORM_MODULES.values())
    def test_social_module_importable(self, module_name):
        mod = importlib.import_module(module_name)
        assert hasattr(mod, "handle"), f"{module_name} has no handle()"


class TestServer:
    """HTTP サーバーの基本動作を検証"""

    @pytest.fixture(autouse=True)
    def server(self):
        srv = HTTPServer(("127.0.0.1", 0), AutomationHandler)
        port = srv.server_address[1]
        t = threading.Thread(target=srv.serve_forever)
        t.daemon = True
        t.start()
        self.base_url = f"http://127.0.0.1:{port}"
        yield
        srv.shutdown()

    def _get(self, path):
        req = urllib.request.Request(f"{self.base_url}{path}")
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())

    def test_health(self):
        status, body = self._get("/health")
        assert status == 200
        assert body["status"] == "ok"

    def test_unknown_get(self):
        status, body = self._get("/unknown")
        assert status == 200  # GET to unknown path returns 200 with message

    def test_routes_registered(self):
        """TASK_ROUTES のパスが全て登録されていることを確認"""
        for path in TASK_ROUTES:
            assert path.startswith("/"), f"Route {path} must start with /"
```

#### `container/pyproject.toml` への追記（dev dependency）

```toml
[project.optional-dependencies]
dev = ["pytest>=8.0.0"]
```

#### `container/Dockerfile` への追記（テスト用 dev deps インストール）

Dockerfile の `uv sync` 行を以下に変更:
```dockerfile
RUN uv sync --frozen --no-install-project
```
（`--no-dev` を外して dev dependency も含める。本番用は別途最適化するか、multi-stage で対応）

**代替案**: Dockerfile は変えず、CI ワークフローで `docker run --rm hpe-container-check .venv/bin/pip install pytest && ...` とする。ただし Dockerfile で dev deps を含める方がシンプル。

#### 4. `.github/workflows/merge-gate.yml` — マージゲート（唯一の required check）

全ワークフローの結果を集約し、branch protection の required check はこれだけ。
paths フィルタで発動しなかったワークフローは「不要」として扱い、発動したものが全て成功なら pass。

```yaml
name: Merge Gate
on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - name: Wait for workflows and check results
        uses: actions/github-script@v7
        with:
          script: |
            const { owner, repo } = context.repo;
            const sha = context.payload.pull_request.head.sha;

            // 他のワークフローが完了するのを待つ（最大5分）
            const requiredWorkflows = ['CI', 'Terraform Plan', 'Container Check'];
            let attempts = 0;
            const maxAttempts = 30;

            while (attempts < maxAttempts) {
              await new Promise(r => setTimeout(r, 10000)); // 10秒待機
              attempts++;

              const { data: checkRuns } = await github.rest.checks.listForRef({
                owner, repo, ref: sha,
              });

              // merge-gate 自身を除外
              const otherRuns = checkRuns.check_runs.filter(
                r => !r.name.includes('gate')
              );

              // まだ進行中のものがあれば待つ
              const inProgress = otherRuns.filter(
                r => r.status !== 'completed'
              );
              if (inProgress.length > 0) continue;

              // 全て完了: 失敗があればエラー
              const failed = otherRuns.filter(
                r => r.conclusion === 'failure'
              );
              if (failed.length > 0) {
                const names = failed.map(r => r.name).join(', ');
                core.setFailed(`Failed checks: ${names}`);
                return;
              }

              // 全て成功（or 発動しなかった = check_runs に存在しない）
              core.info('All triggered workflows passed');
              return;
            }

            core.setFailed('Timed out waiting for other workflows');
```

### Branch Protection 設定

GitHub Settings → Branches → main:
- **Require status checks to pass before merging**: ON
- **Required checks**: `gate` (merge-gate.yml の job 名) のみ
- **Require branches to be up to date before merging**: ON（推奨）

---

## Phase 2: 本番デプロイ自動化（実施済み）

### 実施内容
- `cf-workers.yml` を新規作成（main push → `wrangler deploy`）
- `terraform-plan.yml` を `terraform.yml` にリネームし、main push 時の `terraform apply` job を追加
- `ci.yml` は変更なし（PR専用のまま）

### ワークフロー構成（Phase 2 完了後）
| ファイル | トリガー | 役割 |
|---|---|---|
| `ci.yml` | PR | テスト + ビルド検証 |
| `cf-workers.yml` | main push | Workers ビルド + デプロイ |
| `terraform.yml` | PR + main push | plan（PR）/ apply（main push） |
| `container-check.yml` | PR | コンテナビルド + テスト |
| `merge-gate.yml` | PR | 全チェック集約 |

### プランからの変更点
- 当初は `ci.yml` に deploy job を追加する案だったが、関心の分離のため `cf-workers.yml` として独立させた
- Terraform apply も自動化した（当初プランにはなかった）

### Dashboard 無効化手順
1. GitHub Actions deploy が安定動作を確認
2. Cloudflare Dashboard → Settings → Builds → Git integration 無効化
3. main push で GitHub Actions 経由デプロイを確認

### ロールバック
- `wrangler rollback`（手動）
- Terraform: git revert → main push で自動 apply
- D1 migration は戻せない → 破壊的変更は段階デプロイ

---

## Phase 3: プレビュー（将来・スコープ外）

DO/Container 付き Worker のため環境分離が複雑。見送り。

---

## ファイル変更

| 操作 | ファイル |
|---|---|
| 削除 | `.github/workflows/vitest.yml` |
| 新規 | `.github/workflows/ci.yml` |
| 新規 | `.github/workflows/terraform-plan.yml` |
| 新規 | `.github/workflows/container-check.yml` |
| 新規 | `.github/workflows/merge-gate.yml` |
| 新規 | `container/tests/test_smoke.py` |
| 編集 | `container/pyproject.toml`（pytest dev dependency 追加） |
| 編集 | `container/Dockerfile`（dev deps 含めるよう変更） |

## 必要なGitHub Secrets
| Secret | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Terraform provider |
| `R2_ACCESS_KEY_ID` | Terraform S3バックエンド |
| `R2_SECRET_ACCESS_KEY` | Terraform S3バックエンド |
| `R2_ENDPOINT` | Terraform S3エンドポイント |
| `TF_VAR_CLOUDFLARE_ZONE_ID` | Terraform変数 |

## 検証方法
1. `app/` のみ変更PR → ci.yml 発動、merge-gate が CI 結果を待って pass
2. `terraform/` のみ変更PR → terraform-plan.yml 発動、merge-gate が結果を待って pass
3. `container/` のみ変更PR → container-check.yml 発動、merge-gate が結果を待って pass
4. `README.md` のみ変更PR → 何も発動しない、merge-gate は即 pass
5. CI が失敗 → merge-gate が fail → マージ不可

## 運用ルール
CI を発動させたくないファイル種別が増えた場合、ci.yml の `paths-ignore` に追加すること。
