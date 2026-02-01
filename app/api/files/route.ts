import { readdirSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
  ".cache",
  "dist",
  "build",
  ".turbo",
]);

/**
 * targetDir 配下の全ファイルを再帰的に列挙し、差分のあるファイル一覧を git から取得して返す。
 * Git 追跡外・未追跡のファイルも含めて表示する。
 */
function listAllFiles(dir: string, base = ""): string[] {
  const out: string[] = [];
  let entries: { name: string; isDirectory: () => boolean }[];
  try {
    entries = readdirSync(path.join(dir, base), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      out.push(...listAllFiles(dir, rel));
    } else {
      out.push(rel);
    }
  }
  return out.sort();
}

export async function GET() {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const targetDir = path.resolve(projectRoot, config.targetDir || projectRoot);

  const files = listAllFiles(targetDir);

  const diffResult = spawnSync("git", ["diff", "HEAD", "--name-only"], {
    cwd: targetDir,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });

  const modified: string[] =
    diffResult.status === 0 || diffResult.status === 1
      ? (diffResult.stdout ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
      : [];

  const untrackedResult = spawnSync(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    { cwd: targetDir, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
  );

  const untracked: string[] =
    untrackedResult.status === 0
      ? (untrackedResult.stdout ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  return NextResponse.json({ files, modified, untracked });
}
