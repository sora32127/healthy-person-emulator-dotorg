#!/bin/bash
# PR作成前にプランファイルが未コミットで残っていないかチェックする
# PreToolUse (Bash) で gh pr create を検出して実行

set -euo pipefail

# stdinからtool_inputを読み取り、gh pr createコマンドかチェック
COMMAND=$(jq -r '.tool_input.command // ""')
if ! echo "$COMMAND" | grep -q 'gh pr create'; then
  exit 0
fi

# .agent/docs/plan/ 配下に未追跡・未ステージのファイルがないかチェック
UNTRACKED=$(git ls-files --others --exclude-standard .agent/docs/plan/ 2>/dev/null)
MODIFIED=$(git diff --name-only .agent/docs/plan/ 2>/dev/null)
STAGED=$(git diff --cached --name-only .agent/docs/plan/ 2>/dev/null)

PLAN_FILES=""
[ -n "$UNTRACKED" ] && PLAN_FILES="$UNTRACKED"
[ -n "$MODIFIED" ] && PLAN_FILES="${PLAN_FILES:+$PLAN_FILES\n}$MODIFIED"

if [ -n "$PLAN_FILES" ]; then
  echo "{\"decision\": \"block\", \"reason\": \"プランファイルが未コミットです。PRに含めてからPRを作成してください:\\n$(echo -e "$PLAN_FILES" | head -10)\"}"
  exit 0
fi

# ステージ済みだが未コミットのプランファイル
if [ -n "$STAGED" ]; then
  echo "{\"decision\": \"block\", \"reason\": \"プランファイルがステージ済みですがコミットされていません。コミットしてからPRを作成してください:\\n$STAGED\"}"
  exit 0
fi
