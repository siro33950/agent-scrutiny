import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import yaml from "js-yaml";

/**
 * 1 件のフィードバック。行範囲またはファイル全体。
 * whole_file が true のときはファイル全体へのフィードバック（line_number 0、line_number_end 省略）。
 * 後方互換: line_number === 0 かつ whole_file なしもファイル全体として扱う。
 */
export interface FeedbackItem {
  file_path: string;
  line_number: number;
  line_number_end?: number;
  /** true のときファイル全体へのフィードバック。YAML 出力で明示される。 */
  whole_file?: boolean;
  comment: string;
  /** 完了に移した日時（ISO8601）。feedback-resolved.yaml にのみ保持。 */
  resolved_at?: string;
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
 * .scrutiny/feedback-resolved.yaml（完了済みフィードバック）のパスを返す。
 */
export function getFeedbackResolvedPath(workingDir: string = process.cwd()): string {
  return path.join(workingDir, ".scrutiny", "feedback-resolved.yaml");
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
  const resolved_at =
    "resolved_at" in o && typeof o.resolved_at === "string"
      ? o.resolved_at
      : undefined;
  return {
    file_path: String(o.file_path),
    line_number,
    ...(line_number_endValid ? { line_number_end } : {}),
    ...(isWholeFile || line_number === 0 ? { whole_file: true as const } : {}),
    comment: String(o.comment),
    ...(resolved_at ? { resolved_at } : {}),
  };
}

const feedbackUnsentPath = (wd: string) =>
  path.join(wd, ".scrutiny", "feedback-unsent.yaml");

/**
 * 作業ディレクトリの .scrutiny/feedback.yaml を読み、パースして返す。ファイルが無い場合は { items: [] }。
 * 移行: feedback.yaml が無く feedback-unsent.yaml がある場合、それを feedback.yaml にコピーして読み込む。
 */
export function readFeedback(workingDir: string = process.cwd()): FeedbackYaml {
  const filePath = getFeedbackPath(workingDir);
  const unsentPath = feedbackUnsentPath(workingDir);
  if (!existsSync(filePath)) {
    if (existsSync(unsentPath)) {
      const dir = path.dirname(filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(filePath, readFileSync(unsentPath, "utf-8"), "utf-8");
    } else {
      return { ...defaultFeedback };
    }
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
 * 作業ディレクトリの .scrutiny/feedback-resolved.yaml を読み、パースして返す。存在しない場合は { items: [] }。
 */
export function readFeedbackResolved(workingDir: string = process.cwd()): FeedbackYaml {
  const filePath = getFeedbackResolvedPath(workingDir);
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
 * 完了済みフィードバック YAML に 1 件以上を追記する。
 */
export function appendFeedbackResolved(
  workingDir: string,
  input: FeedbackItem | FeedbackItem[]
): void {
  const existing = readFeedbackResolved(workingDir);
  const toAdd = Array.isArray(input) ? input : [input];
  const items = [...existing.items, ...toAdd].sort(
    (a, b) =>
      a.file_path.localeCompare(b.file_path) || a.line_number - b.line_number
  );
  const dir = path.dirname(getFeedbackResolvedPath(workingDir));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(
    getFeedbackResolvedPath(workingDir),
    yaml.dump({ items }, { lineWidth: -1 }),
    "utf-8"
  );
}

const itemKey = (item: FeedbackItem) =>
  `${item.file_path}:${item.line_number}:${item.line_number_end ?? item.line_number}`;

/**
 * 指定した指摘を feedback.yaml から削除し、feedback-resolved.yaml に追記する。
 * items に resolved_at が無い場合は付与する。
 */
export function moveItemsToResolved(
  workingDir: string,
  items: FeedbackItem[]
): void {
  if (items.length === 0) return;
  const toResolve = items.map((item) =>
    item.resolved_at ? item : { ...item, resolved_at: new Date().toISOString() }
  );
  appendFeedbackResolved(workingDir, toResolve);
  const existing = readFeedback(workingDir);
  const removeKeys = new Set(items.map(itemKey));
  const remaining = existing.items.filter((i) => !removeKeys.has(itemKey(i)));
  const dir = path.dirname(getFeedbackPath(workingDir));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    getFeedbackPath(workingDir),
    yaml.dump({ items: remaining }, { lineWidth: -1 }),
    "utf-8"
  );
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
