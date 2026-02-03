import { readFileSync } from "fs";
import path from "path";

export interface ScrutinyHooks {
  /** Submit前に実行するコマンドの配列 */
  preSubmit?: string[];
  /** Submit後に実行するコマンドの配列 */
  postSubmit?: string[];
}

export interface ScrutinyConfig {
  /** ターゲット名 → projectRoot からの相対パス。必須。 */
  targets: Record<string, string>;
  tmuxSession?: string;
  /** 起動時にエージェント用 tmux セッション内で実行するコマンド（例: aider, claude）。未設定時は何も起動しない。 */
  agentCommand?: string;
  /** Submit前後に実行するHooksの設定 */
  hooks?: ScrutinyHooks;
}

const defaultConfig: Omit<ScrutinyConfig, "targets"> & {
  targets: Record<string, string>;
} = {
  targets: { default: "." },
  tmuxSession: "scrutiny",
};

/**
 * AgentScrutiny プロジェクトルートの config.json を読み、
 * targets のみで扱う。targets が無い・空の場合は { "default": "." } とする。
 */
export function loadConfig(projectRoot: string = process.cwd()): ScrutinyConfig {
  const configPath = path.join(projectRoot, "config.json");
  let raw: Partial<ScrutinyConfig> = {};
  try {
    raw = JSON.parse(readFileSync(configPath, "utf-8")) as Partial<ScrutinyConfig>;
  } catch {
    // ファイルが無い・JSON 不正の場合はデフォルト
  }
  const rawTargets = raw.targets && typeof raw.targets === "object" && Object.keys(raw.targets).length > 0
    ? raw.targets
    : { default: "." };
  const targets: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawTargets)) {
    if (typeof v === "string" && v.trim()) targets[k.trim()] = v.trim();
  }
  if (Object.keys(targets).length === 0) targets.default = ".";

  const tmuxSession =
    (raw.tmuxSession ?? process.env.AGENT_SCRUTINY_TMUX_SESSION)?.trim() ||
    defaultConfig.tmuxSession;
  return { ...defaultConfig, ...raw, targets, tmuxSession };
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
