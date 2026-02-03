/**
 * ファイル監視とファイル一覧取得で共有する設定
 */

/**
 * スキップするディレクトリのSet
 */
export const SKIP_DIRS = new Set([
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
 * ファイル変更のデバウンス時間（ミリ秒）
 */
export const DEBOUNCE_MS = 300;

/**
 * SSEイベント種別
 */
export const SSE_EVENTS = {
  FILE_CHANGED: "file-changed",
  KEEPALIVE: "keepalive",
  ERROR: "error",
} as const;

/**
 * SSEキープアライブ間隔（ミリ秒）
 */
export const KEEPALIVE_INTERVAL_MS = 30000;
