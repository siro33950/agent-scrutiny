import { type ConnectionState } from "@/app/hooks/useFileWatcher";

interface FileTreeToolbarProps {
  loading: boolean;
  autoReloadEnabled: boolean;
  connectionState: ConnectionState;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onRefresh: () => void;
  onAutoReloadToggle: () => void;
}

function getConnectionStateColor(state: ConnectionState, enabled: boolean): string {
  if (!enabled) return "text-zinc-400 dark:text-zinc-500";
  switch (state) {
    case "connected":
      return "text-green-500 dark:text-green-400";
    case "connecting":
      return "text-yellow-500 dark:text-yellow-400";
    case "error":
      return "text-red-500 dark:text-red-400";
    default:
      return "text-zinc-400 dark:text-zinc-500";
  }
}

function getConnectionStateLabel(state: ConnectionState, enabled: boolean): string {
  if (!enabled) return "自動更新: OFF";
  switch (state) {
    case "connected":
      return "自動更新: 接続中";
    case "connecting":
      return "自動更新: 再接続中...";
    case "error":
      return "自動更新: エラー";
    default:
      return "自動更新: 切断";
  }
}

export function FileTreeToolbar({
  loading,
  autoReloadEnabled,
  connectionState,
  onExpandAll,
  onCollapseAll,
  onRefresh,
  onAutoReloadToggle,
}: FileTreeToolbarProps) {
  const stateColor = getConnectionStateColor(connectionState, autoReloadEnabled);
  const stateLabel = getConnectionStateLabel(connectionState, autoReloadEnabled);

  return (
    <div className="flex shrink-0 items-center gap-0.5 border-t border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
      <button
        type="button"
        onClick={onAutoReloadToggle}
        className={`rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${stateColor}`}
        title={stateLabel}
        aria-label={stateLabel}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <circle cx="12" cy="12" r="3" fill={autoReloadEnabled ? "currentColor" : "none"} />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>
      <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
      <button
        type="button"
        onClick={onExpandAll}
        className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        title="全部開く"
        aria-label="全部開く"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path d="M14 3.268V11C14 12.657 12.657 14 11 14H3.268C3.614 14.598 4.26 15 5 15H11C13.209 15 15 13.209 15 11V5C15 4.26 14.598 3.613 14 3.268ZM9.5 7.5C9.776 7.5 10 7.276 10 7C10 6.724 9.776 6.5 9.5 6.5H7.5V4.5C7.5 4.224 7.276 4 7 4C6.724 4 6.5 4.224 6.5 4.5V6.5H4.5C4.224 6.5 4 6.724 4 7C4 7.276 4.224 7.5 4.5 7.5H6.5V9.5C6.5 9.776 6.724 10 7 10C7.276 10 7.5 9.776 7.5 9.5V7.5H9.5ZM11 1C12.105 1 13 1.895 13 3V11C13 12.105 12.105 13 11 13H3C1.895 13 1 12.105 1 11V3C1 1.895 1.895 1 3 1H11ZM12 3C12 2.448 11.552 2 11 2H3C2.448 2 2 2.448 2 3V11C2 11.552 2.448 12 3 12H11C11.552 12 12 11.552 12 11V3Z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onCollapseAll}
        className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        title="全部閉じる"
        aria-label="全部閉じる"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path d="M14 3.268V11C14 12.657 12.657 14 11 14H3.268C3.614 14.598 4.26 15 5 15H11C13.209 15 15 13.209 15 11V5C15 4.26 14.598 3.613 14 3.268ZM9.5 7.5C9.776 7.5 10 7.276 10 7C10 6.724 9.776 6.5 9.5 6.5H4.5C4.224 6.5 4 6.724 4 7C4 7.276 4.224 7.5 4.5 7.5H9.5ZM11 1C12.105 1 13 1.895 13 3V11C13 12.105 12.105 13 11 13H3C1.895 13 1 12.105 1 11V3C1 1.895 1.895 1 3 1H11ZM12 3C12 2.448 11.552 2 11 2H3C2.448 2 2 2.448 2 3V11C2 11.552 2.448 12 3 12H11C11.552 12 12 11.552 12 11V3Z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        title={loading ? "取得中…" : "Refresh"}
        aria-label={loading ? "取得中…" : "Refresh"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <path d="M23 4v6h-6" />
          <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
        </svg>
      </button>
    </div>
  );
}
