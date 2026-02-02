import { spawnSync } from "child_process";
import { NextResponse } from "next/server";
import { loadConfig, getTargetNames, getTargetDir } from "@/lib/config";

/**
 * tmux セッション名用に target 名を正規化する（start-scrutiny.sh と同じルール）。
 * 英数字・ハイフン・アンダースコアのみ許可し、それ以外は _ に置換する。
 */
function sanitizeSessionName(name: string): string {
  const s = name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return s || "default";
}

const COMMIT_INSTRUCTION = "現在の変更をコミットしてください。";

export async function POST(request: Request) {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const targetNames = getTargetNames(config);
  let target: string;
  try {
    const body = await request.json().catch(() => ({}));
    const requested = body?.target;
    if (requested && typeof requested === "string" && config.targets[requested]) {
      target = requested;
    } else {
      target = targetNames[0] ?? "default";
    }
  } catch {
    target = targetNames[0] ?? "default";
  }

  getTargetDir(projectRoot, config, target);

  const sessionBase = config.tmuxSession ?? process.env.AGENT_SCRUTINY_TMUX_SESSION ?? "scrutiny";
  const agentSession = `${sessionBase}-agent-${sanitizeSessionName(target)}`;
  const oneLine = COMMIT_INSTRUCTION.replace(/\s+/g, " ").trim();
  const agentTarget = `${agentSession}:0.0`;

  const sendText = spawnSync("tmux", ["send-keys", "-t", agentTarget, "-l", oneLine], {
    encoding: "utf-8",
    maxBuffer: 1024 * 1024,
    timeout: 5000,
  });

  if (sendText.error) {
    return NextResponse.json(
      { error: `tmux の実行に失敗しました: ${sendText.error.message}` },
      { status: 500 }
    );
  }

  if (sendText.status !== 0 || sendText.signal) {
    return NextResponse.json(
      {
        error:
          sendText.stderr?.trim() ||
          `tmux send-keys failed with status ${sendText.status}${sendText.signal ? " signal " + sendText.signal : ""}`,
      },
      { status: 500 }
    );
  }

  const sendEnter = spawnSync("tmux", ["send-keys", "-t", agentTarget, "Enter"], {
    encoding: "utf-8",
    timeout: 5000,
  });

  if (sendEnter.error) {
    return NextResponse.json(
      { error: `tmux Enter の実行に失敗しました: ${sendEnter.error.message}` },
      { status: 500 }
    );
  }

  if (sendEnter.status !== 0 || sendEnter.signal) {
    return NextResponse.json(
      {
        error:
          sendEnter.stderr?.trim() ||
          `tmux send-keys failed with status ${sendEnter.status}${sendEnter.signal ? " signal " + sendEnter.signal : ""}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "コミットを依頼しました",
  });
}
