import { readFileSync } from "fs";
import path from "path";

export interface ScrutinyConfig {
  targetDir: string;
  tmuxSession?: string;
  /** 起動時にエージェント用 tmux セッション内で実行するコマンド（例: aider, claude）。未設定時は何も起動しない。 */
  agentCommand?: string;
}

const defaultConfig: ScrutinyConfig = {
  targetDir: "",
  tmuxSession: "scrutiny",
};

/**
 * AgentScrutiny プロジェクトルートの .ai/config.json を読み、
 * targetDir は config > 環境変数 AGENT_SCRUTINY_TARGET_DIR > process.cwd() の順で解決する。
 */
export function loadConfig(projectRoot: string = process.cwd()): ScrutinyConfig {
  const configPath = path.join(projectRoot, ".ai", "config.json");
  let raw: Partial<ScrutinyConfig> = {};
  try {
    raw = JSON.parse(readFileSync(configPath, "utf-8")) as Partial<ScrutinyConfig>;
  } catch {
    // ファイルが無い・JSON 不正の場合はデフォルト
  }
  const targetDir =
    (raw.targetDir && raw.targetDir.trim()) ||
    process.env.AGENT_SCRUTINY_TARGET_DIR?.trim() ||
    projectRoot;
  const tmuxSession =
    raw.tmuxSession?.trim() ||
    process.env.AGENT_SCRUTINY_TMUX_SESSION?.trim() ||
    defaultConfig.tmuxSession;
  return { ...defaultConfig, ...raw, targetDir, tmuxSession };
}
