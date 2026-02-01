import { spawnSync } from "child_process";
import { NextResponse } from "next/server";
import { loadConfig, getTargetDir } from "@/lib/config";

export async function GET(request: Request) {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("target") ?? undefined;
  const targetDir = getTargetDir(projectRoot, config, target);

  const result = spawnSync("git", ["diff", "HEAD"], {
    cwd: targetDir,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    return NextResponse.json(
      { error: `git の実行に失敗しました: ${result.error.message}` },
      { status: 500 }
    );
  }

  // 終了コード 0: 成功, 1: 差分ありで正常終了, 128: 非 Git などエラー
  if (result.status !== 0 && result.status !== 1) {
    const msg = result.stderr?.trim() || "git diff に失敗しました";
    return NextResponse.json(
      { error: msg },
      { status: 400 }
    );
  }

  return NextResponse.json({ diff: result.stdout ?? "" });
}
