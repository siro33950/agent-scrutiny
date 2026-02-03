"use client";

import { DiffEditor } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { FeedbackItem } from "@/lib/feedback";
import { InlineComment } from "./Feedback/InlineComment";

function getLanguageFromPath(filePath: string): string {
  const name = filePath.split("/").pop() ?? "";
  if (name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".ts")) return "typescript";
  if (name.endsWith(".jsx")) return "javascript";
  if (name.endsWith(".mjs") || name.endsWith(".cjs")) return "javascript";
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  switch (ext) {
    case "js":
      return "javascript";
    case "json":
      return "json";
    case "css":
    case "scss":
    case "less":
      return ext;
    case "md":
    case "markdown":
      return "markdown";
    case "yaml":
    case "yml":
      return "yaml";
    case "sh":
    case "bash":
      return "shell";
    case "py":
      return "python";
    case "go":
      return "go";
    case "rs":
    case "rlib":
      return "rust";
    case "java":
      return "java";
    case "html":
      return "html";
    case "xml":
      return "xml";
    default:
      return "plaintext";
  }
}

export interface MonacoDiffViewerProps {
  original: string;
  modified: string;
  filePath: string;
  language?: string;
  theme?: "light" | "vs-dark";
  highlightLineIds?: string[];
  renderSideBySide?: boolean;
  feedbackItems?: FeedbackItem[];
  resolvedItems?: FeedbackItem[];
  creatingAtLine?: number | null;
  creatingAtLineEnd?: number | null;
  onSaveComment: (filePath: string, lineNumber: number, lineNumberEnd: number | undefined, comment: string) => Promise<void>;
  onCancelComment: () => void;
  onResolveItem?: (item: FeedbackItem) => void;
  onDeleteItem?: (item: FeedbackItem) => void;
  onUnresolveItem?: (item: FeedbackItem) => void;
  onCreateAtLine?: (filePath: string, lineNumber: number, lineNumberEnd?: number) => void;
  onCursorLineChanged?: (lineNumber: number) => void;
  collapsedCommentIds?: Set<string>;
  onToggleCommentCollapse?: (itemId: string) => void;
}

