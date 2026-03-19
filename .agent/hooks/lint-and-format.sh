#!/bin/bash
# PostToolUse hook: Run lint & format after TS/TSX file changes
set -euo pipefail

file_path=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')

if [ -z "$file_path" ]; then
  exit 0
fi

case "$file_path" in
  *.ts|*.tsx)
    pnpm exec vp lint "$file_path" 2>/dev/null || true
    pnpm exec vp fmt --write "$file_path" 2>/dev/null || true
    ;;
esac
