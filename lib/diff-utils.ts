import type parseDiff from "parse-diff";

type ParsedFile = parseDiff.File;
type Change = parseDiff.Change;

/**
 * parse-diff の File から ReactDiffViewer 用の oldValue / newValue 文字列を構築する。
 */
export function fileToOldNew(file: ParsedFile): { oldContent: string; newContent: string } {
  let oldContent = "";
  let newContent = "";
  for (const chunk of file.chunks) {
    for (const change of chunk.changes as Change[]) {
      const content = "content" in change ? change.content : "";
      if (change.type === "del" || change.type === "normal") {
        oldContent += content;
      }
      if (change.type === "add" || change.type === "normal") {
        newContent += content;
      }
    }
  }
  return { oldContent, newContent };
}

export interface ParsedDiffFile {
  path: string;
  oldContent: string;
  newContent: string;
}

/**
 * 生の diff 文字列をパースし、ファイルごとの old/new に変換する。
 */
export function parseDiffToFiles(
  diff: string,
  parse: (input: string | null) => ParsedFile[]
): ParsedDiffFile[] {
  const files = parse(diff);
  return files.map((file) => {
    const pathName = file.to && file.to !== "/dev/null" ? file.to : file.from ?? "";
    const { oldContent, newContent } = fileToOldNew(file);
    return { path: pathName, oldContent, newContent };
  });
}
