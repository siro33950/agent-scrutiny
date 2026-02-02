import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import yaml from "js-yaml";

/**
 * 1 件の指摘。行範囲またはファイル全体。
 * whole_file が true のときはファイル全体への指摘（line_number は 0、line_number_end は省略）。
 * 後方互換のため line_number === 0 かつ whole_file 未指定もファイル全体として扱う。
 */
export interface FeedbackItem {
  file_path: string;
  line_number: number;
  line_number_end?: number;
  /** true のときファイル全体への指摘。YAML 出力で意図が分かるように明示する。 */
  whole_file?: boolean;
  comment: string;
}

export interface FeedbackYaml {
  items: FeedbackItem[];
}

const defaultFeedback: FeedbackYaml = { items: [] };

/**
 * 作業ディレクトリ（target のディレクトリ）の .scrutiny/feedback.yaml のパスを返す。
 */
export function getFeedbackPath(workingDir: string = process.cwd()): string {
  return path.join(workingDir, ".scrutiny", "feedback.yaml");
}

/**
 * 未送信指摘用 .scrutiny/feedback-unsent.yaml のパスを返す。
 * @param workingDir 作業ディレクトリ（target のディレクトリ）
 */
export function getFeedbackUnsentPath(workingDir: string = process.cwd()): string {
  return path.join(workingDir, ".scrutiny", "feedback-unsent.yaml");
}

function asFeedbackItem(x: unknown): FeedbackItem | null {
  if (
    !x ||
    typeof x !== "object" ||
    !("file_path" in x) ||
    !("comment" in x)
  ) {
    return null;
  }
  const o = x as Record<string, unknown>;
  const isWholeFile =
    "whole_file" in o && (o.whole_file === true || o.whole_file === "true");
  if (!isWholeFile && !("line_number" in o)) return null;
  const line_number = isWholeFile ? 0 : Number(o.line_number);
  if (
    !isWholeFile &&
    (!Number.isFinite(line_number) ||
      !Number.isInteger(line_number) ||
      line_number <= 0)
  ) {
    return null;
  }
  const line_number_end =
    isWholeFile || !("line_number_end" in o) || o.line_number_end == null
      ? undefined
      : Number(o.line_number_end);
  const line_number_endValid =
    line_number_end !== undefined &&
    Number.isFinite(line_number_end) &&
    Number.isInteger(line_number_end) &&
    line_number_end >= line_number;
  return {
    file_path: String(o.file_path),
    line_number,
    ...(line_number_endValid ? { line_number_end } : {}),
    ...(isWholeFile || line_number === 0 ? { whole_file: true as const } : {}),
    comment: String(o.comment),
  };
}

/**
 * 作業ディレクトリの .scrutiny/feedback.yaml を読み、パースして返す。ファイルが無い場合は { items: [] }。
 */
export function readFeedback(workingDir: string = process.cwd()): FeedbackYaml {
  const filePath = getFeedbackPath(workingDir);
  if (!existsSync(filePath)) {
    return { ...defaultFeedback };
  }
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = yaml.load(raw) as { items?: unknown[] } | null;
    if (!parsed || !Array.isArray(parsed.items)) {
      return { ...defaultFeedback };
    }
    const items = parsed.items.map(asFeedbackItem).filter(
      (x): x is FeedbackItem => x !== null
    );
    return { items };
  } catch {
    return { ...defaultFeedback };
  }
}

/**
 * 既存の feedback に 1 件または複数件をマージし、重複（file_path + line_number + line_number_end）は上書きして書き戻す。
 */
export function writeFeedback(
  workingDir: string,
  input: FeedbackItem | FeedbackItem[]
): FeedbackYaml {
  const existing = readFeedback(workingDir);
  const toAdd = Array.isArray(input) ? input : [input];
  const key = (item: FeedbackItem) =>
    `${item.file_path}:${item.line_number}:${item.line_number_end ?? item.line_number}`;
  const byKey = new Map<string, FeedbackItem>();
  for (const item of existing.items) {
    byKey.set(key(item), item);
  }
  for (const item of toAdd) {
    byKey.set(key(item), item);
  }
  const items = Array.from(byKey.values()).sort(
    (a, b) =>
      a.file_path.localeCompare(b.file_path) || a.line_number - b.line_number
  );
  const next: FeedbackYaml = { items };
  const dir = path.dirname(getFeedbackPath(workingDir));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(
    getFeedbackPath(workingDir),
    yaml.dump(next, { lineWidth: -1 }),
    "utf-8"
  );
  return next;
}

/**
 * 作業ディレクトリの未送信指摘用 YAML を読み、パースして返す。ファイルが無い場合は { items: [] }。
 */
export function readFeedbackUnsent(workingDir: string = process.cwd()): FeedbackYaml {
  const filePath = getFeedbackUnsentPath(workingDir);
  if (!existsSync(filePath)) {
    return { ...defaultFeedback };
  }
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = yaml.load(raw) as { items?: unknown[] } | null;
    if (!parsed || !Array.isArray(parsed.items)) {
      return { ...defaultFeedback };
    }
    const items = parsed.items.map(asFeedbackItem).filter(
      (x): x is FeedbackItem => x !== null
    );
    return { items };
  } catch {
    return { ...defaultFeedback };
  }
}

/**
 * 未送信指摘用 YAML に 1 件または複数件をマージし、重複は上書きして書き戻す。
 */
export function writeFeedbackUnsent(
  workingDir: string,
  input: FeedbackItem | FeedbackItem[] | FeedbackYaml
): FeedbackYaml {
  const yamlInput = input && typeof input === "object" && "items" in input;
  const yamlItems = yamlInput ? (input as FeedbackYaml).items : null;
  if (yamlItems && yamlItems.length === 0) {
    const next: FeedbackYaml = { items: [] };
    const dir = path.dirname(getFeedbackUnsentPath(workingDir));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(
      getFeedbackUnsentPath(workingDir),
      yaml.dump(next, { lineWidth: -1 }),
      "utf-8"
    );
    return next;
  }
  const existing = readFeedbackUnsent(workingDir);
  const toAdd: FeedbackItem[] =
    yamlItems !== null
      ? yamlItems
      : Array.isArray(input)
        ? input
        : [input as FeedbackItem];
  const key = (item: FeedbackItem) =>
    `${item.file_path}:${item.line_number}:${item.line_number_end ?? item.line_number}`;
  const byKey = new Map<string, FeedbackItem>();
  for (const item of existing.items) {
    byKey.set(key(item), item);
  }
  for (const item of toAdd) {
    byKey.set(key(item), item);
  }
  const items = Array.from(byKey.values()).sort(
    (a, b) =>
      a.file_path.localeCompare(b.file_path) || a.line_number - b.line_number
  );
  const next: FeedbackYaml = { items };
  const dir = path.dirname(getFeedbackUnsentPath(workingDir));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(
    getFeedbackUnsentPath(workingDir),
    yaml.dump(next, { lineWidth: -1 }),
    "utf-8"
  );
  return next;
}

/**
 * Agent に渡す用に、作業ディレクトリの .scrutiny/ 直下に指定したファイル名で YAML を書き出す。
 */
export function writeFeedbackForAgent(
  workingDir: string,
  filename: string,
  items: FeedbackItem[]
): void {
  const dir = path.join(workingDir, ".scrutiny");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, filename);
  writeFileSync(
    filePath,
    yaml.dump({ items }, { lineWidth: -1 }),
    "utf-8"
  );
}
