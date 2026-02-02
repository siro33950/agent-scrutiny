import { spawnSync } from "child_process";
import { NextResponse } from "next/server";
import { loadConfig, getTargetDir } from "@/lib/config";

/**
 * 指定 target の Git ブランチ一覧を返す。
 * GET /api/refs?target=...
 * 戻り値: { branches: string[] }
 */
export async function GET(request: Request) {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("target") ?? undefined;
  const targetDir = getTargetDir(projectRoot, config, target);

  const result = spawnSync(
    "git",
    ["for-each-ref", "refs/heads", "--format=%(refname:short)"],
    { cwd: targetDir, encoding: "utf-8", maxBuffer: 1024 * 1024 }
  );

  if (result.error) {
    return NextResponse.json(
      { error: `git の実行に失敗しました: ${result.error.message}` },
      { status: 500 }
    );
  }

  if (result.status !== 0) {
    return NextResponse.json(
      { error: result.stderr?.trim() || "ブランチ一覧の取得に失敗しました" },
      { status: 400 }
    );
  }

  const branches = (result.stdout ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();

  return NextResponse.json({ branches });
}
