"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MonacoDiffViewer } from "@/app/components/MonacoDiffViewer";
import type { FeedbackItem } from "@/lib/feedback";
import type { ViewMode } from "@/app/types";
import { TabBar } from "./TabBar";
import { DiffViewerToolbar } from "./DiffViewerToolbar";

function getItemId(item: FeedbackItem): string {
  return `${item.file_path}:${item.line_number}:${item.line_number_end ?? ""}`;
}

interface DiffViewerPanelProps {
  openTabs: string[];
  activeTabIndex: number;
  currentPath: string | null;
  fileContentCache: Record<string, { oldContent: string; newContent: string }>;
  feedbackItems: FeedbackItem[];
  resolvedItems: FeedbackItem[];
  highlightLineIds: string[];
  isDark: boolean;
  viewMode: ViewMode;
  changedFiles: string[];
  creatingAtLine: number | null;
  creatingAtLineEnd: number | null;
  onSelectTab: (index: number) => void;
  onCloseTab: (index: number) => void;
  onWholeFileFeedback: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onPrevFile: () => void;
  onNextFile: () => void;
  onSaveComment: (filePath: string, lineNumber: number, lineNumberEnd: number | undefined, comment: string) => Promise<void>;
  onCancelComment: () => void;
  onResolveItem: (item: FeedbackItem) => void;
  onDeleteItem?: (item: FeedbackItem) => void;
  onUnresolveItem?: (item: FeedbackItem) => void;
  onCreateAtLine: (filePath: string, lineNumber: number, lineNumberEnd?: number) => void;
  onCursorLineChanged?: (lineNumber: number) => void;
}

export function DiffViewerPanel({
  openTabs,
  activeTabIndex,
  currentPath,
  fileContentCache,
  feedbackItems,
  resolvedItems,
  highlightLineIds,
  isDark,
  viewMode,
  changedFiles,
  creatingAtLine,
  creatingAtLineEnd,
  onSelectTab,
  onCloseTab,
  onWholeFileFeedback,
  onViewModeChange,
  onPrevFile,
  onNextFile,
  onSaveComment,
  onCancelComment,
  onResolveItem,
  onDeleteItem,
  onUnresolveItem,
  onCreateAtLine,
  onCursorLineChanged,
}: DiffViewerPanelProps) {
  const currentIndex = currentPath ? changedFiles.indexOf(currentPath) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < changedFiles.length - 1;

  const currentFeedbackItems = useMemo(
    () => feedbackItems.filter((f) => f.file_path === currentPath),
    [feedbackItems, currentPath]
  );
  const currentResolvedItems = useMemo(
    () => resolvedItems.filter((f) => f.file_path === currentPath),
    [resolvedItems, currentPath]
  );

  // Collapsed state management: submitted/resolved are collapsed by default
  const [collapsedCommentIds, setCollapsedCommentIds] = useState<Set<string>>(new Set());
  const [userToggledIds, setUserToggledIds] = useState<Set<string>>(new Set());

  // Calculate which items should be collapsed (non-draft items that haven't been explicitly expanded)
  const allCurrentItems = useMemo(() => [...currentFeedbackItems, ...currentResolvedItems], [currentFeedbackItems, currentResolvedItems]);

  const collapsibleItems = useMemo(() => {
    return allCurrentItems.filter((item) => {
      const isSubmitted = Boolean(item.submitted_at);
      const isResolved = Boolean(item.resolved_at);
      return isSubmitted || isResolved;
    });
  }, [allCurrentItems]);

  // Initialize collapsed state for new items (submitted/resolved default to collapsed)
  useEffect(() => {
    setCollapsedCommentIds((prevCollapsed) => {
      const newCollapsedIds = new Set<string>();
      for (const item of collapsibleItems) {
        const id = getItemId(item);
        // If user hasn't toggled this item, use default (collapsed for submitted/resolved)
        if (!userToggledIds.has(id)) {
          newCollapsedIds.add(id);
        } else if (prevCollapsed.has(id)) {
          // Preserve user's explicit choice
          newCollapsedIds.add(id);
        }
      }
      // Only update if actually changed
      if (newCollapsedIds.size === prevCollapsed.size) {
        let same = true;
        for (const id of newCollapsedIds) {
          if (!prevCollapsed.has(id)) {
            same = false;
            break;
          }
        }
        if (same) return prevCollapsed;
      }
      return newCollapsedIds;
    });
  }, [collapsibleItems, userToggledIds]);

  const handleToggleCommentCollapse = useCallback((itemId: string) => {
    setUserToggledIds((prev) => new Set(prev).add(itemId));
    setCollapsedCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const ids = collapsibleItems.map(getItemId);
    setUserToggledIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    setCollapsedCommentIds(new Set());
  }, [collapsibleItems]);

  const handleCollapseAll = useCallback(() => {
    const ids = collapsibleItems.map(getItemId);
    setUserToggledIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    setCollapsedCommentIds(new Set(ids));
  }, [collapsibleItems]);

  const hasCollapsibleComments = collapsibleItems.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {openTabs.length === 0 ? (
        <div className="flex min-h-[200px] flex-1 items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
          ファイルを選択してください
        </div>
      ) : (
        <>
          <TabBar
            openTabs={openTabs}
            activeTabIndex={activeTabIndex}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
          />
          <DiffViewerToolbar
            currentPath={currentPath}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            onPrevFile={onPrevFile}
            onNextFile={onNextFile}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onWholeFileFeedback={onWholeFileFeedback}
            hasCollapsibleComments={hasCollapsibleComments}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-[400px] min-w-0 flex-1 flex-col overflow-hidden">
              {currentPath && !fileContentCache[currentPath] ? (
                <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
                  読み込み中…
                </div>
              ) : currentPath && fileContentCache[currentPath] ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <MonacoDiffViewer
                    original={fileContentCache[currentPath].oldContent}
                    modified={fileContentCache[currentPath].newContent}
                    filePath={currentPath}
                    theme={isDark ? "vs-dark" : "light"}
                    highlightLineIds={highlightLineIds}
                    feedbackItems={currentFeedbackItems}
                    resolvedItems={currentResolvedItems}
                    viewMode={viewMode}
                    creatingAtLine={creatingAtLine}
                    creatingAtLineEnd={creatingAtLineEnd}
                    onSaveComment={onSaveComment}
                    onCancelComment={onCancelComment}
                    onResolveItem={onResolveItem}
                    onDeleteItem={onDeleteItem}
                    onUnresolveItem={onUnresolveItem}
                    onCreateAtLine={onCreateAtLine}
                    onCursorLineChanged={onCursorLineChanged}
                    collapsedCommentIds={collapsedCommentIds}
                    onToggleCommentCollapse={handleToggleCommentCollapse}
                  />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
                  内容を取得できませんでした
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
