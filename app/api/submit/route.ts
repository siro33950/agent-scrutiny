import { randomUUID } from "crypto";
import { spawnSync } from "child_process";
import path from "path";
import { NextResponse } from "next/server";
import { loadConfig, getTargetNames, getTargetDir, type ScrutinyConfig } from "@/lib/config";
import { readFeedback, writeFeedback, writeFeedbackForAgent } from "@/lib/feedback";

/**
 * Hooks（preSubmit/postSubmit）を実行する。
 * 各コマンドはtargetDir内で実行され、失敗してもログのみで処理を継続する。
 */
function executeHooks(commands: string[] | undefined, targetDir: string, phase: "preSubmit" | "postSubmit"): void {
  if (!commands || commands.length === 0) return;
  for (const cmd of commands) {
    if (!cmd || typeof cmd !== "string") continue;
    try {
      const result = spawnSync(cmd, {
        cwd: targetDir,
        shell: true,
        encoding: "utf-8",
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });
      if (result.error) {
        console.error(`[${phase}] Hook failed: ${cmd}`, result.error.message);
      } else if (result.status !== 0) {
        console.error(`[${phase}] Hook exited with status ${result.status}: ${cmd}`, result.stderr);
      } else {
        console.log(`[${phase}] Hook executed: ${cmd}`);
      }
    } catch (e) {
      console.error(`[${phase}] Hook exception: ${cmd}`, e);
    }
  }
}

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
  return `${feedbackFileRelativePath} を読んでフィードバック（ファイル・行）を確認し、指摘に対応してください。`;
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
  const data = readFeedback(targetDir);
  if (!data.items.length) {
    return NextResponse.json(
      {
        error: "No feedback to send.",
      },
      { status: 400 }
    );
  }

  // preSubmit Hooks を実行
  executeHooks(config.hooks?.preSubmit, targetDir, "preSubmit");

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

  const submittedAt = new Date().toISOString();
  const itemsWithSubmittedAt = data.items.map((item) =>
    item.submitted_at ? item : { ...item, submitted_at: submittedAt }
  );
  writeFeedback(targetDir, itemsWithSubmittedAt);

  // postSubmit Hooks を実行
  executeHooks(config.hooks?.postSubmit, targetDir, "postSubmit");

  return NextResponse.json({
    ok: true,
    message: "エージェントに送信しました",
  });
}
