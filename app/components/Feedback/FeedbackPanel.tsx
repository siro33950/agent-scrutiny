import { useCallback, useMemo, useState } from "react";
import type { FeedbackItem } from "@/lib/feedback";
import type { FeedbackStatus } from "@/app/utils/feedbackStyles";
import { FeedbackList } from "./FeedbackList";

function formatFeedbackForClipboard(items: FeedbackItem[]): string {
  if (items.length === 0) return "";
  const lines = items.map((item) => {
    const location = item.line_number === 0
      ? item.file_path
      : item.line_number_end
        ? `${item.file_path}:${item.line_number}-${item.line_number_end}`
        : `${item.file_path}:${item.line_number}`;
    return `- ${location}\n  ${item.comment?.replace(/\n/g, "\n  ") ?? ""}`;
  });
  return lines.join("\n\n");
}

type FilteredItem = FeedbackItem & { _status: FeedbackStatus };

interface FeedbackPanelProps {
  feedbackPanelOpen: boolean;
  onToggle: () => void;
  feedbackItems: FeedbackItem[];
  resolvedItems: FeedbackItem[];
  feedbackFilter: "all" | "draft" | "submitted" | "resolved";
  onFilterChange: (filter: "all" | "draft" | "submitted" | "resolved") => void;
  onSelectItem: (item: FeedbackItem, isResolved?: boolean) => void;
  onResolve: (item: FeedbackItem) => void;
  onDelete?: (item: FeedbackItem) => void;
  onUnresolve?: (item: FeedbackItem) => void;
  onSubmitAll: () => void;
  submitting: boolean;
}

export function FeedbackPanel({
  feedbackPanelOpen,
  onToggle,
  feedbackItems,
  resolvedItems,
  feedbackFilter,
  onFilterChange,
  onSelectItem,
  onResolve,
  onDelete,
  onUnresolve,
  onSubmitAll,
  submitting,
}: FeedbackPanelProps) {
  const draftItems = useMemo(() => feedbackItems.filter((i) => !i.submitted_at), [feedbackItems]);
  const submittedItems = useMemo(() => feedbackItems.filter((i) => !!i.submitted_at), [feedbackItems]);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const handleCopyToClipboard = useCallback(async () => {
    const allItems = [...draftItems, ...submittedItems];
    if (allItems.length === 0) return;
    const text = formatFeedbackForClipboard(allItems);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      console.error("Failed to copy to clipboard");
    }
  }, [draftItems, submittedItems]);

  const filteredItems: FilteredItem[] = useMemo(() => {
    if (feedbackFilter === "all") {
      return [
        ...draftItems.map((i) => ({ ...i, _status: "draft" as const })),
        ...submittedItems.map((i) => ({ ...i, _status: "submitted" as const })),
        ...resolvedItems.map((i) => ({ ...i, _status: "resolved" as const })),
      ];
    }
    if (feedbackFilter === "draft") return draftItems.map((i) => ({ ...i, _status: "draft" as const }));
    if (feedbackFilter === "submitted") return submittedItems.map((i) => ({ ...i, _status: "submitted" as const }));
    return resolvedItems.map((i) => ({ ...i, _status: "resolved" as const }));
  }, [feedbackFilter, draftItems, submittedItems, resolvedItems]);

  return (
    <div className="shrink-0 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
        aria-expanded={feedbackPanelOpen}
      >
        <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400" aria-hidden>
          {feedbackPanelOpen ? "v" : ">"}
        </span>
        Feedback ({feedbackItems.length + resolvedItems.length})
      </button>
      {feedbackPanelOpen && (
        <div className="flex min-h-[200px] max-h-80 flex-col border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
            {(["all", "draft", "submitted", "resolved"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFilterChange(f)}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  feedbackFilter === f
                    ? "bg-emerald-600 text-white dark:bg-emerald-500"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
                aria-pressed={feedbackFilter === f}
              >
                {f === "all" && `全部 (${draftItems.length + submittedItems.length + resolvedItems.length})`}
                {f === "draft" && `下書き (${draftItems.length})`}
                {f === "submitted" && `送信済 (${submittedItems.length})`}
                {f === "resolved" && `完了 (${resolvedItems.length})`}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              {(draftItems.length > 0 || submittedItems.length > 0) && (
                <button
                  type="button"
                  onClick={handleCopyToClipboard}
                  className="rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  title="フィードバックをクリップボードにコピー"
                >
                  {copyStatus === "copied" ? "Copied!" : "Copy"}
                </button>
              )}
              {draftItems.length > 0 && (
                <button
                  type="button"
                  onClick={onSubmitAll}
                  disabled={submitting}
                  className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                >
                  {draftItems.length}件を送信
                </button>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {filteredItems.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                {feedbackFilter === "all" ? "指摘はありません" : "該当する指摘はありません"}
              </p>
            ) : (
              <FeedbackList
                filteredItems={filteredItems}
                submitting={submitting}
                onSelectItem={onSelectItem}
                onResolve={onResolve}
                onDelete={onDelete}
                onUnresolve={onUnresolve}
              />
            )}
          </div>
          <div className="shrink-0 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              一覧から指摘をクリックでファイルを開く / f キーでパネル開閉
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
