#!/bin/bash
# ブラウザ操作ツールの全操作をログ記録し、Claudeに振り返りをリマインドするHook
# 対象: Claude in Chrome, Playwright, agent-browser
# イベント: PostToolUse（成功時）, PostToolUseFailure（失敗時）

set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // empty')

# Bashツールの場合、agent-browserコマンドかチェック
if [ "$TOOL_NAME" = "Bash" ]; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
  if [[ "$COMMAND" != *"agent-browser"* ]]; then
    exit 0
  fi
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
LOG_DIR="$REPO_ROOT/.agent/browser-tool-log"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date '+%Y-%m-%d').log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
TOOL_INPUT_SUMMARY=$(echo "$INPUT" | jq -c '.tool_input // {}' 2>/dev/null | head -c 300)

if [ "$EVENT" = "PostToolUseFailure" ]; then
  ERROR=$(echo "$INPUT" | jq -r '.error // "unknown"' 2>/dev/null | head -c 300)

  cat >> "$LOG_FILE" << EOF

## $TIMESTAMP | $TOOL_NAME | FAILED
- **raw_input**: $TOOL_INPUT_SUMMARY
- **raw_error**: $ERROR
- **意図**: (TODO: Claudeが記入)
- **原因**: (TODO: Claudeが記入)
- **解消策**: (TODO: Claudeが記入)
EOF

  cat << REMINDER
ブラウザ操作が失敗しました。$LOG_FILE の末尾にTODOエントリを作成済みです。
Editツールで「意図」「原因」「解消策」を記入してください。
過去の知見は同ディレクトリの既存ログや ~/.claude/projects/*/memory/feedback_browser_automation.md を参照してください。
REMINDER

  exit 0
fi

if [ "$EVENT" = "PostToolUse" ]; then
  TOOL_OUTPUT_SUMMARY=$(echo "$INPUT" | jq -c '.tool_output // .tool_result // {}' 2>/dev/null | head -c 300)

  cat >> "$LOG_FILE" << EOF

## $TIMESTAMP | $TOOL_NAME | OK
- **raw_input**: $TOOL_INPUT_SUMMARY
- **raw_output**: $TOOL_OUTPUT_SUMMARY
- **メモ**: (TODO: Claudeが記入 — 想定通りか、時間がかかったか、次回の注意点など)
EOF

  # 成功時はリマインドを出さない（ログだけ残す）
  # ただしセッション終了時やブラウザタスク完了時にまとめて振り返ることを推奨
  exit 0
fi

exit 0
