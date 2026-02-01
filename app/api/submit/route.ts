import { randomUUID } from "crypto";
import { spawnSync } from "child_process";
import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import {
  readFeedbackUnsent,
  writeFeedbackForAgent,
  writeFeedbackUnsent,
} from "@/lib/feedback";

/**
 * エージェントへの指示文。指定したファイルを読んで確認するように伝える。
 */
function buildInstruction(filename: string): string {
  return `.ai/${filename} を読んで、記載の指摘内容（ファイル・行）を確認してください。`;
}

export async function POST() {
  const projectRoot = process.cwd();
  const data = readFeedbackUnsent(projectRoot);
  if (!data.items.length) {
    return NextResponse.json(
      {
        error: "送信する指摘がありません。",
      },
      { status: 400 }
    );
  }

  const uuid = randomUUID();
  const filename = `feedback-${uuid}.yaml`;
  writeFeedbackForAgent(projectRoot, filename, data.items);

  const config = loadConfig(projectRoot);
  const sessionBase = config.tmuxSession ?? process.env.AGENT_SCRUTINY_TMUX_SESSION ?? "scrutiny";
  const agentSession = `${sessionBase}-agent`;

  const instruction = buildInstruction(filename);
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

  writeFeedbackUnsent(projectRoot, { items: [] });

  return NextResponse.json({
    ok: true,
    message: "エージェントに送信しました",
  });
}
