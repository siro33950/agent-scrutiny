import path from "path";

/**
 * パスがtargetDir配下にあることを検証
 * @param filePath 検証するパス（相対パス）
 * @param targetDir ターゲットディレクトリ（絶対パス）
 * @returns null if valid, error message if invalid
 */
export function validatePath(filePath: string, targetDir: string): string | null {
  if (!filePath || !filePath.trim()) {
    return "path が必要です";
  }

  const normalized = path.normalize(filePath.trim());

  // 絶対パスは拒否
  if (path.isAbsolute(normalized)) {
    return "絶対パスは許可されていません";
  }

  // ".." で始まるパスは拒否
  if (normalized.startsWith("..")) {
    return "親ディレクトリへの参照は許可されていません";
  }

  // 解決されたパスがtargetDir配下にあることを確認
  const resolvedPath = path.resolve(targetDir, normalized);
  const resolvedTargetDir = path.resolve(targetDir);

  // resolvedPath が resolvedTargetDir で始まることを確認
  // path.sep を付けることで "/target" と "/target-other" の誤判定を防ぐ
  if (!resolvedPath.startsWith(resolvedTargetDir + path.sep) && resolvedPath !== resolvedTargetDir) {
    return "targetDir 配下のファイルのみアクセス可能です";
  }

  return null;
}

/**
 * 正規化されたパスを返す（検証済み前提）
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath.trim());
}
