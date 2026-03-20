#!/bin/bash
# PreToolUse hook: gh pr create 実行前にPRに含まれるコミットを検証する
# - ブランチがorigin/mainから遅れていないか（余計なコミットの混入防止）
# - PRに含まれるコミット一覧を表示して確認を促す
set -euo pipefail

# stdinからtool_inputを読み取り、gh pr createコマンドかチェック
COMMAND=$(jq -r '.tool_input.command // ""')
if ! echo "$COMMAND" | grep -q 'gh pr create'; then
  exit 0
fi

# origin/mainを最新化
git fetch origin main --quiet 2>/dev/null

BRANCH=$(git rev-parse --abbrev-ref HEAD)
MERGE_BASE=$(git merge-base origin/main HEAD 2>/dev/null || echo "")
ORIGIN_MAIN=$(git rev-parse origin/main 2>/dev/null || echo "")

if [ -z "$MERGE_BASE" ] || [ -z "$ORIGIN_MAIN" ]; then
  echo '{"decision": "block", "reason": "origin/mainの取得に失敗しました。ネットワーク接続を確認してください。"}'
  exit 0
fi

# ブランチがorigin/mainから遅れている場合（Case A: 起点がずれている）
if [ "$MERGE_BASE" != "$ORIGIN_MAIN" ]; then
  BEHIND_COUNT=$(git rev-list --count "$MERGE_BASE".."$ORIGIN_MAIN")
  COMMITS=$(git log --oneline origin/main..HEAD)
  COMMIT_COUNT=$(echo "$COMMITS" | grep -c . || true)
  echo "{\"decision\": \"block\", \"reason\": \"ブランチがorigin/mainから${BEHIND_COUNT}コミット遅れています。rebaseしてからPRを作成してください。\\n\\nPRに含まれるコミット(${COMMIT_COUNT}件):\\n${COMMITS}\"}"
  exit 0
fi

# PRに含まれるコミット一覧を表示（Case B: 余計なコミット混入の確認）
COMMITS=$(git log --oneline origin/main..HEAD)
COMMIT_COUNT=$(echo "$COMMITS" | grep -c . || true)

if [ "$COMMIT_COUNT" -eq 0 ]; then
  echo '{"decision": "block", "reason": "PRに含めるコミットがありません。"}'
  exit 0
fi

cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"PRに含まれるコミット(${COMMIT_COUNT}件):\n${COMMITS}\n\nこれらが全て意図したコミットか確認してください。余計なコミットが含まれている場合はPR作成を中止してください。"}}
EOF
