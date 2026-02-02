import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { NextResponse } from "next/server";
import { loadConfig, getTargetDir } from "@/lib/config";

/**
 * 選択ファイルの旧版（HEAD）・新版（作業ツリー）の全文を返す。
 * ファイル一覧は /api/diff で取得し、表示用本文はこの API で取得する。
 */
export async function GET(request: Request) {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("target") ?? undefined;
  const targetDir = getTargetDir(projectRoot, config, target);
  const filePath = searchParams.get("path");
  if (!filePath || !filePath.trim()) {
    return NextResponse.json(
      { error: "path クエリが必要です" },
      { status: 400 }
    );
  }

  // パスに .. が含まれる場合は拒否
  const normalized = path.normalize(filePath.trim());
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return NextResponse.json({ error: "不正な path です" }, { status: 400 });
  }

  let oldContent = "";
  let newContent = "";

  // 旧版: git show HEAD:path
  const showResult = spawnSync("git", ["show", `HEAD:${normalized}`], {
    cwd: targetDir,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (showResult.status === 0 && showResult.stdout) {
    oldContent = showResult.stdout;
  }

  // 新版: 作業ツリーのファイルを読み取り
  const absPath = path.join(targetDir, normalized);
  try {
    newContent = readFileSync(absPath, "utf-8");
  } catch {
    // 削除されたファイルなど
    newContent = "";
  }

  return NextResponse.json({ oldContent, newContent });
}
