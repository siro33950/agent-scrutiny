#!/usr/bin/env bash
# 初回セットアップ用。.scrutiny ディレクトリと config.json を用意し、スクリプトに実行権限を付与する。

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

mkdir -p .scrutiny

if [ ! -f config.json ]; then
  if [ -f config.json.example ]; then
    cp config.json.example config.json
    echo "Created config.json from config.json.example — 必要に応じて編集してください。"
  else
    echo "Warning: config.json.example が見つかりません。config.json を手動で作成してください。"
  fi
else
  echo "config.json は既に存在します。"
fi

chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
echo "scripts/*.sh に実行権限を付与しました。"

if [ ! -d node_modules ]; then
  echo "node_modules がありません。npm install を実行します。"
  npm install
fi

echo "Bootstrap 完了。"
