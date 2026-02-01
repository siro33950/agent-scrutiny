#!/usr/bin/env bash
# tmux セッションを 2 つ立てる。dev: npm run dev。agent: agentCommand。Submit は agent セッションに送られる。

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# .ai/config.json から tmuxSession（ベース名）、agentCommand、targetDir を取得（Node で読む）
get_config() {
  node -e "
    const path = require('path');
    const fs = require('fs');
    const root = process.argv[1];
    const configPath = path.join(root, '.ai', 'config.json');
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const c = JSON.parse(raw);
      const targetDirRaw = (c.targetDir && c.targetDir.trim()) || process.env.AGENT_SCRUTINY_TARGET_DIR || root;
      const targetDir = path.resolve(root, targetDirRaw);
      console.log(JSON.stringify({
        tmuxSession: (c.tmuxSession || process.env.AGENT_SCRUTINY_TMUX_SESSION || 'scrutiny').trim(),
        agentCommand: (c.agentCommand || '').trim(),
        targetDir: targetDir
      }));
    } catch (e) {
      console.log(JSON.stringify({ tmuxSession: 'scrutiny', agentCommand: '', targetDir: process.argv[1] }));
    }
  " "$PROJECT_ROOT" 2>/dev/null || echo '{"tmuxSession":"scrutiny","agentCommand":"","targetDir":"'"$PROJECT_ROOT"'"}'
}
CONFIG="$(get_config)"
SESSION_BASE="${AGENT_SCRUTINY_TMUX_SESSION:-$(echo "$CONFIG" | node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{ try { const c=JSON.parse(s); console.log(c.tmuxSession||'scrutiny'); } catch(e){ console.log('scrutiny'); } });")}"
DEV_SESSION="${SESSION_BASE}-dev"
AGENT_SESSION="${SESSION_BASE}-agent"
AGENT_CMD="$(echo "$CONFIG" | node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{ try { const c=JSON.parse(s); console.log(c.agentCommand||''); } catch(e){ console.log(''); } });")"
AGENT_CWD="$(echo "$CONFIG" | node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{ try { const c=JSON.parse(s); console.log(c.targetDir||''); } catch(e){ console.log(''); } });")"
[ -z "$AGENT_CWD" ] && AGENT_CWD="$PROJECT_ROOT"

# tmux マウス操作を有効化（クリックでフォーカス、スクロール、リサイズ）
TMUX_CONF="${HOME}/.tmux.conf"
if [ -f "$TMUX_CONF" ]; then
  grep -q "set -g mouse on" "$TMUX_CONF" 2>/dev/null || { echo "" >> "$TMUX_CONF"; echo "# AgentScrutiny: マウス操作" >> "$TMUX_CONF"; echo "set -g mouse on" >> "$TMUX_CONF"; }
else
  echo "# AgentScrutiny: マウス操作" > "$TMUX_CONF"
  echo "set -g mouse on" >> "$TMUX_CONF"
fi
if command -v tmux &>/dev/null && tmux list-sessions &>/dev/null; then
  tmux source-file "$TMUX_CONF" 2>/dev/null || true
fi

if tmux has-session -t "$DEV_SESSION" 2>/dev/null; then
  tmux kill-session -t "$DEV_SESSION"
fi
if tmux has-session -t "$AGENT_SESSION" 2>/dev/null; then
  tmux kill-session -t "$AGENT_SESSION"
fi

# セッション dev: npm run dev（1 ペイン）
tmux new-session -d -s "$DEV_SESSION" -c "$PROJECT_ROOT"
sleep 0.5
tmux send-keys -t "$DEV_SESSION:0.0" "npm run dev" Enter

# セッション agent: agentCommand（1 ペイン）。Submit はここに送られる。作業ディレクトリは targetDir。
tmux new-session -d -s "$AGENT_SESSION" -c "$AGENT_CWD"
sleep 0.5
if [ -n "$AGENT_CMD" ]; then
  tmux send-keys -t "$AGENT_SESSION:0.0" "$AGENT_CMD" Enter
else
  tmux send-keys -t "$AGENT_SESSION:0.0" "echo 'AI エージェント（aider / Claude Code 等）を起動するか、.ai/config.json の agentCommand にコマンドを指定してください'" Enter
fi

echo ""
echo "セッションを 2 つ起動しました。"
echo "  dev:   $DEV_SESSION   （npm run dev）"
echo "  agent: $AGENT_SESSION （Submit の送信先）"
echo "  agent の作業ディレクトリ: $AGENT_CWD"
echo ""
echo "次のステップ: 用途に応じてアタッチしてください。"
echo "  tmux attach-session -t $DEV_SESSION   # dev サーバーのログ"
echo "  tmux attach-session -t $AGENT_SESSION # エージェントに指示を送る"
echo ""
echo "ブラウザで http://localhost:3000 を開いて差分を確認できます。"
echo ""
