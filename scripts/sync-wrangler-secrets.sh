#!/usr/bin/env bash
# Infisical から取得したシークレットを Cloudflare Worker に push する。
#
# 想定する利用シーン: Infisical で値を更新したあと、Cloudflare 側にも
# 反映したい時の手動ツール。CI で自動同期はせず、人がレビューしてから
# 流す前提とする。Cloudflare Secrets Store binding (SS_*) は対象外で、
# wrangler secret bulk が扱える Worker Secret のみを同期する。
#
# Usage:
#   scripts/sync-wrangler-secrets.sh --env <dev|preview|prod> [--dry-run]
#
# 必須前提:
#   - infisical CLI に login 済み (infisical login)
#   - wrangler CLI に CLOUDFLARE_API_TOKEN を持たせるか、認証済み
#   - リポジトリ直下の .infisical.json が初期化済み (infisical init)

set -euo pipefail

# ---- 同期対象 allowlist ----------------------------------------------------
# wrangler secret bulk で push する key の白リスト。
# ここに無い key は Infisical 側にあっても同期されない。
# Worker のランタイムで env として参照しているもの (app/types/env.ts 参照) のみ列挙。
ALLOWED_KEYS_JSON='[
  "HPE_SESSION_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "CLIENT_URL",
  "CF_TURNSTILE_SECRET_KEY",
  "CF_TURNSTILE_SITEKEY",
  "CF_WORKERS_AI_TOKEN",
  "GOOGLE_REDIRECT_URI",
  "INTERNAL_API_KEY",
  "GCS_CREDENTIALS",
  "BIGQUERY_CREDENTIALS",
  "HEALTHCHECK_URL",
  "ENQUEUE_ENABLED",
  "SEND_ENABLED",
  "AUTOMATION_DRY_RUN",
  "ADMIN_EMAILS"
]'

# ---- 環境 → Wrangler 設定マッピング -----------------------------------------
declare -A WRANGLER_CONFIG=(
  [dev]="wrangler.dev.toml"
  [preview]="wrangler.preview.toml"
  [prod]="wrangler.toml"
)

# ---- 引数パース ------------------------------------------------------------
ENV=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$ENV" ]]; then
  echo "ERROR: --env <dev|preview|prod> は必須です" >&2
  exit 1
fi

CONFIG="${WRANGLER_CONFIG[$ENV]:-}"
if [[ -z "$CONFIG" ]]; then
  echo "ERROR: 不明な環境: $ENV (dev|preview|prod のいずれか)" >&2
  exit 1
fi

# ---- 一時ファイル準備 -------------------------------------------------------
TMP_EXPORT="$(mktemp -t infisical-export.XXXXXX)"
TMP_FILTERED="$(mktemp -t wrangler-bulk.XXXXXX)"
trap 'rm -f "$TMP_EXPORT" "$TMP_FILTERED"' EXIT

echo "==> Infisical から $ENV 環境のシークレットを取得"
infisical export --env="$ENV" --format=json > "$TMP_EXPORT"

# allowlist のみを残す JSON を生成
ALLOWED_KEYS_JSON="$ALLOWED_KEYS_JSON" \
SRC="$TMP_EXPORT" \
DST="$TMP_FILTERED" \
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const allow = new Set(JSON.parse(process.env.ALLOWED_KEYS_JSON));
const raw = JSON.parse(readFileSync(process.env.SRC, "utf8"));
const out = Object.fromEntries(
  Object.entries(raw).filter(([k]) => allow.has(k))
);
writeFileSync(process.env.DST, JSON.stringify(out, null, 2));
console.error(`対象 key 数: ${Object.keys(out).length} / allowlist: ${allow.size}`);
'

# ---- 確認 -------------------------------------------------------------------
echo
echo "==> 同期対象"
echo "    Wrangler config: $CONFIG"
echo "    push する key:"
DST="$TMP_FILTERED" node --input-type=module -e '
import { readFileSync } from "node:fs";
const obj = JSON.parse(readFileSync(process.env.DST, "utf8"));
for (const k of Object.keys(obj)) console.log("      -", k);
'
echo

if "$DRY_RUN"; then
  echo "==> --dry-run のため実際の push は行わない"
  exit 0
fi

read -r -p "上記の内容で wrangler secret bulk を実行する? [y/N] " ans
case "$ans" in
  y|Y|yes|YES) ;;
  *) echo "中断"; exit 1 ;;
esac

echo "==> wrangler secret bulk 実行"
npx wrangler secret bulk "$TMP_FILTERED" --config "$CONFIG"
echo "==> 完了"
