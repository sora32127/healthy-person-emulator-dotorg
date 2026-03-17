#!/usr/bin/env bash
# run-review.sh
# Codex CLI を使って「厳しい上司」レビューを実行するラッパースクリプト
#
# 使い方:
#   echo "プロンプト" | ./run-review.sh -
#   ./run-review.sh "プロンプト文字列"
#   ./run-review.sh --file /path/to/prompt.md
#
# 出力: /tmp/codex-review-result.md

set -euo pipefail

CODEX_BIN="/opt/homebrew/bin/codex"
OUTPUT_FILE="/tmp/codex-review-result.md"
TIMEOUT_SECONDS=180

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

if [[ ! -x "$CODEX_BIN" ]]; then
  CODEX_BIN="$(command -v codex 2>/dev/null || true)"
  if [[ -z "$CODEX_BIN" ]]; then
    echo -e "${RED}エラー: codex が見つかりません。${NC}" >&2
    exit 1
  fi
fi

PROMPT=""

if [[ $# -eq 0 ]]; then
  PROMPT="$(cat)"
elif [[ "$1" == "-" ]]; then
  PROMPT="$(cat)"
elif [[ "$1" == "--file" ]] && [[ -n "${2:-}" ]]; then
  [[ ! -f "$2" ]] && { echo -e "${RED}エラー: ファイルが見つかりません: $2${NC}" >&2; exit 1; }
  PROMPT="$(cat "$2")"
else
  PROMPT="$*"
fi

[[ -z "$PROMPT" ]] && { echo -e "${RED}エラー: プロンプトが空です。${NC}" >&2; exit 1; }

: > "$OUTPUT_FILE"

CODEX_ARGS=(
  exec
  -s read-only
  --ephemeral
  -o "$OUTPUT_FILE"
)

echo -e "${YELLOW}Codexレビューを開始します... (最大 ${TIMEOUT_SECONDS}秒)${NC}" >&2

EXIT_CODE=0
if command -v gtimeout &>/dev/null; then
  gtimeout "$TIMEOUT_SECONDS" "$CODEX_BIN" "${CODEX_ARGS[@]}" <<< "$PROMPT" || EXIT_CODE=$?
elif command -v timeout &>/dev/null; then
  timeout "$TIMEOUT_SECONDS" "$CODEX_BIN" "${CODEX_ARGS[@]}" <<< "$PROMPT" || EXIT_CODE=$?
else
  "$CODEX_BIN" "${CODEX_ARGS[@]}" <<< "$PROMPT" || EXIT_CODE=$?
fi

[[ $EXIT_CODE -eq 124 ]] && { echo -e "${RED}タイムアウト: ${TIMEOUT_SECONDS}秒以内に完了しませんでした。${NC}" >&2; exit 124; }
[[ $EXIT_CODE -ne 0 ]] && { echo -e "${RED}Codex がエラーで終了しました (exit: $EXIT_CODE)${NC}" >&2; exit $EXIT_CODE; }
[[ ! -s "$OUTPUT_FILE" ]] && { echo -e "${RED}警告: 出力ファイルが空です。${NC}" >&2; exit 1; }

echo -e "${GREEN}レビュー完了。結果: $OUTPUT_FILE${NC}" >&2
