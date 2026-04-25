# シークレット管理 (Infisical 先行導入)

このドキュメントは、健常者エミュレータ事例集における **シークレット (API キー、認証情報、トークン等) の管理方針** を述べる。

## 全体像

長期的には [Infisical](https://infisical.com) を Source of Truth として、すべてのシークレットを一元管理することを目指す。

ただし現時点での導入は **ローカル開発のみ** を対象とした「先行導入」フェーズで、以下は引き続き従来管理を継続する。

| レイヤー | 現在の管理 | 本 PR 後の状態 | 将来 |
|---|---|---|---|
| ローカル開発 (`.dev.vars`) | 各開発者が手書き | Infisical からエクスポート可能 (任意) | Infisical 必須化 |
| Cloudflare Worker Secret (`wrangler secret put`) | wrangler CLI 直 | 同上 (`scripts/sync-wrangler-secrets.sh` で push 可能) | CI 自動 sync |
| Cloudflare Secrets Store binding (`SS_*`) | wrangler / dashboard 直 | 同上 (本 PR では触らない) | API 連携検討 |
| GitHub Actions Secrets | リポジトリ Settings | 同上 | Infisical Action で動的取得 |
| Terraform (`terraform/cloudflare/.envrc`) | direnv | 同上 | 別途検討 |

つまり本 PR は **「ローカル開発で Infisical を使えるようにする」「将来の移行に必要な土台 (CLI 設定、scripts、CI 検証経路、ドキュメント) を整える」** ことに目的を絞っている。

## このPRで実際に便利になること

1. **`.dev.vars` を手書きで管理しなくてよくなる**: チームメンバー間でローカル開発用のシークレットを Infisical 経由で共有できる
2. **シークレット漏洩スキャン**: `pnpm secrets:scan` で git 履歴・ファイルを Gitleaks ベースでスキャン可能
3. **将来移行のレールが敷かれる**: Worker / CI / Terraform 移行を後続 PR で順次進められる

## CLI インストール

### macOS (Homebrew 推奨)

```sh
brew install infisical/get-cli/infisical
```

### npm

```sh
npm install -g @infisical/cli
```

### Linux (apt)

```sh
curl -1sLf 'https://artifacts-cli.infisical.com/setup.deb.sh' | sudo -E bash
sudo apt-get install -y infisical
```

詳細は [Infisical CLI install](https://infisical.com/docs/cli/overview) を参照。

## 命名規約

### Environment slug (Infisical 上の環境)

| slug | 用途 |
|---|---|
| `dev` | ローカル開発・PR Preview |
| `preview` | (将来) preview デプロイ用に分離する場合 |
| `prod` | 本番 Worker |

### Secret path (Infisical 上のフォルダ階層)

| path | 用途 |
|---|---|
| `/` (default) | Worker / ローカル両方で使うアプリ secret (例: `GOOGLE_CLIENT_*`) |
| `/github-actions` | (将来) CI でのみ使う secret (例: `CLOUDFLARE_API_TOKEN`) |
| `/terraform` | (将来) IaC でのみ使う secret (例: `AWS_ACCESS_KEY_ID`) |

### Key 名

- **SCREAMING_SNAKE_CASE** で統一
- Worker から参照する key は `app/types/env.ts` の `CloudflareEnv` と一致させる
- Cloudflare Secrets Store binding の key (`SS_TWITTER_CK` 等) は Infisical では prefix なし (`TWITTER_CK`) で保管し、binding の `secret_name` と対応付ける

## ローカル開発のセットアップ

初回のみ:

```sh
# 1. CLI インストール (上記参照)
# 2. ログイン (ブラウザが開く)
infisical login
# 3. リポジトリで init (.infisical.json を生成 — gitignore 済み)
infisical init
```

毎日:

```sh
# パターンA: 環境変数を直接 wrangler dev に注入 (推奨)
pnpm start:local:infisical

# パターンB: .dev.vars.generated にエクスポートしてから既存 start:local
pnpm secrets:pull:dev
cp .dev.vars.generated .dev.vars   # 内容を確認してから上書き
pnpm start:local
```

`pnpm secrets:pull:dev` は `.dev.vars` を **直接上書きしない**。手書きの override や個人設定が消えないよう、`.dev.vars.generated` にだけ出力する。

## Cloudflare Worker への secrets push

```sh
# 内容確認だけ (実際の push はしない)
scripts/sync-wrangler-secrets.sh --env prod --dry-run

# 実行 (確認プロンプトあり)
scripts/sync-wrangler-secrets.sh --env prod
```

スクリプト内の `ALLOWED_KEYS` に列挙した key のみが対象。Cloudflare Secrets Store binding (`SS_*`) は対象外。

## CI/CD 連携

### Infisical 接続検証ワークフロー (本PRで追加)

`.github/workflows/infisical-validate.yml` は **手動実行のみ** のワークフロー。GitHub Actions タブから「Infisical Connection Check」を選んで実行する。

利用前に GitHub Repository Secrets に下記を登録:

- `INFISICAL_CLIENT_ID` (Machine Identity の Client ID)
- `INFISICAL_CLIENT_SECRET` (Machine Identity の Client Secret)
- `INFISICAL_PROJECT_SLUG` (Infisical の Project slug、Variable でも可)

Machine Identity の作成は [Infisical Universal Auth](https://infisical.com/docs/documentation/platform/identities/universal-auth) を参照。

### 既存 deploy ワークフロー

`cf-deploy.yml` / `preview-deploy.yml` は本 PR では一切変更しない。引き続き GitHub Actions Secrets の `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を直接参照する。Infisical 経由化は、上記検証ワークフローで疎通を確認した後、別 PR で段階的に行う。

## ロールバック

Infisical の利用をやめたい場合:

1. `pnpm start:local:infisical` の代わりに `pnpm start:local` を使う
2. `.infisical.json` を削除（gitignore 済みなのでローカルから消すだけ）
3. CI の `infisical-validate.yml` を削除（手動実行しない限り無害なので残してもよい）
4. `package.json` の `secrets:*` / `start:local:infisical*` scripts は不要なら削除

既存の wrangler / GitHub Actions / Cloudflare ダッシュボードでの管理は本 PR で一切変更されていないため、Infisical を捨ててもアプリ動作には影響しない。

## 後続 PR の TODO

- [ ] Worker Secret の Infisical 一元化 (`scripts/sync-wrangler-secrets.sh` を CI から自動実行)
- [ ] Cloudflare Secrets Store binding (`SS_*`) の Infisical 一元化方針決定
- [ ] `cf-deploy.yml` / `preview-deploy.yml` で `Infisical/secrets-action` を使い `CLOUDFLARE_API_TOKEN` 等を Infisical から動的取得
- [ ] `terraform/cloudflare/.envrc` の置換 (`infisical run -- terraform apply`)
- [ ] pre-commit hook で `pnpm secrets:scan:staged` を必須化

## 参考リンク

- [Infisical CLI overview](https://infisical.com/docs/cli/overview)
- [infisical run](https://infisical.com/docs/cli/commands/run)
- [infisical export](https://infisical.com/docs/cli/commands/export)
- [Project config (.infisical.json)](https://infisical.com/docs/cli/project-config)
- [Universal Auth (Machine Identity)](https://infisical.com/docs/documentation/platform/identities/universal-auth)
- [Infisical/secrets-action (GitHub Action)](https://github.com/Infisical/secrets-action)