export function MonacoDiffViewer({
  original,
  modified,
  filePath,
  language: languageProp,
  theme = "light",
  highlightLineIds,
  renderSideBySide = false,
  feedbackItems,
  resolvedItems,
  creatingAtLine,
  creatingAtLineEnd,
  onSaveComment,
  onCancelComment,
  onResolveItem,
  onDeleteItem,
  onUnresolveItem,
  onCreateAtLine,
  onCursorLineChanged,
  collapsedCommentIds,
  onToggleCommentCollapse,
}: MonacoDiffViewerProps) {
  const [editorReady, setEditorReady] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const modifiedEditorRef = useRef<Monaco.editor.ICodeEditor | null>(null);
  const originalEditorRef = useRef<Monaco.editor.ICodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const hoverDecorationIdsRef = useRef<string[]>([]);
  const highlightDecorationIdsRef = useRef<string[]>([]);
  const dragRangeDecorationIdsRef = useRef<string[]>([]);
  const collapsedIconDecorationIdsRef = useRef<string[]>([]);
  const dragStartLineRef = useRef<number | null>(null);
  const dragEndLineRef = useRef<number | null>(null);
  type ZoneRef = { id: string; config: Monaco.editor.IViewZone; domNode: HTMLDivElement };
  const zoneRefsRef = useRef<ZoneRef[]>([]);
  const viewZoneRootsRef = useRef<Root[]>([]);
  // 差分更新用: itemId → { zoneRef, root, observer }
  type ZoneEntry = { zoneRef: ZoneRef; root: Root; observer: ResizeObserver };
  const zoneByItemIdRef = useRef<Map<string, ZoneEntry>>(new Map());
  const prevCollapsedIdsRef = useRef<Set<string>>(new Set());
  const observersRef = useRef<ResizeObserver[]>([]);
  const onCreateAtLineRef = useRef(onCreateAtLine);
  const onResolveItemRef = useRef(onResolveItem);
  const onDeleteItemRef = useRef(onDeleteItem);
  const onUnresolveItemRef = useRef(onUnresolveItem);
  const onSaveCommentRef = useRef(onSaveComment);
  const onCancelCommentRef = useRef(onCancelComment);
  const onCursorLineChangedRef = useRef(onCursorLineChanged);
  const onToggleCommentCollapseRef = useRef(onToggleCommentCollapse);
  const feedbackItemsRef = useRef(feedbackItems);
  const resolvedItemsRef = useRef(resolvedItems);
  const collapsedCommentIdsRef = useRef(collapsedCommentIds);
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;
  onCreateAtLineRef.current = onCreateAtLine;
  onResolveItemRef.current = onResolveItem;
  onDeleteItemRef.current = onDeleteItem;
  onUnresolveItemRef.current = onUnresolveItem;
  onSaveCommentRef.current = onSaveComment;
  onCancelCommentRef.current = onCancelComment;
  onCursorLineChangedRef.current = onCursorLineChanged;
  onToggleCommentCollapseRef.current = onToggleCommentCollapse;
  feedbackItemsRef.current = feedbackItems;
  resolvedItemsRef.current = resolvedItems;
  collapsedCommentIdsRef.current = collapsedCommentIds;

  // collapsedCommentIds の内容をシリアライズしたキー（Set の参照変化ではなく内容で比較）
  const collapsedIdsKey = useMemo(() => {
    if (!collapsedCommentIds || collapsedCommentIds.size === 0) return "";
    return Array.from(collapsedCommentIds).sort().join("\n");
  }, [collapsedCommentIds]);

  const updatePlusDecoration = useCallback((lineNumber: number | null) => {
    const editor = modifiedEditorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const newDecos =
      lineNumber != null
        ? [
            {
              range: new monaco.Range(lineNumber, 1, lineNumber, 1),
              options: { glyphMarginClassName: "scrutiny-comment-plus" },
            },
          ]
        : [];
    const nextIds = editor.deltaDecorations(hoverDecorationIdsRef.current, newDecos);
    hoverDecorationIdsRef.current = nextIds;
  }, []);

  const updateDragRangeDecoration = useCallback(
    (startLine: number | null, endLine: number | null) => {
      const editor = modifiedEditorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco) return;
      if (startLine == null || endLine == null) {
        const nextIds = editor.deltaDecorations(
          dragRangeDecorationIdsRef.current,
          []
        );
        dragRangeDecorationIdsRef.current = nextIds;
        return;
      }
      const s = Math.min(startLine, endLine);
      const e = Math.max(startLine, endLine);
      const newDecos = [];
      for (let line = s; line <= e; line++) {
        newDecos.push({
          range: new monaco.Range(line, 1, line, 1),
          options: { isWholeLine: true, className: "scrutiny-drag-range" },
        });
      }
      const nextIds = editor.deltaDecorations(
        dragRangeDecorationIdsRef.current,
        newDecos
      );
      dragRangeDecorationIdsRef.current = nextIds;
    },
    []
  );

  useEffect(() => {
    const editor = modifiedEditorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !highlightLineIds?.length) {
      if (editor && highlightDecorationIdsRef.current.length > 0) {
        highlightDecorationIdsRef.current = editor.deltaDecorations(
          highlightDecorationIdsRef.current,
          []
        );
      }
      return;
    }
    const lineNumbers = new Set<number>();
    for (const id of highlightLineIds) {
      const m = /^(?:R|L)-(\d+)$/.exec(id);
      if (m) lineNumbers.add(Number(m[1]));
    }
    const newDecos = Array.from(lineNumbers).map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: { isWholeLine: true, className: "scrutiny-feedback-line" },
    }));
    const nextIds = editor.deltaDecorations(
      highlightDecorationIdsRef.current,
      newDecos
    );
    highlightDecorationIdsRef.current = nextIds;
  }, [highlightLineIds, editorReady]);

  // Sync ViewZones for inline comments (expanded only) and Decorations for collapsed
  useEffect(() => {
    const editor = modifiedEditorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !editorReady) return;

    // Cleanup previous observers
    for (const obs of observersRef.current) obs.disconnect();
    observersRef.current = [];

    const items = feedbackItems ?? [];
    const resolved = resolvedItems ?? [];
    const allItems = [
      ...items.map((i) => ({ ...i, _resolved: false })),
      ...resolved.map((i) => ({ ...i, _resolved: true })),
    ];
    const lineItems = allItems.filter((f) => f.line_number > 0);

    // Clear existing ViewZones
    const staleRoots = [...viewZoneRootsRef.current];
    editor.changeViewZones((accessor) => {
      for (const ref of zoneRefsRef.current) {
        accessor.removeZone(ref.id);
      }
      zoneRefsRef.current = [];
    });
    viewZoneRootsRef.current = [];
    if (staleRoots.length > 0) {
      queueMicrotask(() => {
        for (const root of staleRoots) root.unmount();
      });
    }

    const sorted = [...lineItems].sort((a, b) => a.line_number - b.line_number);

    // Collect zone entries: existing items + creating zone
    type LocalZoneEntry = {
      itemId: string | null; // null for creating zone
      afterLine: number;
      estimatedHeight: number;
      render: (domNode: HTMLDivElement) => Root;
    };

    const zoneEntries: LocalZoneEntry[] = [];
    // Collapsed items use Decoration (icon in gutter) instead of ViewZone
    const collapsedDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

    for (const item of sorted) {
      const afterLine = item.line_number_end ?? item.line_number;
      const status: "draft" | "submitted" | "resolved" = item._resolved
        ? "resolved"
        : item.submitted_at
          ? "submitted"
          : "draft";
      const isDraft = status === "draft";
      const itemId = `${item.file_path}:${item.line_number}:${item.line_number_end ?? ""}`;
      const isCollapsed = !isDraft && (collapsedCommentIdsRef.current?.has(itemId) ?? false);

      if (isCollapsed) {
        // Collapsed: show icon in gutter instead of ViewZone
        const statusClass = status === "resolved" ? "scrutiny-comment-resolved" : "scrutiny-comment-submitted";
        collapsedDecorations.push({
          range: new monaco.Range(item.line_number, 1, item.line_number, 1),
          options: {
            glyphMarginClassName: `scrutiny-comment-icon ${statusClass}`,
            glyphMarginHoverMessage: { value: `**${status === "resolved" ? "完了" : "送信済"}**: ${(item.comment ?? "").slice(0, 100)}${(item.comment ?? "").length > 100 ? "..." : ""}` },
          },
        });
      } else {
        // Expanded: use ViewZone
        const commentLen = item.comment?.length ?? 0;
        const commentLines = Math.ceil(commentLen / 70) + 1;
        const estimatedHeight = isDraft ? 140 : Math.max(44, commentLines * 18 + 28);

        zoneEntries.push({
          itemId,
          afterLine,
          estimatedHeight,
          render: (domNode) => {
            const root = createRoot(domNode);
            root.render(
              <InlineComment
                item={item}
                status={status}
                filePath={item.file_path}
                lineNumber={item.line_number}
                lineNumberEnd={item.line_number_end}
                onSave={async (comment) => {
                  await onSaveCommentRef.current?.(
                    item.file_path,
                    item.line_number,
                    item.line_number_end,
                    comment
                  );
                }}
                onResolve={() => onResolveItemRef.current?.(item)}
                onDelete={status === "draft" ? () => onDeleteItemRef.current?.(item) : undefined}
                onUnresolve={status === "resolved" ? () => onUnresolveItemRef.current?.(item) : undefined}
                onToggleCollapse={!isDraft ? () => onToggleCommentCollapseRef.current?.(itemId) : undefined}
              />
            );
            return root;
          },
        });
      }
    }

    // Update collapsed icon decorations
    const nextCollapsedIds = editor.deltaDecorations(collapsedIconDecorationIdsRef.current, collapsedDecorations);
    collapsedIconDecorationIdsRef.current = nextCollapsedIds;

    // Add creating zone if active
    if (creatingAtLine != null) {
      const afterLine = creatingAtLineEnd ?? creatingAtLine;
      zoneEntries.push({
        itemId: null, // creating zone has no itemId
        afterLine,
        estimatedHeight: 140,
        render: (domNode) => {
          const root = createRoot(domNode);
          root.render(
            <InlineComment
              isNew
              filePath={filePathRef.current}
              lineNumber={creatingAtLine}
              lineNumberEnd={creatingAtLineEnd ?? undefined}
              onSave={async (comment) => {
                await onSaveCommentRef.current?.(
                  filePathRef.current,
                  creatingAtLine,
                  creatingAtLineEnd ?? undefined,
                  comment
                );
              }}
              onCancel={() => onCancelCommentRef.current?.()}
            />
          );
          return root;
        },
      });
    }

    // Sort all entries by line
    zoneEntries.sort((a, b) => a.afterLine - b.afterLine);

    // 差分更新用マップをクリア（全再構築なので）
    zoneByItemIdRef.current.clear();

    editor.changeViewZones((accessor) => {
      const newZoneRefs: ZoneRef[] = [];
      const newRoots: Root[] = [];
      for (const entry of zoneEntries) {
        const domNode = document.createElement("div");
        domNode.style.zIndex = "10";
        domNode.style.position = "relative";
        domNode.style.pointerEvents = "auto";

        // stopPropagation で editor へのイベント伝播を防止
        // (suppressMouseDown: false なので preventDefault は呼ばれず textarea の focus が正常動作)
        domNode.addEventListener("mousedown", (e) => e.stopPropagation());

        const zoneConfig: Monaco.editor.IViewZone = {
          afterLineNumber: entry.afterLine,
          heightInPx: entry.estimatedHeight,
          domNode,
        };
        const zoneId = accessor.addZone(zoneConfig);

        const zoneRef: ZoneRef = { id: zoneId, config: zoneConfig, domNode };
        newZoneRefs.push(zoneRef);

        const root = entry.render(domNode);
        newRoots.push(root);

        // ResizeObserver: 子要素のサイズ変化を監視して高さを更新
        const observer = new ResizeObserver(() => {
          const child = domNode.firstElementChild as HTMLElement | null;
          const height = child?.offsetHeight ?? 0;
          if (!height || height <= 0) return;
          const rounded = Math.ceil(height);
          if (Math.abs(rounded - (zoneRef.config.heightInPx ?? 0)) < 2) return;
          zoneRef.config.heightInPx = rounded;
          editor.changeViewZones((acc) => acc.layoutZone(zoneRef.id));
        });

        // MutationObserver: React が子要素を追加したら ResizeObserver を開始
        const mutationObserver = new MutationObserver(() => {
          const child = domNode.firstElementChild;
          if (child) {
            observer.observe(child);
            mutationObserver.disconnect();
          }
        });
        mutationObserver.observe(domNode, { childList: true });
        observersRef.current.push(observer);

        // 差分更新用マップに登録（itemId がある場合のみ）
        if (entry.itemId) {
          zoneByItemIdRef.current.set(entry.itemId, { zoneRef, root, observer });
        }
      }
      zoneRefsRef.current = newZoneRefs;
      viewZoneRootsRef.current = newRoots;
    });

    // 現在の collapsed 状態を記録
    prevCollapsedIdsRef.current = new Set(collapsedCommentIdsRef.current ?? []);

    return () => {
      for (const obs of observersRef.current) obs.disconnect();
      observersRef.current = [];
      const roots = [...viewZoneRootsRef.current];
      editor.changeViewZones((accessor) => {
        for (const ref of zoneRefsRef.current) {
          accessor.removeZone(ref.id);
        }
        zoneRefsRef.current = [];
      });
      viewZoneRootsRef.current = [];
      zoneByItemIdRef.current.clear();
      if (roots.length > 0) {
        queueMicrotask(() => {
          for (const root of roots) root.unmount();
        });
      }
    };
  }, [feedbackItems, resolvedItems, editorReady, creatingAtLine, creatingAtLineEnd, collapsedIdsKey]);

  const handleMount = useCallback(
    (editor: Monaco.editor.IDiffEditor, monaco: typeof Monaco) => {
      const originalEditor = editor.getOriginalEditor();
      const modifiedEditor = editor.getModifiedEditor();
      modifiedEditorRef.current = modifiedEditor;
      originalEditorRef.current = originalEditor;
      monacoRef.current = monaco;
      setEditorReady(true);

      originalEditor.updateOptions({ readOnly: true });
      modifiedEditor.updateOptions({ readOnly: true, glyphMargin: true });

      const cursorLineDispose = modifiedEditor.onDidChangeCursorPosition((e) => {
        updatePlusDecoration(e.position.lineNumber);
        onCursorLineChangedRef.current?.(e.position.lineNumber);
      });
      const pos = modifiedEditor.getPosition();
      updatePlusDecoration(pos?.lineNumber ?? 1);

      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const getTargetAt = (clientX: number, clientY: number) => {
        const modified = modifiedEditorRef.current?.getTargetAtClientPoint(clientX, clientY);
        if (modified) return { target: modified, editor: modifiedEditorRef.current };
        const original = originalEditorRef.current?.getTargetAtClientPoint(clientX, clientY);
        if (original) return { target: original, editor: originalEditorRef.current };
        return null;
      };

      const onMouseMove = (e: MouseEvent) => {
        const hit = getTargetAt(e.clientX, e.clientY);
        const lineNumber = hit?.target?.position?.lineNumber ?? null;
        if (dragStartLineRef.current != null && lineNumber != null) {
          dragEndLineRef.current = lineNumber;
          updateDragRangeDecoration(dragStartLineRef.current, dragEndLineRef.current);
        }
      };

      const onWrapperMouseDown = (e: MouseEvent) => {
        const target = e.target as Node;
        if (!wrapper.contains(target)) return;

        // Check if clicked on collapsed comment icon
        const isCommentIcon = (target as HTMLElement).closest?.(".scrutiny-comment-icon") != null;
        if (isCommentIcon) {
          const hit = getTargetAt(e.clientX, e.clientY);
          if (hit?.target?.position) {
            const lineNumber = hit.target.position.lineNumber;
            // Find the collapsed item at this line
            const allItems = [
              ...(feedbackItemsRef.current ?? []),
              ...(resolvedItemsRef.current ?? []),
            ];
            const item = allItems.find((i) => i.line_number === lineNumber);
            if (item) {
              const itemId = `${item.file_path}:${item.line_number}:${item.line_number_end ?? ""}`;
              onToggleCommentCollapseRef.current?.(itemId);
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }
        }

        const isPlusGlyph = (target as HTMLElement).closest?.(".scrutiny-comment-plus") != null;
        if (!isPlusGlyph) return;
        const hit = getTargetAt(e.clientX, e.clientY);
        if (!hit?.target?.position) return;
        const lineNumber = hit.target.position.lineNumber;
        dragStartLineRef.current = lineNumber;
        dragEndLineRef.current = lineNumber;
        updateDragRangeDecoration(lineNumber, lineNumber);
      };

      const finishDrag = () => {
        const start = dragStartLineRef.current;
        if (start == null) return;
        updateDragRangeDecoration(null, null);
        const end = dragEndLineRef.current ?? start;
        const s = Math.min(start, end);
        const e = Math.max(start, end);
        dragStartLineRef.current = null;
        dragEndLineRef.current = null;
        // Inline creation instead of opening bottom panel
        onCreateAtLineRef.current?.(filePathRef.current, s, s === e ? undefined : e);
      };

      const onWrapperMouseUp = () => {
        finishDrag();
      };

      const useCapture = true;
      wrapper.addEventListener("mousemove", onMouseMove, useCapture);
      wrapper.addEventListener("mousedown", onWrapperMouseDown, useCapture);
      wrapper.addEventListener("mouseup", onWrapperMouseUp, useCapture);

      const docMouseUp = () => {
        if (dragStartLineRef.current != null) finishDrag();
      };
      document.addEventListener("mouseup", docMouseUp);

      const dispose = () => {
        cursorLineDispose.dispose();
        wrapper.removeEventListener("mousemove", onMouseMove, useCapture);
        wrapper.removeEventListener("mousedown", onWrapperMouseDown, useCapture);
        wrapper.removeEventListener("mouseup", onWrapperMouseUp, useCapture);
        document.removeEventListener("mouseup", docMouseUp);
        updateDragRangeDecoration(null, null);
        modifiedEditorRef.current = null;
        originalEditorRef.current = null;
        monacoRef.current = null;
        hoverDecorationIdsRef.current = [];
        highlightDecorationIdsRef.current = [];
        dragRangeDecorationIdsRef.current = [];
        collapsedIconDecorationIdsRef.current = [];
        updatePlusDecoration(null);
        setEditorReady(false);
      };
      editor.onDidDispose(dispose);
    },
    [updatePlusDecoration, updateDragRangeDecoration, languageProp]
  );

  const language = languageProp ?? getLanguageFromPath(filePath);

  const handleBeforeMount = useCallback((monaco: typeof Monaco) => {
    const m = monaco as typeof Monaco & {
      typescript?: { typescriptDefaults: { setDiagnosticsOptions: (o: object) => void }; javascriptDefaults: { setDiagnosticsOptions: (o: object) => void } };
      languages?: { typescript?: { typescriptDefaults: { setDiagnosticsOptions: (o: object) => void }; javascriptDefaults: { setDiagnosticsOptions: (o: object) => void } } };
    };
    const ts = m.typescript ?? m.languages?.typescript;
    if (ts) {
      const opts = { noSemanticValidation: true, noSyntaxValidation: true };
      ts.typescriptDefaults.setDiagnosticsOptions(opts);
      ts.javascriptDefaults.setDiagnosticsOptions(opts);
    }
    if (typeof document !== "undefined" && !document.getElementById("scrutiny-monaco-styles")) {
      const style = document.createElement("style");
      style.id = "scrutiny-monaco-styles";
      style.textContent = `
        .scrutiny-comment-plus::before {
          content: "+" !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          color: rgb(59 130 246) !important;
          cursor: pointer !important;
        }
        .vs-dark .scrutiny-comment-plus::before { color: rgb(96 165 250) !important; }
        .scrutiny-drag-range {
          background: rgba(59, 130, 246, 0.18) !important;
          border-left: 3px solid rgb(59, 130, 246) !important;
        }
        .scrutiny-feedback-line {
          background: rgba(59, 130, 246, 0.08) !important;
        }
        .vs-dark .scrutiny-drag-range {
          background: rgba(96, 165, 250, 0.22) !important;
          border-left-color: rgb(96, 165, 250) !important;
        }
        .vs-dark .scrutiny-feedback-line {
          background: rgba(96, 165, 250, 0.12) !important;
        }
        .view-zones .view-zone {
          z-index: 10;
          position: relative;
          pointer-events: auto;
        }
        /* Collapsed comment icon in gutter */
        .scrutiny-comment-icon::before {
          content: "💬" !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 12px !important;
          cursor: pointer !important;
        }
        .scrutiny-comment-submitted::before {
          filter: hue-rotate(0deg) saturate(1.2);
        }
        .scrutiny-comment-resolved::before {
          filter: hue-rotate(100deg) saturate(1.5);
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div ref={wrapperRef} className="relative min-h-0 flex-1">
      <DiffEditor
        height="100%"
        language={language}
        original={original}
        modified={modified}
        theme={theme}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          renderSideBySide,
          readOnly: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          hideUnchangedRegions: { enabled: true },
        }}
      />
    </div>
  );
}
