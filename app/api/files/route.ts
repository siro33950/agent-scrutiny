import { readdirSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { NextResponse } from "next/server";
import { loadConfig, getTargetDir } from "@/lib/config";
import { validateBaseRef } from "@/lib/git-ref";
import { SKIP_DIRS } from "@/lib/watch-config";

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

export async function GET(request: Request) {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("target") ?? undefined;
  const baseRaw = searchParams.get("base") ?? "HEAD";
  const base = validateBaseRef(baseRaw);
  if (!base) {
    return NextResponse.json(
      { error: "不正な base です" },
      { status: 400 }
    );
  }
  const targetDir = getTargetDir(projectRoot, config, target);

  let files = listAllFiles(targetDir);

  // .gitignore にマッチするパスを除外する（git check-ignore --stdin）
  const checkIgnore = spawnSync(
    "git",
    ["check-ignore", "--stdin"],
    {
      cwd: targetDir,
      input: files.join("\n"),
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    }
  );
  if (checkIgnore.status === 0 && checkIgnore.stdout) {
    const ignoredSet = new Set(
      checkIgnore.stdout
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    files = files.filter((f) => !ignoredSet.has(f));
  }
  // check-ignore が非ゼロ（例: 非 git リポジトリ）の場合はフィルタせずそのまま返す

  const diffResult = spawnSync("git", ["diff", base, "--name-only"], {
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

  // git diff --numstat for +/- line counts
  const numstatResult = spawnSync("git", ["diff", base, "--numstat"], {
    cwd: targetDir,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const diffStats: Record<string, { additions: number; deletions: number }> = {};
  if (numstatResult.status === 0 || numstatResult.status === 1) {
    for (const line of (numstatResult.stdout ?? "").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split("\t");
      if (parts.length >= 3) {
        const add = parts[0] === "-" ? 0 : parseInt(parts[0], 10);
        const del = parts[1] === "-" ? 0 : parseInt(parts[1], 10);
        const filePath = parts.slice(2).join("\t");
        diffStats[filePath] = { additions: add || 0, deletions: del || 0 };
      }
    }
  }

  // git diff --name-status for change types (M/A/D/R)
  const nameStatusResult = spawnSync("git", ["diff", base, "--name-status"], {
    cwd: targetDir,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const changeTypes: Record<string, string> = {};
  if (nameStatusResult.status === 0 || nameStatusResult.status === 1) {
    for (const line of (nameStatusResult.stdout ?? "").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = /^([ACDMRT])\d*\t(.+)$/.exec(trimmed);
      if (match) {
        changeTypes[match[2]] = match[1];
      }
    }
  }

  // Mark untracked files as Added
  for (const f of untracked) {
    if (!changeTypes[f]) changeTypes[f] = "A";
  }

  return NextResponse.json({ files, modified, untracked, diffStats, changeTypes });
}
