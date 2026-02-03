interface TabBarProps {
  openTabs: string[];
  activeTabIndex: number;
  onSelectTab: (index: number) => void;
  onCloseTab: (index: number) => void;
}

export function TabBar({ openTabs, activeTabIndex, onSelectTab, onCloseTab }: TabBarProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 bg-zinc-50/50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900/50">
      {openTabs.map((path, i) => {
        const tabLabel = path.split("/").pop() ?? path;
        const isActive = i === activeTabIndex;
        return (
          <div
            key={path}
            role="tab"
            aria-selected={isActive}
            className={`flex min-w-0 max-w-[180px] shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
              isActive
                ? "bg-white font-medium text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectTab(i)}
              className="min-w-0 flex-1 truncate text-left"
              title={path}
            >
              {tabLabel}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(i);
              }}
              className="shrink-0 rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              title="タブを閉じる"
              aria-label="タブを閉じる"
            >
              <span className="text-zinc-500 dark:text-zinc-400">×</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
