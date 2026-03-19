#!/bin/bash
# セッション開始時にmainを最新化し、新しいブランチを作成して移動する
set -euo pipefail

# mainブランチに切り替え＆最新化
git checkout main 2>/dev/null
git pull origin main 2>/dev/null

# タイムスタンプベースのブランチ名を生成
BRANCH_NAME="session/$(date +%Y%m%d-%H%M%S)"
git checkout -b "$BRANCH_NAME" 2>/dev/null

echo "{\"systemMessage\": \"ブランチ $BRANCH_NAME を作成しました\"}"
