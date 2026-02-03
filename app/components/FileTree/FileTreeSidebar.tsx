import { useMemo, useState } from "react";
import type { TreeNode } from "@/app/types";
import type { DiffStat } from "@/app/hooks/useFiles";
import { FileTreeNodes } from "./FileTreeNodes";
import { FileTreeToolbar } from "./FileTreeToolbar";

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query.trim()) return nodes;
  const lowerQuery = query.toLowerCase();

  return nodes
    .map((node) => {
      if (node.type === "folder") {
        const filteredChildren = filterTree(node.children, query);
        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
        return null;
      }
      if (node.path.toLowerCase().includes(lowerQuery)) {
        return node;
      }
      return null;
    })
    .filter((node): node is TreeNode => node !== null);
}

interface FileTreeSidebarProps {
  fileTree: TreeNode[];
  changedFilesTree: TreeNode[];
  changedFilesCount: number;
  openTabs: string[];
  activeTabIndex: number;
  modifiedSet: Set<string>;
  untrackedSet: Set<string>;
  expandedFolders: Set<string>;
  treeViewMode: "changed" | "full";
  loading: boolean;
  feedbackCountByFile: Map<string, number>;
  diffStats: Record<string, DiffStat>;
  changeTypes: Record<string, string>;
  viewedFiles: Set<string>;
  onSelectFile: (path: string) => void;
  onToggleFolder: (path: string) => void;
  onSetTreeViewMode: (mode: "changed" | "full") => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onRefresh: () => void;
  onToggleViewed: (path: string) => void;
}

export function FileTreeSidebar({
  fileTree,
  changedFilesTree,
  changedFilesCount,
  openTabs,
  activeTabIndex,
  modifiedSet,
  untrackedSet,
  expandedFolders,
  treeViewMode,
  loading,
  feedbackCountByFile,
  diffStats,
  changeTypes,
  viewedFiles,
  onSelectFile,
  onToggleFolder,
  onSetTreeViewMode,
  onExpandAll,
  onCollapseAll,
  onRefresh,
  onToggleViewed,
}: FileTreeSidebarProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const baseTree = treeViewMode === "changed" ? changedFilesTree : fileTree;
  const currentTree = useMemo(() => filterTree(baseTree, filterQuery), [baseTree, filterQuery]);

  return (
    <aside
      className="flex min-h-0 w-[260px] shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="ファイル一覧"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex shrink-0 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => onSetTreeViewMode("changed")}
              className={`flex-1 px-2 py-1.5 text-center text-xs font-medium ${
                treeViewMode === "changed"
                  ? "border-b-2 border-emerald-600 text-zinc-900 dark:border-emerald-500 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
              aria-pressed={treeViewMode === "changed"}
            >
              Changed ({changedFilesCount})
            </button>
            <button
              type="button"
              onClick={() => onSetTreeViewMode("full")}
              className={`flex-1 px-2 py-1.5 text-center text-xs font-medium ${
                treeViewMode === "full"
                  ? "border-b-2 border-emerald-600 text-zinc-900 dark:border-emerald-500 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
              aria-pressed={treeViewMode === "full"}
            >
              All
            </button>
          </div>
          <div className="shrink-0 px-2 py-1.5">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="ファイルを検索..."
              className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400"
              aria-label="ファイルを検索"
            />
          </div>
          <FileTreeToolbar
            loading={loading}
            onExpandAll={onExpandAll}
            onCollapseAll={onCollapseAll}
            onRefresh={onRefresh}
          />
          <nav className="min-h-0 flex-1 overflow-y-auto py-1">
            {treeViewMode === "changed" && changedFilesCount === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">変更はありません</p>
            ) : currentTree.length === 0 && filterQuery ? (
              <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">「{filterQuery}」に一致するファイルはありません</p>
            ) : (
              <div className="py-1">
                {currentTree.map((node) => (
                  <FileTreeNodes
                    key={node.path}
                    node={node}
                    depth={0}
                    openTabs={openTabs}
                    activeTabIndex={activeTabIndex}
                    modifiedSet={modifiedSet}
                    untrackedSet={untrackedSet}
                    expandedFolders={expandedFolders}
                    onSelectFile={onSelectFile}
                    onToggleFolder={onToggleFolder}
                    feedbackCountByFile={feedbackCountByFile}
                    diffStats={diffStats}
                    changeTypes={changeTypes}
                    viewedFiles={viewedFiles}
                    onToggleViewed={onToggleViewed}
                  />
                ))}
              </div>
            )}
          </nav>
        </div>
      </div>
    </aside>
  );
}
