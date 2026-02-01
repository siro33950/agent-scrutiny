#!/usr/bin/env bash
# tmux セッションを立てる。dev: npm run dev。agent: target ごとに 1 セッション（agentCommand を実行）。Submit は選択した target の agent セッションに送られる。

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# .ai/config.json から tmuxSession、agentCommand、targets を取得。target ごとに "SESSION_BASE-agent-TARGET_NAME\tCWD" を 1 行ずつ出力する。
list_agent_sessions() {
  node -e "
    const path = require('path');
    const fs = require('fs');
    const root = process.argv[1];
    const configPath = path.join(root, '.ai', 'config.json');
    let config = { tmuxSession: 'scrutiny', agentCommand: '', targets: { default: '.' } };
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const c = JSON.parse(raw);
      config.tmuxSession = (c.tmuxSession || process.env.AGENT_SCRUTINY_TMUX_SESSION || 'scrutiny').trim();
      config.agentCommand = (c.agentCommand || '').trim();
      config.targets = c.targets && typeof c.targets === 'object' && Object.keys(c.targets).length > 0
        ? c.targets
        : { default: '.' };
    } catch (e) {}
    const sessionBase = config.tmuxSession;
    for (const [name, rel] of Object.entries(config.targets)) {
      if (typeof rel !== 'string') continue;
      const cwd = path.resolve(root, rel.trim());
      console.log(sessionBase + '-agent-' + name + '\t' + cwd);
    }
  " "$PROJECT_ROOT"
}

CONFIG_JSON="$(node -e "
  const path = require('path');
  const fs = require('fs');
  const root = process.argv[1];
  const configPath = path.join(root, '.ai', 'config.json');
  let c = { tmuxSession: 'scrutiny', agentCommand: '' };
  try {
    c = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {}
  c.tmuxSession = (c.tmuxSession || process.env.AGENT_SCRUTINY_TMUX_SESSION || 'scrutiny').trim();
  c.agentCommand = (c.agentCommand || '').trim();
  console.log(JSON.stringify(c));
" "$PROJECT_ROOT" 2>/dev/null || echo '{"tmuxSession":"scrutiny","agentCommand":""}')"

SESSION_BASE="${AGENT_SCRUTINY_TMUX_SESSION:-$(echo "$CONFIG_JSON" | node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{ try { const c=JSON.parse(s); console.log(c.tmuxSession||'scrutiny'); } catch(e){ console.log('scrutiny'); } });")}"
DEV_SESSION="${SESSION_BASE}-dev"
AGENT_CMD="$(echo "$CONFIG_JSON" | node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{ try { const c=JSON.parse(s); console.log(c.agentCommand||''); } catch(e){ console.log(''); } });")"

if tmux has-session -t "$DEV_SESSION" 2>/dev/null; then
  tmux kill-session -t "$DEV_SESSION"
fi

# 既存の agent セッション（SESSION_BASE-agent-*）をすべて終了
for sess in $(tmux list-sessions -F '#{session_name}' 2>/dev/null); do
  case "$sess" in
    ${SESSION_BASE}-agent-*) tmux kill-session -t "$sess" 2>/dev/null || true ;;
  esac
done

# セッション dev: npm run dev（1 ペイン）
tmux new-session -d -s "$DEV_SESSION" -c "$PROJECT_ROOT"
sleep 0.5
tmux send-keys -t "$DEV_SESSION:0.0" "npm run dev" Enter

# target ごとに agent セッションを 1 つずつ立てる
while IFS= read -r line; do
  [ -z "$line" ] && continue
  sess="${line%%	*}"
  cwd="${line#*	}"
  tmux new-session -d -s "$sess" -c "$cwd"
  sleep 0.5
  if [ -n "$AGENT_CMD" ]; then
    tmux send-keys -t "${sess}:0.0" "$AGENT_CMD" Enter
  else
    tmux send-keys -t "${sess}:0.0" "echo 'AI エージェント（aider / Claude Code 等）を起動するか、.ai/config.json の agentCommand にコマンドを指定してください'" Enter
  fi
done <<< "$(list_agent_sessions)"

echo ""
echo "セッションを起動しました。"
echo "  dev:   $DEV_SESSION   （npm run dev）"
echo "  agent: ${SESSION_BASE}-agent-<target> を target ごとに 1 つ（Submit の送信先）"
echo ""
echo "次のステップ: 用途に応じてアタッチしてください。"
echo "  tmux attach-session -t $DEV_SESSION   # dev サーバーのログ"
echo "  tmux list-sessions | grep agent       # agent セッション一覧"
echo ""
echo "ブラウザで http://localhost:3000 を開いて差分を確認できます。"
echo ""
