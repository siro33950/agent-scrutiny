"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeedbackItem } from "@/lib/feedback";
import type { ViewMode } from "@/app/types";
import { buildTree, collectFolderPaths } from "@/app/components/FileTree/treeUtils";
import { useTargets } from "@/app/hooks/useTargets";
import { useBranches } from "@/app/hooks/useBranches";
import { useFiles } from "@/app/hooks/useFiles";
import { useFeedback } from "@/app/hooks/useFeedback";
import { useTabs } from "@/app/hooks/useTabs";
import { useFileContent } from "@/app/hooks/useFileContent";
import { useViewed } from "@/app/hooks/useViewed";
import { useInlineComment } from "@/app/hooks/useInlineComment";
import { Header } from "@/app/components/Header/Header";
import { FileTreeSidebar } from "@/app/components/FileTree/FileTreeSidebar";
import toast from "react-hot-toast";
import { DiffViewerPanel } from "@/app/components/DiffViewer/DiffViewerPanel";
import { FeedbackPanel } from "@/app/components/Feedback/FeedbackPanel";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";

export default function Home() {
  const { targets, selectedTarget, setSelectedTarget, effectiveTarget } = useTargets();
  const { branches } = useBranches(effectiveTarget);
  const { files, modifiedSet, untrackedSet, diffStats, changeTypes, loading, error, setError, fetchFiles } = useFiles();
  const { feedbackItems, resolvedItems, fetchFeedback } = useFeedback(effectiveTarget);
  const { openTabs, activeTabIndex, setActiveTabIndex, selectFile, closeTab, clearTabs } = useTabs();
  const inlineComment = useInlineComment(effectiveTarget, fetchFeedback, setError);

  const [diffBase, setDiffBase] = useState<string>("HEAD");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [treeViewMode, setTreeViewMode] = useState<"changed" | "full">("full");
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false);
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "draft" | "submitted" | "resolved">("all");
  const [actionType, setActionType] = useState<"submit" | "approve">("submit");
  const [viewMode, setViewMode] = useState<ViewMode>("inline");
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<FeedbackItem | null>(null);
  const [selectedResolvedItem, setSelectedResolvedItem] = useState<FeedbackItem | null>(null);
  const cursorLineRef = useRef<number>(1);

  const { viewedFiles, toggleViewed } = useViewed(effectiveTarget);
  const { fileContentCache, clearCache } = useFileContent(openTabs, activeTabIndex, effectiveTarget, diffBase);

  // Target change: clear tabs, cache, fetch files
  useEffect(() => {
    if (!selectedTarget) return;
    clearTabs();
    clearCache();
    setExpandedFolders(new Set());
    toast.dismiss();
    inlineComment.cancel();
    fetchFiles(effectiveTarget, diffBase);
  }, [selectedTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // DiffBase change: clear cache, refetch files
  useEffect(() => {
    if (!selectedTarget) return;
    clearCache();
    setExpandedFolders(new Set());
    fetchFiles(effectiveTarget, diffBase);
  }, [diffBase]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentPath = openTabs[activeTabIndex] ?? null;

  // resolved アイテムは選択されたものだけ DiffViewer に表示
  const visibleResolvedItems = useMemo(() => {
    if (selectedResolvedItem && selectedResolvedItem.file_path === currentPath) {
      return [selectedResolvedItem];
    }
    return [];
  }, [selectedResolvedItem, currentPath]);

  const fileTree = useMemo(() => buildTree(files), [files]);
  const changedFiles = useMemo(() => {
    const mod = [...modifiedSet].sort();
    const untracked = [...untrackedSet].sort();
    return [...mod, ...untracked];
  }, [modifiedSet, untrackedSet]);
  const changedFilesTree = useMemo(() => buildTree(changedFiles), [changedFiles]);

  const feedbackCountByFile = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of feedbackItems) {
      map.set(item.file_path, (map.get(item.file_path) ?? 0) + 1);
    }
    return map;
  }, [feedbackItems]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleWholeFileFeedback = useCallback(() => {
    if (!currentPath) return;
    inlineComment.startCreate(currentPath, 0);
    setFeedbackPanelOpen(true);
  }, [currentPath, inlineComment]);

  const handleAction = useCallback(async () => {
    toast.dismiss("action");
    try {
      if (actionType === "submit") {
        const res = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: effectiveTarget }),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(data.message ?? "送信しました", { id: "action" });
          await fetchFeedback();
        } else {
          toast.error(data.error ?? "送信に失敗しました", { id: "action" });
        }
      } else {
        const res = await fetch("/api/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: effectiveTarget }),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(data.message ?? "コミットを依頼しました", { id: "action" });
        } else {
          toast.error(data.error ?? "コミット依頼に失敗しました", { id: "action" });
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "送信に失敗しました", { id: "action" });
    }
  }, [actionType, effectiveTarget, fetchFeedback]);

  const handleSubmitAll = useCallback(async () => {
    toast.dismiss("action");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: effectiveTarget }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message ?? "送信しました", { id: "action" });
        await fetchFeedback();
      } else {
        toast.error(data.error ?? "送信に失敗しました", { id: "action" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "送信に失敗しました", { id: "action" });
    }
  }, [effectiveTarget, fetchFeedback]);

  const handleSelectFeedbackItem = useCallback(
    (item: FeedbackItem, isResolved?: boolean) => {
      selectFile(item.file_path);
      if (isResolved) {
        setSelectedResolvedItem(item);
      } else {
        setSelectedResolvedItem(null);
      }
    },
    [selectFile]
  );

  const handleDeleteItem = useCallback(
    (item: FeedbackItem) => {
      setConfirmDeleteItem(item);
    },
    []
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteItem) return;
    await inlineComment.deleteItem(confirmDeleteItem);
    setConfirmDeleteItem(null);
  }, [confirmDeleteItem, inlineComment]);

  const handleCursorLineChanged = useCallback((lineNumber: number) => {
    cursorLineRef.current = lineNumber;
  }, []);

  const handleRefresh = useCallback(() => {
    toast.dismiss();
    setExpandedFolders(new Set());
    fetchFiles(effectiveTarget, diffBase);
  }, [fetchFiles, effectiveTarget, diffBase]);

  // Prev/Next file navigation
  const handlePrevFile = useCallback(() => {
    if (!currentPath) return;
    const idx = changedFiles.indexOf(currentPath);
    if (idx > 0) selectFile(changedFiles[idx - 1]);
  }, [currentPath, changedFiles, selectFile]);

  const handleNextFile = useCallback(() => {
    if (!currentPath) return;
    const idx = changedFiles.indexOf(currentPath);
    if (idx >= 0 && idx < changedFiles.length - 1) selectFile(changedFiles[idx + 1]);
  }, [currentPath, changedFiles, selectFile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      const isInput = tag === "textarea" || tag === "input" || tag === "select" ||
        document.activeElement?.getAttribute("contenteditable") === "true";

      if (e.altKey && e.key === "[") {
        e.preventDefault();
        handlePrevFile();
      } else if (e.altKey && e.key === "]") {
        e.preventDefault();
        handleNextFile();
      } else if (e.key === "Escape") {
        if (confirmDeleteItem) {
          e.preventDefault();
          setConfirmDeleteItem(null);
        } else if (inlineComment.state.creatingAt) {
          e.preventDefault();
          inlineComment.cancel();
        }
      } else if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !isInput) {
        if (currentPath) {
          e.preventDefault();
          inlineComment.startCreate(currentPath, cursorLineRef.current);
        }
      } else if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !isInput) {
        e.preventDefault();
        setFeedbackPanelOpen((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlePrevFile, handleNextFile, inlineComment, currentPath, confirmDeleteItem]);

  const highlightLineIds: string[] = currentPath
    ? [
        ...feedbackItems
          .filter((f) => f.file_path === currentPath && f.line_number !== 0)
          .flatMap((f) => {
            const end = f.line_number_end ?? f.line_number;
            const ids: string[] = [];
            for (let n = f.line_number; n <= end; n++) {
              ids.push(`R-${n}`);
              ids.push(`L-${n}`);
            }
            return ids;
          }),
      ]
    : [];

  const isDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Derive creatingAtLine for current file
  const creatingAtLine =
    inlineComment.state.creatingAt?.filePath === currentPath
      ? inlineComment.state.creatingAt.lineNumber
      : null;
  const creatingAtLineEnd =
    inlineComment.state.creatingAt?.filePath === currentPath
      ? (inlineComment.state.creatingAt.lineNumberEnd ?? null)
      : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      <Header
        targets={targets}
        effectiveTarget={effectiveTarget}
        onSelectTarget={setSelectedTarget}
        diffBase={diffBase}
        onSelectDiffBase={setDiffBase}
        branches={branches}
        actionType={actionType}
        onActionTypeChange={setActionType}
        onAction={handleAction}
      />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {!error && !loading && files.length > 0 && (
          <FileTreeSidebar
            fileTree={fileTree}
            changedFilesTree={changedFilesTree}
            changedFilesCount={changedFiles.length}
            openTabs={openTabs}
            activeTabIndex={activeTabIndex}
            modifiedSet={modifiedSet}
            untrackedSet={untrackedSet}
            expandedFolders={expandedFolders}
            treeViewMode={treeViewMode}
            loading={loading}
            feedbackCountByFile={feedbackCountByFile}
            diffStats={diffStats}
            changeTypes={changeTypes}
            viewedFiles={viewedFiles}
            onSelectFile={selectFile}
            onToggleFolder={toggleFolder}
            onSetTreeViewMode={setTreeViewMode}
            onExpandAll={() => setExpandedFolders(new Set(collectFolderPaths(treeViewMode === "changed" ? changedFilesTree : fileTree)))}
            onCollapseAll={() => setExpandedFolders(new Set())}
            onRefresh={handleRefresh}
            onToggleViewed={toggleViewed}
          />
        )}

        <div className="min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
          {error && !loading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">エラーが発生しました</p>
              <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                再試行
              </button>
            </div>
          )}
          {!error && !loading && files.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="rounded-full bg-zinc-200 p-4 dark:bg-zinc-700">
                <svg className="h-8 w-8 text-zinc-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">ファイルがありません</p>
              <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                config.json の targets が Git リポジトリを指しているか確認してください。
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                再試行
              </button>
            </div>
          )}

          {!error && files.length > 0 && (
            <DiffViewerPanel
              openTabs={openTabs}
              activeTabIndex={activeTabIndex}
              currentPath={currentPath}
              fileContentCache={fileContentCache}
              feedbackItems={feedbackItems}
              resolvedItems={visibleResolvedItems}
              highlightLineIds={highlightLineIds}
              isDark={isDark}
              viewMode={viewMode}
              changedFiles={changedFiles}
              creatingAtLine={creatingAtLine}
              creatingAtLineEnd={creatingAtLineEnd}
              onSelectTab={setActiveTabIndex}
              onCloseTab={closeTab}
              onWholeFileFeedback={handleWholeFileFeedback}
              onViewModeChange={setViewMode}
              onPrevFile={handlePrevFile}
              onNextFile={handleNextFile}
              onSaveComment={inlineComment.save}
              onCancelComment={inlineComment.cancel}
              onResolveItem={inlineComment.resolve}
              onDeleteItem={handleDeleteItem}
              onUnresolveItem={inlineComment.unresolve}
              onCreateAtLine={inlineComment.startCreate}
              onCursorLineChanged={handleCursorLineChanged}
            />
          )}

          <FeedbackPanel
            feedbackPanelOpen={feedbackPanelOpen}
            onToggle={() => setFeedbackPanelOpen((p) => !p)}
            feedbackItems={feedbackItems}
            resolvedItems={resolvedItems}
            feedbackFilter={feedbackFilter}
            onFilterChange={setFeedbackFilter}
            onSelectItem={handleSelectFeedbackItem}
            onResolve={inlineComment.resolve}
            onDelete={handleDeleteItem}
            onUnresolve={inlineComment.unresolve}
            onSubmitAll={handleSubmitAll}
            submitting={inlineComment.state.saving}
          />
        </div>
      </main>

      <ConfirmDialog
        open={confirmDeleteItem !== null}
        title="指摘を削除"
        description="この指摘を削除しますか？この操作は元に戻せません。"
        confirmLabel="削除"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteItem(null)}
      />
    </div>
  );
}
