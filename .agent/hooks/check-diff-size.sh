#!/bin/bash
# PostToolUse hook: Warn when uncommitted changes exceed 100 lines
set -euo pipefail

lines=$(git diff --numstat | awk '{s+=$1+$2} END {print s+0}')
staged=$(git diff --cached --numstat | awk '{s+=$1+$2} END {print s+0}')
total=$((lines + staged))

if [ "$total" -ge 100 ]; then
  cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"WARNING: Uncommitted changes are now ${total} lines (limit: 100). Consider committing current changes before making more edits."}}
EOF
fi
