# シークレット管理ルール

## 大原則

**シークレットを `.env` / `.dev.vars` に直接追記する前に、Infisical への登録を検討せよ。**

長期的には Infisical を Source of Truth として一元管理する方針 (`docs/secrets-management.md` 参照)。新しいシークレットを追加する際は、Infisical 側に置くことを第一選択とし、`.env` / `.dev.vars` 直書きは「Infisical をまだ導入していない開発者向けの暫定」として扱う。

## key 命名

- **SCREAMING_SNAKE_CASE** で統一
- Worker から参照する key は `app/types/env.ts` の `CloudflareEnv` interface に必ず追加する
- Cloudflare Secrets Store binding の key (`SS_*` prefix) は、Infisical 側では prefix なしで保管する

## エクスポート時の注意

- `pnpm secrets:pull:dev` は `.dev.vars.generated` に出力する。`.dev.vars` を直接上書きしない (手書き override 保護)
- 環境を必ず明示する (`--env=dev` など)。default に頼らない

## CI / 自動化

- 自動 push / 自動 sync を CI に組み込む際は、`scripts/sync-wrangler-secrets.sh` の allowlist パターンを踏襲し、push 対象の key を明示的に列挙する
- Cloudflare Secrets Store (`SS_*`) を CI から触る変更は、本ドキュメント執筆時点で未検証。実装前に小さい PR で疎通確認を行うこと

## スキャン

- 不安なときは `pnpm secrets:scan` で git 履歴・ファイルをスキャン
- コミット前は `pnpm secrets:scan:staged` で staged 変更だけを高速チェック可能

## 触ってはいけないもの

本 PR (Infisical 先行導入) では下記には変更を加えていない。後続 PR で扱うため、計画なく変更しないこと。

- `wrangler.toml` / `wrangler.dev.toml` / `wrangler.preview.toml` / `wrangler.dev-remote.toml`
- `.github/workflows/cf-deploy.yml` / `preview-deploy.yml`
- `terraform/cloudflare/.envrc`
- 既存の `wrangler secret put` で設定済みの secret 群
