import { randomUUID } from "crypto";
import { spawnSync } from "child_process";
import path from "path";
import { NextResponse } from "next/server";
import { loadConfig, getTargetNames, getTargetDir } from "@/lib/config";
import {
  readFeedbackUnsent,
  writeFeedbackForAgent,
  writeFeedbackUnsent,
} from "@/lib/feedback";

/**
 * tmux セッション名用に target 名を正規化する（start-scrutiny.sh と同じルール）。
 * 英数字・ハイフン・アンダースコアのみ許可し、それ以外は _ に置換する。
 */
function sanitizeSessionName(name: string): string {
  const s = name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return s || "default";
}

/**
 * エージェントへの指示文。指定したファイル（agent の cwd = targetDir に対する相対パス）を読んで確認するように伝える。
 */
function buildInstruction(feedbackFileRelativePath: string): string {
  return `${feedbackFileRelativePath} を読んで、記載の指摘内容（ファイル・行）を確認し、対応を実施してください。`;
}

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

  const targetDir = getTargetDir(projectRoot, config, target);
  const data = readFeedbackUnsent(targetDir);
  if (!data.items.length) {
    return NextResponse.json(
      {
        error: "送信する指摘がありません。",
      },
      { status: 400 }
    );
  }

  const itemsWithAbsolutePath = data.items.map((item) => ({
    ...item,
    file_path: path.resolve(targetDir, item.file_path),
  }));

  const uuid = randomUUID();
  const filename = `feedback-${uuid}.yaml`;
  writeFeedbackForAgent(targetDir, filename, itemsWithAbsolutePath);

  const feedbackFileRelativePath = path.relative(
    targetDir,
    path.join(targetDir, ".scrutiny", filename)
  );
  const sessionBase = config.tmuxSession ?? process.env.AGENT_SCRUTINY_TMUX_SESSION ?? "scrutiny";
  const agentSession = `${sessionBase}-agent-${sanitizeSessionName(target)}`;

  const instruction = buildInstruction(feedbackFileRelativePath);
  // tmux send-keys で改行を送ると解釈が複雑なため、改行をスペースに置換して 1 行で送る。
  const oneLine = instruction.replace(/\s+/g, " ").trim();

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

  writeFeedbackUnsent(targetDir, { items: [] });

  return NextResponse.json({
    ok: true,
    message: "エージェントに送信しました",
  });
}
