#!/bin/bash
# PostToolUse hook: Nudge to commit when uncommitted changes grow
set -euo pipefail

lines=$(git diff --numstat | awk '{s+=$1+$2} END {print s+0}')
staged=$(git diff --cached --numstat | awk '{s+=$1+$2} END {print s+0}')
total=$((lines + staged))

if [ "$total" -ge 50 ]; then
  cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"NOTE: Uncommitted changes are ${total} lines. Commit your current logical unit of work now before continuing."}}
EOF
fi
