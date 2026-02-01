"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MonacoDiffViewer } from "@/app/components/MonacoDiffViewer";
import type { FeedbackItem } from "@/lib/feedback";

type FolderNode = {
  type: "folder";
  name: string;
  path: string;
  children: TreeNode[];
};
type FileNode = { type: "file"; name: string; path: string };
type TreeNode = FolderNode | FileNode;

function buildTree(paths: string[]): TreeNode[] {
  const root: FolderNode = { type: "folder", name: "", path: "", children: [] };
  for (const path of paths) {
    const parts = path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const folderPath = parts.slice(0, i + 1).join("/");
      if (isLast) {
        current.children.push({ type: "file", name: part, path });
      } else {
        let child = current.children.find(
          (c): c is FolderNode => c.type === "folder" && c.path === folderPath
        );
        if (!child) {
          child = { type: "folder", name: part, path: folderPath, children: [] };
          current.children.push(child);
        }
        current = child;
      }
    }
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const aIsFolder = a.type === "folder";
      const bIsFolder = b.type === "folder";
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    nodes.forEach((n) => {
      if (n.type === "folder") sortNodes(n.children);
    });
  };
  sortNodes(root.children);
  return root.children;
}

function collectFolderPaths(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.type === "folder") {
      out.push(n.path);
      out.push(...collectFolderPaths(n.children));
    }
  }
  return out;
}

function getFolderState(
  node: FolderNode,
  modifiedSet: Set<string>,
  untrackedSet: Set<string>
): "modified" | "untracked" | "clean" {
  let hasModified = false;
  let hasUntracked = false;
  const visit = (n: TreeNode) => {
    if (n.type === "folder") {
      n.children.forEach(visit);
    } else {
      if (modifiedSet.has(n.path)) hasModified = true;
      else if (untrackedSet.has(n.path)) hasUntracked = true;
    }
  };
  visit(node);
  if (hasModified) return "modified";
  if (hasUntracked) return "untracked";
  return "clean";
}

function getFileTypeIcon(filePath: string): string {
  const name = filePath.split("/").pop() ?? "";
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  if (name.endsWith(".tsx") || name.endsWith(".ts")) return "TS";
  if (name.endsWith(".jsx") || name.endsWith(".mjs") || ext === "js") return "JS";
  if (ext === "json") return "{}";
  if (ext === "css") return "#";
  if (ext === "sh") return "$";
  if (ext === "md") return "MD";
  if (name === ".gitignore") return "◇";
  if (ext === "yaml" || ext === "yml") return "Y";
  return "◇";
}

