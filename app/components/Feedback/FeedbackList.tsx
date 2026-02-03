import { useMemo, useState } from "react";
import type { FeedbackItem } from "@/lib/feedback";
import { STATUS_CONFIG, type FeedbackStatus } from "@/app/utils/feedbackStyles";
import { formatRelativeTime } from "@/app/utils/time";

type FilteredItem = FeedbackItem & { _status: FeedbackStatus };

interface FeedbackListProps {
  filteredItems: FilteredItem[];
  submitting: boolean;
  onSelectItem: (item: FeedbackItem, isResolved?: boolean) => void;
  onResolve: (item: FeedbackItem) => void;
  onDelete?: (item: FeedbackItem) => void;
  onUnresolve?: (item: FeedbackItem) => void;
}

interface FileGroup {
  filePath: string;
  items: FilteredItem[];
}

function groupByFile(items: FilteredItem[]): FileGroup[] {
  const map = new Map<string, FilteredItem[]>();
  for (const item of items) {
    const list = map.get(item.file_path) ?? [];
    list.push(item);
    map.set(item.file_path, list);
  }
  return Array.from(map.entries()).map(([filePath, items]) => ({ filePath, items }));
}

export function FeedbackList({ filteredItems, submitting, onSelectItem, onResolve, onDelete, onUnresolve }: FeedbackListProps) {
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupByFile(filteredItems), [filteredItems]);

  if (filteredItems.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
        該当する指摘はありません
      </p>
    );
  }

  const toggleCollapse = (filePath: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  };

  return (
    <div>
      {groups.map((group) => {
        const isCollapsed = collapsedFiles.has(group.filePath);
        return (
          <div key={group.filePath}>
            {/* File header */}
            <button
              type="button"
              onClick={() => toggleCollapse(group.filePath)}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500" aria-hidden>
                {isCollapsed ? ">" : "v"}
              </span>
              <span className="truncate text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                {group.filePath}
              </span>
              <span className="ml-auto shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                ({group.items.length})
              </span>
            </button>

            {/* Items */}
            {!isCollapsed && (
              <ul>
                {group.items.map((item, idx) => {
                  const config = STATUS_CONFIG[item._status];
                  const timestamp = item.resolved_at ?? item.submitted_at;
                  const isDraft = item._status === "draft";
                  const isResolved = item._status === "resolved";

                  return (
                    <li
                      key={`${item.file_path}:${item.line_number}:${idx}`}
                      className={`group border-l-2 ${config.border}`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectItem(item, isResolved)}
                        className="w-full px-3 py-2 pl-6 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${config.dot}`} />
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                            {item.line_number === 0
                              ? "whole file"
                              : item.line_number_end != null
                                ? `L${item.line_number}-${item.line_number_end}`
                                : `L${item.line_number}`}
                          </span>
                          <span className={`truncate text-[11px] text-zinc-700 dark:text-zinc-300`}>
                            {(item.comment ?? "").slice(0, 50)}{(item.comment ?? "").length > 50 ? "..." : ""}
                          </span>
                          {timestamp && (
                            <span className="ml-auto shrink-0 text-[9px] text-zinc-400 dark:text-zinc-500" title={timestamp}>
                              {formatRelativeTime(timestamp)}
                            </span>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center justify-end gap-1 px-3 pb-1 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(isDraft || isResolved) && onDelete && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                            disabled={submitting}
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                          >
                            削除
                          </button>
                        )}
                        {isResolved && onUnresolve && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onUnresolve(item); }}
                            disabled={submitting}
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 hover:bg-amber-100 hover:text-amber-600 dark:text-zinc-500 dark:hover:bg-amber-900/30 dark:hover:text-amber-400"
                          >
                            再開
                          </button>
                        )}
                        {!isResolved && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onResolve(item); }}
                            disabled={submitting}
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 hover:bg-emerald-100 hover:text-emerald-600 dark:text-zinc-500 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400"
                          >
                            完了
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
