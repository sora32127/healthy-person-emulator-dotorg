#!/bin/bash
# PostToolUse hook: Run terraform fmt after .tf file changes
set -euo pipefail

file_path=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')

if [ -z "$file_path" ]; then
  exit 0
fi

case "$file_path" in
  *.tf)
    terraform fmt -recursive terraform/ 2>/dev/null || true
    ;;
esac