function FileTreeNodes({
  node,
  depth,
  openTabs,
  activeTabIndex,
  modifiedSet,
  untrackedSet,
  expandedFolders,
  onSelectFile,
  onToggleFolder,
}: {
  node: TreeNode;
  depth: number;
  openTabs: string[];
  activeTabIndex: number;
  modifiedSet: Set<string>;
  untrackedSet: Set<string>;
  expandedFolders: Set<string>;
  onSelectFile: (path: string) => void;
  onToggleFolder: (path: string) => void;
}) {
  const pad = depth * 12;
  if (node.type === "folder") {
    const isExpanded = expandedFolders.has(node.path);
    const folderState = getFolderState(node, modifiedSet, untrackedSet);
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
            {node.children.map((child) => (
              <FileTreeNodes
                key={child.type === "folder" ? child.path : child.path}
                node={child}
                depth={depth + 1}
                openTabs={openTabs}
                activeTabIndex={activeTabIndex}
                modifiedSet={modifiedSet}
                untrackedSet={untrackedSet}
                expandedFolders={expandedFolders}
                onSelectFile={onSelectFile}
                onToggleFolder={onToggleFolder}
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
  const isTrackedClean = !isModified && !isUntracked;

  const stateBadge =
    isModified ? (
      <span
        className="shrink-0 rounded px-1 text-[10px] font-medium text-amber-700 dark:text-amber-400"
        title="変更あり"
      >
        M
      </span>
    ) : isUntracked ? (
      <span
        className="shrink-0 text-[10px] font-medium text-zinc-500 dark:text-zinc-500"
        title="未追跡"
      >
        U
      </span>
    ) : (
      <span
        className="h-2 w-2 shrink-0 rounded-full bg-green-500 dark:bg-green-400"
        title="追跡済み・変更なし"
        aria-hidden
      />
    );

  const nameColor = isModified
    ? "text-amber-700 dark:text-amber-400"
    : isUntracked
      ? "text-green-600 dark:text-green-400"
      : "text-zinc-600 dark:text-zinc-400";

  return (
    <button
      type="button"
      onClick={() => onSelectFile(path)}
      title={path}
      className={`flex w-full items-center gap-2 truncate py-1.5 pr-2 text-left text-sm font-mono ${
        isSelected
          ? "border-l-2 border-emerald-600 bg-emerald-50 font-medium text-zinc-900 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-zinc-100"
          : `border-l-2 border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800 ${nameColor}`
      }`}
      style={{ paddingLeft: `${8 + pad}px` }}
    >
      <span className="w-4 shrink-0 text-center text-[10px] text-zinc-500 dark:text-zinc-500" aria-hidden>
        {getFileTypeIcon(path)}
      </span>
      <span className="min-w-0 flex-1 truncate">{node.name}</span>
      <span className="ml-auto shrink-0">{stateBadge}</span>
    </button>
  );
}

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<string[]>([]);
  const [modifiedSet, setModifiedSet] = useState<Set<string>>(new Set());
  const [untrackedSet, setUntrackedSet] = useState<Set<string>>(new Set());
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [fileContentCache, setFileContentCache] = useState<
    Record<string, { oldContent: string; newContent: string }>
  >({});
  const fetchingPathsRef = useRef<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [openAccordion, setOpenAccordion] = useState<Set<string>>(
    new Set(["directory", "changed", "comments"])
  );
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [selectedLine, setSelectedLine] = useState<{
    file_path: string;
    line_number: number;
    line_number_end?: number;
  } | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [dismissBanner, setDismissBanner] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDismissBanner(null);
    try {
      const res = await fetch("/api/files");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ファイル一覧の取得に失敗しました");
        setFiles([]);
        setModifiedSet(new Set());
        setUntrackedSet(new Set());
        return;
      }
      const list = Array.isArray(data.files) ? data.files : [];
      const mod = Array.isArray(data.modified) ? data.modified : [];
      const untracked = Array.isArray(data.untracked) ? data.untracked : [];
      setFiles(list);
      setModifiedSet(new Set(mod));
      setUntrackedSet(new Set(untracked));
      setExpandedFolders(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "不明なエラー");
      setFiles([]);
      setModifiedSet(new Set());
      setUntrackedSet(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  /** 指摘一覧を API から取得して feedbackItems に反映する */
  const fetchFeedback = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback");
      const data = await res.json();
      setFeedbackItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setFeedbackItems([]);
    }
  }, []);

  const currentPath = openTabs[activeTabIndex] ?? null;
  const fileTree = useMemo(() => buildTree(files), [files]);
  const changedFiles = useMemo(() => {
    const mod = [...modifiedSet].sort();
    const untracked = [...untrackedSet].sort();
    return [...mod, ...untracked];
  }, [modifiedSet, untrackedSet]);

  const toggleAccordion = useCallback((key: string) => {
    setOpenAccordion((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  useEffect(() => {
    const activePath = openTabs[activeTabIndex];
    const toFetch = [
      ...new Set([
        activePath,
        ...openTabs.filter((path) => !(path in fileContentCache)),
      ].filter(Boolean)),
    ].filter((path) => !fetchingPathsRef.current.has(path));
    if (toFetch.length === 0) return;
    const aborted = new Set<string>();
    for (const path of toFetch) {
      fetchingPathsRef.current.add(path);
    }
    for (const path of toFetch) {
      fetch(`/api/file-content?path=${encodeURIComponent(path)}`)
        .then((res) => res.json())
        .then((data: { oldContent?: string; newContent?: string }) => {
          fetchingPathsRef.current.delete(path);
          if (aborted.has(path)) return;
          const oldVal = data.oldContent ?? "";
          const newVal = data.newContent ?? "";
          setFileContentCache((prev) => {
            if (
              prev[path]?.oldContent === oldVal &&
              prev[path]?.newContent === newVal
            )
              return prev;
            return {
              ...prev,
              [path]: { oldContent: oldVal, newContent: newVal },
            };
          });
        })
        .catch(() => {
          fetchingPathsRef.current.delete(path);
          if (aborted.has(path)) return;
          setFileContentCache((prev) => ({
            ...prev,
            [path]: { oldContent: "", newContent: "" },
          }));
        });
    }
    return () => {
      for (const p of toFetch) {
        aborted.add(p);
      }
    };
  }, [openTabs, activeTabIndex, fileContentCache]);

  const onSelectLines = useCallback(
    (file_path: string, line_number: number, line_number_end?: number) => {
      const existing = feedbackItems.find(
        (f) =>
          f.file_path === file_path &&
          f.line_number <= line_number &&
          (f.line_number_end ?? f.line_number) >= (line_number_end ?? line_number)
      );
      if (existing) {
        setSelectedLine({
          file_path: existing.file_path,
          line_number: existing.line_number,
          ...(existing.line_number_end !== undefined
            ? { line_number_end: existing.line_number_end }
            : {}),
        });
        setCommentDraft(existing.comment ?? "");
      } else {
        setSelectedLine({
          file_path,
          line_number,
          ...(line_number_end !== undefined ? { line_number_end } : {}),
        });
        setCommentDraft("");
      }
    },
    [feedbackItems]
  );

  const handleSubmitComment = useCallback(async () => {
    if (!selectedLine) return;
    setSubmitting(true);
    try {
      const body: Record<string, string | number | boolean> = {
        file_path: selectedLine.file_path,
        line_number: selectedLine.line_number,
        comment: commentDraft.trim(),
      };
      if (selectedLine.line_number === 0) {
        body.whole_file = true;
      } else if (selectedLine.line_number_end !== undefined) {
        body.line_number_end = selectedLine.line_number_end;
      }
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "保存に失敗しました");
      }
      await fetchFeedback();
      setSelectedLine(null);
      setCommentDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "不明なエラー");
    } finally {
      setSubmitting(false);
    }
  }, [selectedLine, commentDraft, fetchFeedback]);

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
        ...(selectedLine &&
        selectedLine.file_path === currentPath
          ? [`R-${selectedLine.line_number}`, `L-${selectedLine.line_number}`]
          : []),
      ]
    : [];

  const isDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-full items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              AgentScrutiny
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Diff review for AI agents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                setSubmitStatus("idle");
                setSubmitMessage("");
                setDismissBanner(null);
                try {
                  const res = await fetch("/api/submit", { method: "POST" });
                  const data = await res.json();
                  if (res.ok) {
                    setSubmitStatus("success");
                    setSubmitMessage(data.message ?? "送信しました");
                    await fetchFeedback();
                  } else {
                    setSubmitStatus("error");
                    setSubmitMessage(data.error ?? "送信に失敗しました");
                  }
                } catch (e) {
                  setSubmitStatus("error");
                  setSubmitMessage(e instanceof Error ? e.message : "送信に失敗しました");
                }
              }}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              Submit to Agent
            </button>
          </div>
        </div>
      </header>

      {(error || submitStatus !== "idle") && !dismissBanner && (
        <div className="border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          {error && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setDismissBanner("error")}
                className="shrink-0 rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
          )}
          {!error && submitStatus === "success" && submitMessage && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              <span>{submitMessage}</span>
              <button
                type="button"
                onClick={() => setDismissBanner("success")}
                className="shrink-0 rounded p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
          )}
          {!error && submitStatus === "error" && submitMessage && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
              <span>{submitMessage}</span>
              <button
                type="button"
                onClick={() => setDismissBanner("error")}
                className="shrink-0 rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/50"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {!error && !loading && files.length > 0 && (
          <aside
            className="flex min-h-0 w-[260px] shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            aria-label="ファイル一覧"
          >
            <div className="flex min-h-0 flex-1 flex-col">
              {/* ディレクトリビュー（上・残りスペースを占有） */}
              <div className="flex min-h-0 flex-1 flex-col border-b border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => toggleAccordion("directory")}
                  className="flex w-full shrink-0 items-center gap-2 px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  aria-expanded={openAccordion.has("directory")}
                >
                  <span className="shrink-0 w-4 text-center text-[10px] text-zinc-500 dark:text-zinc-400" aria-hidden>
                    {openAccordion.has("directory") ? "v" : ">"}
                  </span>
                  ディレクトリ
                </button>
                {openAccordion.has("directory") && (
                  <>
                    <div className="flex shrink-0 items-center gap-0.5 border-t border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setExpandedFolders(new Set(collectFolderPaths(fileTree)))}
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
                        onClick={() => setExpandedFolders(new Set())}
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
                        onClick={fetchFiles}
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
                    <nav className="min-h-0 flex-1 overflow-y-auto py-1">
                      {fileTree.map((node) => (
                        <FileTreeNodes
                          key={node.type === "folder" ? node.path : node.path}
                          node={node}
                          depth={0}
                          openTabs={openTabs}
                          activeTabIndex={activeTabIndex}
                          modifiedSet={modifiedSet}
                          untrackedSet={untrackedSet}
                          expandedFolders={expandedFolders}
                          onSelectFile={(path) => {
                            const idx = openTabs.indexOf(path);
                            if (idx >= 0) {
                              setActiveTabIndex(idx);
                              return;
                            }
                            setOpenTabs((prev) => {
                              const newIndex = prev.length;
                              setActiveTabIndex(newIndex);
                              return [...prev, path];
                            });
                          }}
                          onToggleFolder={toggleFolder}
                        />
                      ))}
                    </nav>
                  </>
                )}
              </div>

              {/* 変更ファイル・指摘（下に寄せる） */}
              <div className="shrink-0">
              {/* 変更ファイル */}
              <div className="border-b border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => toggleAccordion("changed")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  aria-expanded={openAccordion.has("changed")}
                >
                  <span className="shrink-0 w-4 text-center text-[10px] text-zinc-500 dark:text-zinc-400" aria-hidden>
                    {openAccordion.has("changed") ? "v" : ">"}
                  </span>
                  変更ファイル ({changedFiles.length})
                </button>
                {openAccordion.has("changed") && (
                  <div className="max-h-48 overflow-y-auto border-t border-zinc-200 py-1 dark:border-zinc-800">
                    {changedFiles.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">変更はありません</p>
                    ) : (
                      <ul>
                        {changedFiles.map((path) => {
                          const isModified = modifiedSet.has(path);
                          const isUntracked = untrackedSet.has(path);
                          const nameColor = isModified
                            ? "text-amber-700 dark:text-amber-400"
                            : isUntracked
                              ? "text-green-600 dark:text-green-400"
                              : "text-zinc-600 dark:text-zinc-400";
                          const stateBadge = isModified ? (
                            <span className="shrink-0 rounded px-1 text-[10px] font-medium text-amber-700 dark:text-amber-400" title="変更あり">M</span>
                          ) : isUntracked ? (
                            <span className="shrink-0 text-[10px] font-medium text-zinc-500 dark:text-zinc-500" title="未追跡">U</span>
                          ) : null;
                          return (
                            <li key={path}>
                              <button
                                type="button"
                                onClick={() => {
                                  const idx = openTabs.indexOf(path);
                                  if (idx >= 0) {
                                    setActiveTabIndex(idx);
                                    return;
                                  }
                                  setOpenTabs((prev) => {
                                    const newIndex = prev.length;
                                    setActiveTabIndex(newIndex);
                                    return [...prev, path];
                                  });
                                }}
                                className={`flex w-full items-center gap-2 truncate px-3 py-1.5 text-left text-sm font-mono hover:bg-zinc-50 dark:hover:bg-zinc-800 ${nameColor}`}
                                title={path}
                              >
                                <span className="min-w-0 flex-1 truncate">{path}</span>
                                {stateBadge}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* 指摘・コメント */}
              <div className="border-b border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => toggleAccordion("comments")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  aria-expanded={openAccordion.has("comments")}
                >
                  <span className="shrink-0 w-4 text-center text-[10px] text-zinc-500 dark:text-zinc-400" aria-hidden>
                    {openAccordion.has("comments") ? "v" : ">"}
                  </span>
                  指摘 ({feedbackItems.length})
                </button>
                {openAccordion.has("comments") && (
                  <div className="max-h-48 overflow-y-auto border-t border-zinc-200 py-1 dark:border-zinc-800">
                    {feedbackItems.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">指摘はありません</p>
                    ) : (
                      <ul>
                        {feedbackItems.map((item, idx) => (
                          <li key={idx}>
                            <button
                              type="button"
                              onClick={() => {
                                const path = item.file_path;
                                const tabIdx = openTabs.indexOf(path);
                                if (tabIdx >= 0) {
                                  setActiveTabIndex(tabIdx);
                                  setSelectedLine({
                                    file_path: path,
                                    line_number: item.line_number,
                                    ...(item.line_number_end !== undefined
                                      ? { line_number_end: item.line_number_end }
                                      : {}),
                                  });
                                  setCommentDraft(item.comment ?? "");
                                  return;
                                }
                                setOpenTabs((prev) => {
                                  const newIndex = prev.length;
                                  setActiveTabIndex(newIndex);
                                  return [...prev, path];
                                });
                                setSelectedLine({
                                  file_path: path,
                                  line_number: item.line_number,
                                  ...(item.line_number_end !== undefined
                                    ? { line_number_end: item.line_number_end }
                                    : {}),
                                });
                                setCommentDraft(item.comment ?? "");
                              }}
                              className="w-full truncate px-3 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                              title={`${item.file_path}:${item.line_number === 0 ? "ファイル全体" : item.line_number_end != null ? `${item.line_number}–${item.line_number_end}` : item.line_number} — ${(item.comment ?? "").slice(0, 80)}`}
                            >
                              <span className="font-medium">{item.file_path}</span>
                              <span className="text-zinc-400 dark:text-zinc-500">
                                :{item.line_number === 0 ? "ファイル全体" : item.line_number_end != null ? `${item.line_number}–${item.line_number_end}` : item.line_number}
                              </span>
                              {" — "}
                              <span className="truncate">
                                {(item.comment ?? "").slice(0, 30)}
                                {(item.comment ?? "").length > 30 ? "…" : ""}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              </div>
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1 flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
          {error && !loading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                エラーが発生しました
              </p>
              <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                {error}
              </p>
              <button
                type="button"
                onClick={() => {
                  setDismissBanner(null);
                  fetchFiles();
                }}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                再試行
              </button>
            </div>
          )}
          {!error && !loading && files.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="rounded-full bg-zinc-200 p-4 dark:bg-zinc-700">
                <svg
                  className="h-8 w-8 text-zinc-500 dark:text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                ファイルがありません
              </p>
              <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                .ai/config.json の targetDir が Git
                リポジトリを指しているか確認してください。
              </p>
              <button
                type="button"
                onClick={() => {
                  setDismissBanner(null);
                  fetchFiles();
                }}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                再試行
              </button>
            </div>
          )}

          {!error && files.length > 0 && openTabs.length === 0 && (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
              ファイルを選択してください
            </div>
          )}

          {!error && files.length > 0 && openTabs.length > 0 && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
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
                        onClick={() => setActiveTabIndex(i)}
                        className="min-w-0 flex-1 truncate text-left"
                        title={path}
                      >
                        {tabLabel}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newTabs = openTabs.filter((_, idx) => idx !== i);
                          setOpenTabs(newTabs);
                          const newIndex =
                            i < activeTabIndex
                              ? activeTabIndex - 1
                              : i === activeTabIndex
                                ? Math.min(activeTabIndex, newTabs.length - 1)
                                : activeTabIndex;
                          setActiveTabIndex(Math.max(0, newIndex));
                          setFileContentCache((prev) => {
                            const next = { ...prev };
                            delete next[path];
                            return next;
                          });
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
              <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {currentPath}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const existing = feedbackItems.find(
                      (f) => f.file_path === currentPath && f.line_number === 0
                    );
                    setSelectedLine({ file_path: currentPath, line_number: 0 });
                    setCommentDraft(existing?.comment ?? "");
                  }}
                  className="shrink-0 rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  title="ファイル全体に指摘"
                  aria-label="ファイル全体に指摘"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              </div>
              <div className="min-h-0 flex-1 flex flex-col overflow-auto">
                {currentPath && !fileContentCache[currentPath] ? (
                  <div className="flex items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
                    読み込み中…
                  </div>
                ) : currentPath && fileContentCache[currentPath] ? (
                  <MonacoDiffViewer
                    original={fileContentCache[currentPath].oldContent}
                    modified={fileContentCache[currentPath].newContent}
                    filePath={currentPath}
                    theme={isDark ? "vs-dark" : "light"}
                    onSelectLines={onSelectLines}
                    highlightLineIds={highlightLineIds}
                  />
                ) : (
                  <div className="flex items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
                    内容を取得できませんでした
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {selectedLine && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="comment-dialog-title"
          onClick={() => {
            setSelectedLine(null);
            setCommentDraft("");
          }}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="comment-dialog-title"
              className="mb-3 text-base font-medium text-zinc-700 dark:text-zinc-300"
            >
              {selectedLine.line_number === 0
                ? `${selectedLine.file_path} にコメント（ファイル全体）`
                : `${selectedLine.file_path} 行 L${selectedLine.line_number}${selectedLine.line_number_end != null ? `–${selectedLine.line_number_end}` : ""} にコメント`}
            </h2>
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (!submitting) handleSubmitComment();
                }
              }}
              placeholder="指摘や修正依頼を入力...（Cmd+Enter で保存）"
              className="mb-4 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              rows={4}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedLine(null);
                  setCommentDraft("");
                }}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSubmitComment}
                disabled={submitting}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {submitting ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
