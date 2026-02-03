import type { ViewMode } from "@/app/types";

interface DiffViewerToolbarProps {
  currentPath: string | null;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onPrevFile: () => void;
  onNextFile: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onWholeFileFeedback: () => void;
  hasCollapsibleComments?: boolean;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

export function DiffViewerToolbar({
  currentPath,
  viewMode,
  onViewModeChange,
  onPrevFile,
  onNextFile,
  hasPrev,
  hasNext,
  onWholeFileFeedback,
  hasCollapsibleComments,
  onExpandAll,
  onCollapseAll,
}: DiffViewerToolbarProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {currentPath}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onPrevFile}
          disabled={!hasPrev}
          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title="前のファイル (Alt+[)"
          aria-label="前のファイル"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onNextFile}
          disabled={!hasNext}
          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title="次のファイル (Alt+])"
          aria-label="次のファイル"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
        <div className="flex overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => onViewModeChange("inline")}
            className={`px-2 py-1 text-xs font-medium ${
              viewMode === "inline"
                ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            title="Inline表示"
          >
            Inline
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("sideBySide")}
            className={`border-l border-zinc-200 px-2 py-1 text-xs font-medium dark:border-zinc-700 ${
              viewMode === "sideBySide"
                ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            title="Side-by-Side表示"
          >
            Side-by-Side
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("latest")}
            className={`border-l border-zinc-200 px-2 py-1 text-xs font-medium dark:border-zinc-700 ${
              viewMode === "latest"
                ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            title="最新ファイルのみ表示"
          >
            Latest
          </button>
        </div>
        {hasCollapsibleComments && (
          <>
            <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
            <button
              type="button"
              onClick={onExpandAll}
              className="rounded px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="全てのコメントを展開"
            >
              展開
            </button>
            <button
              type="button"
              onClick={onCollapseAll}
              className="rounded px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="全てのコメントを最小化"
            >
              最小化
            </button>
          </>
        )}
        <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
        <button
          type="button"
          onClick={onWholeFileFeedback}
          className="shrink-0 rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title="whole fileにFeedback"
          aria-label="whole fileにFeedback"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
