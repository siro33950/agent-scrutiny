import { readFileSync } from "fs";
import path from "path";
import { z } from "zod";

/** config.json のスキーマ定義 */
export const ScrutinyConfigSchema = z.object({
  /** ターゲット名 → projectRoot からの相対パス */
  targets: z.record(z.string(), z.string().min(1, "ターゲットパスは空文字にできません")).optional(),
  /** tmux セッション名 */
  tmuxSession: z.string().min(1, "tmuxSession は空文字にできません").optional(),
  /** 起動時にエージェント用 tmux セッション内で実行するコマンド */
  agentCommand: z.string().min(1, "agentCommand は空文字にできません").optional(),
});

export type ScrutinyConfigInput = z.infer<typeof ScrutinyConfigSchema>;

export interface ScrutinyConfig {
  /** ターゲット名 → projectRoot からの相対パス。必須。 */
  targets: Record<string, string>;
  tmuxSession?: string;
  /** 起動時にエージェント用 tmux セッション内で実行するコマンド（例: aider, claude）。未設定時は何も起動しない。 */
  agentCommand?: string;
}

const defaultConfig: Omit<ScrutinyConfig, "targets"> & {
  targets: Record<string, string>;
} = {
  targets: { default: "." },
  tmuxSession: "scrutiny",
};

/**
 * zod バリデーションエラーを人間が読みやすい形式に整形
 */
function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `"${issue.path.join(".")}"` : "ルート";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

/**
 * AgentScrutiny プロジェクトルートの config.json を読み、
 * targets のみで扱う。targets が無い・空の場合は { "default": "." } とする。
 */
export function loadConfig(projectRoot: string = process.cwd()): ScrutinyConfig {
  const configPath = path.join(projectRoot, "config.json");
  let raw: unknown = {};
  try {
    raw = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.warn(`[config] config.json のJSON構文が不正です: ${e.message}`);
    }
    // ファイルが無い場合はデフォルト
  }

  // zodでバリデーション
  const result = ScrutinyConfigSchema.safeParse(raw);
  let validated: ScrutinyConfigInput;
  if (!result.success) {
    const errorMessage = formatValidationError(result.error);
    console.warn(`[config] config.json のバリデーションエラー:\n${errorMessage}`);
    console.warn("[config] デフォルト設定を使用します");
    validated = {};
  } else {
    validated = result.data;
  }

  const rawTargets = validated.targets && Object.keys(validated.targets).length > 0
    ? validated.targets
    : { default: "." };
  const targets: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawTargets)) {
    if (v.trim()) targets[k.trim()] = v.trim();
  }
  if (Object.keys(targets).length === 0) targets.default = ".";

  const tmuxSession =
    (validated.tmuxSession ?? process.env.AGENT_SCRUTINY_TMUX_SESSION)?.trim() ||
    defaultConfig.tmuxSession;
  return { ...defaultConfig, ...validated, targets, tmuxSession };
}

/**
 * ドロップダウン用の target 名一覧を返す。
 */
export function getTargetNames(config: ScrutinyConfig): string[] {
  return Object.keys(config.targets);
}

/**
 * target 名に対応する絶対パス（targetDir）を返す。
 * targetName が無い・無効な場合は先頭の target のパスを返す。
 */
export function getTargetDir(
  projectRoot: string,
  config: ScrutinyConfig,
  targetName?: string
): string {
  const names = getTargetNames(config);
  const name =
    targetName && config.targets[targetName] ? targetName : names[0];
  const rel = config.targets[name] ?? ".";
  return path.resolve(projectRoot, rel);
}
