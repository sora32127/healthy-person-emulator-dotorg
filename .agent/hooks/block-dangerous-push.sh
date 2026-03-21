#!/usr/bin/env bash
# PreToolUse hook: mainへの直接pushとforce-pushをブロックする
set -euo pipefail

CMD=$(jq -r '.tool_input.command // empty')

# Bashツール以外は無視
[ -z "$CMD" ] && exit 0

# git pushコマンド以外は無視
echo "$CMD" | grep -qE '^\s*git\s+push\b' || exit 0

# force-pushをブロック (--force, -f, --force-with-lease)
if echo "$CMD" | grep -qE '\s(--force|-f|--force-with-lease)\b'; then
  echo '{"decision":"block","reason":"force-pushは禁止されています。"}'
  exit 0
fi

# mainブランチへの直接pushをブロック
# パターン: git push origin main, git push origin/main, git push -u origin main 等
if echo "$CMD" | grep -qE '\bgit\s+push\b.*\b(origin\s+main|origin/main)\b'; then
  echo '{"decision":"block","reason":"mainブランチへの直接pushは禁止されています。ブランチを切ってPRを作成してください。"}'
  exit 0
fi

exit 0
