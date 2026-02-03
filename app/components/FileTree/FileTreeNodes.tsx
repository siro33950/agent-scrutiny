import type { TreeNode, FolderNode } from "@/app/types";
import type { DiffStat } from "@/app/hooks/useFiles";
import { getFolderState, getFileTypeIcon } from "./treeUtils";

const CHANGE_TYPE_COLORS: Record<string, string> = {
  M: "text-amber-600 dark:text-amber-400",
  A: "text-green-600 dark:text-green-400",
  D: "text-red-600 dark:text-red-400",
  R: "text-purple-600 dark:text-purple-400",
  C: "text-blue-600 dark:text-blue-400",
  T: "text-zinc-600 dark:text-zinc-400",
};

interface FileTreeNodesProps {
  node: TreeNode;
  depth: number;
  openTabs: string[];
  activeTabIndex: number;
  modifiedSet: Set<string>;
  untrackedSet: Set<string>;
  expandedFolders: Set<string>;
  onSelectFile: (path: string) => void;
  onToggleFolder: (path: string) => void;
  feedbackCountByFile?: Map<string, number>;
  diffStats?: Record<string, DiffStat>;
  changeTypes?: Record<string, string>;
  viewedFiles?: Set<string>;
  onToggleViewed?: (path: string) => void;
}

export function FileTreeNodes({
  node,
  depth,
  openTabs,
  activeTabIndex,
  modifiedSet,
  untrackedSet,
  expandedFolders,
  onSelectFile,
  onToggleFolder,
  feedbackCountByFile,
  diffStats,
  changeTypes,
  viewedFiles,
  onToggleViewed,
}: FileTreeNodesProps) {
  const pad = depth * 12;
  if (node.type === "folder") {
    const isExpanded = expandedFolders.has(node.path);
    const folderState = getFolderState(node as FolderNode, modifiedSet, untrackedSet);
    const folderNameColor =
      folderState === "modified"
        ? "text-amber-700 dark:text-amber-400"
        : folderState === "untracked"
          ? "text-green-600 dark:text-green-400"
          : "text-zinc-600 dark:text-zinc-400";
    return (
      <div className="shrink-0">
        <button
          type="button"
          onClick={() => onToggleFolder(node.path)}
          className={`flex w-full items-center gap-1 truncate py-1.5 pr-2 text-left text-sm font-mono hover:bg-zinc-50 dark:hover:bg-zinc-800 ${folderNameColor}`}
          style={{ paddingLeft: `${8 + pad}px` }}
          title={node.path || "ルート"}
        >
          <span className="shrink-0 w-4 text-center text-[10px] leading-none text-zinc-400 dark:text-zinc-500" aria-hidden>
            {isExpanded ? "v" : ">"}
          </span>
          <span className="min-w-0 truncate font-medium">{node.name || "/"}</span>
        </button>
        {isExpanded && (
          <div>
            {(node as FolderNode).children.map((child) => (
              <FileTreeNodes
                key={child.path}
                node={child}
                depth={depth + 1}
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
      </div>
    );
  }

  const path = node.path;
  const isSelected = openTabs[activeTabIndex] === path;
  const isModified = modifiedSet.has(path);
  const isUntracked = untrackedSet.has(path);
  const commentCount = feedbackCountByFile?.get(path) ?? 0;
  const stat = diffStats?.[path];
  const changeType = changeTypes?.[path];
  const isViewed = viewedFiles?.has(path) ?? false;

  const changeTypeColor = changeType ? (CHANGE_TYPE_COLORS[changeType] ?? "text-zinc-500") : "";

  const nameColor = isModified
    ? "text-amber-700 dark:text-amber-400"
    : isUntracked
      ? "text-green-600 dark:text-green-400"
      : "text-zinc-600 dark:text-zinc-400";

  return (
    <div
      className={`flex w-full items-center gap-1 truncate py-1.5 pr-2 text-sm font-mono ${
        isSelected
          ? "border-l-2 border-emerald-600 bg-emerald-50 font-medium text-zinc-900 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-zinc-100"
          : `border-l-2 border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800 ${nameColor}`
      } ${isViewed ? "opacity-60" : ""}`}
      style={{ paddingLeft: `${8 + pad}px` }}
    >
      {/* Viewed checkbox */}
      {onToggleViewed && (isModified || isUntracked) && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleViewed(path); }}
          className={`shrink-0 flex h-3.5 w-3.5 items-center justify-center rounded border text-[8px] ${
            isViewed
              ? "border-green-500 bg-green-500 text-white dark:border-green-400 dark:bg-green-400"
              : "border-zinc-300 dark:border-zinc-600"
          }`}
          title={isViewed ? "Viewed を解除" : "Viewed としてマーク"}
          aria-label={isViewed ? "Viewed を解除" : "Viewed としてマーク"}
        >
          {isViewed && "✓"}
        </button>
      )}
      {/* Change type icon */}
      {changeType && (
        <span className={`w-3 shrink-0 text-center text-[10px] font-bold ${changeTypeColor}`} title={changeType === "M" ? "Modified" : changeType === "A" ? "Added" : changeType === "D" ? "Deleted" : changeType === "R" ? "Renamed" : changeType}>
          {changeType}
        </span>
      )}
      {/* File type icon */}
      <span className="w-4 shrink-0 text-center text-[10px] text-zinc-500 dark:text-zinc-500" aria-hidden>
        {getFileTypeIcon(path)}
      </span>
      {/* File name */}
      <button
        type="button"
        onClick={() => onSelectFile(path)}
        className="min-w-0 flex-1 truncate text-left"
        title={path}
      >
        {node.name}
      </button>
      {/* Diff stats (+X -Y) */}
      {stat && (stat.additions > 0 || stat.deletions > 0) && (
        <span className="shrink-0 flex items-center gap-0.5 text-[10px]">
          {stat.additions > 0 && <span className="text-green-600 dark:text-green-400">+{stat.additions}</span>}
          {stat.deletions > 0 && <span className="text-red-600 dark:text-red-400">-{stat.deletions}</span>}
        </span>
      )}
      {/* Comment count badge */}
      {commentCount > 0 && (
        <span className="shrink-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-medium text-white">
          {commentCount}
        </span>
      )}
    </div>
  );
}
