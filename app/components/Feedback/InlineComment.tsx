"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedbackItem } from "@/lib/feedback";
import { STATUS_CONFIG, type FeedbackStatus } from "@/app/utils/feedbackStyles";
import { formatRelativeTime } from "@/app/utils/time";

interface InlineCommentProps {
  item?: FeedbackItem;
  status?: FeedbackStatus;
  isNew?: boolean;
  filePath: string;
  lineNumber: number;
  lineNumberEnd?: number;
  onSave: (comment: string) => Promise<void>;
  onResolve?: () => void;
  onUnresolve?: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
  onToggleCollapse?: () => void;
}

export function InlineComment({
  item,
  status,
  isNew,
  filePath,
  lineNumber,
  lineNumberEnd,
  onSave,
  onResolve,
  onUnresolve,
  onDelete,
  onCancel,
  onToggleCollapse,
}: InlineCommentProps) {
  const [draft, setDraft] = useState(item?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const effectiveStatus = status ?? "draft";
  const isEditable = isNew || effectiveStatus === "draft";

  useEffect(() => {
    if (isEditable) {
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [isEditable]);

  useEffect(() => {
    if (isNew) {
      setDraft("");
    } else if (item) {
      setDraft(item.comment ?? "");
    }
  }, [isNew, item]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const maxHeight = 18 * 10 + 12; // ~10 lines
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
    ta.style.overflowY = ta.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft]);

  const handleSave = useCallback(async () => {
    if (saving || !draft.trim()) return;
    setSaving(true);
    try {
      await onSave(draft.trim());
    } finally {
      setSaving(false);
    }
  }, [draft, saving, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
      } else if (e.key === "Escape" && isNew && onCancel) {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    },
    [handleSave, isNew, onCancel]
  );

  const lineLabel =
    lineNumber === 0
      ? "whole file"
      : lineNumberEnd != null
        ? `L${lineNumber}-${lineNumberEnd}`
        : `L${lineNumber}`;

  const config = STATUS_CONFIG[effectiveStatus];
  const borderColor = `${config.border} ${config.bg}`;

  const timestamp = item?.resolved_at ?? item?.submitted_at;

  // draft or creating: editable textarea
  if (isEditable) {
    return (
      <div
        className={`border-l-3 px-3 py-2 max-w-xl ml-8 ${borderColor}`}
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{lineLabel}</span>
          {isNew && (
            <span className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">
              新規
            </span>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Feedbackや修正依頼を入力..."
          className="mb-1 w-full resize-none rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          rows={3}
          style={{ minHeight: "3.5em" }}
        />
        <div className="mb-1.5 text-[9px] text-zinc-400 dark:text-zinc-500">
          {isNew ? "Cmd+Enter: 保存 / Escape: キャンセル" : "Cmd+Enter: 保存"}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Left: delete (draft only, not new) */}
          {!isNew && onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 hover:bg-red-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            >
              削除
            </button>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {isNew && onCancel && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                キャンセル
              </button>
            )}
            {!isNew && onResolve && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onResolve(); }}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
              >
                完了
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleSave(); }}
              disabled={saving || !draft.trim()}
              className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // submitted or resolved: read-only display
  return (
    <div
      className={`border-l-3 px-3 py-2 max-w-xl ml-8 ${borderColor}`}
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
            className="text-zinc-400 dark:text-zinc-500 text-sm font-bold hover:text-zinc-600 dark:hover:text-zinc-300 leading-none"
          >
            −
          </button>
        )}
        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold ${config.badge}`}>
          {config.label}
        </span>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{lineLabel}</span>
        {timestamp && (
          <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500" title={timestamp}>
            {formatRelativeTime(timestamp)}
          </span>
        )}
      </div>

      {/* Body */}
      <p className="whitespace-pre-wrap break-words text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed mb-1.5">
        {item?.comment}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-1.5">
        {effectiveStatus === "resolved" && onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 hover:bg-red-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
          >
            削除
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {effectiveStatus === "resolved" && onUnresolve && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onUnresolve(); }}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30"
            >
              再開
            </button>
          )}
          {effectiveStatus === "submitted" && onResolve && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onResolve(); }}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
            >
              完了
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
