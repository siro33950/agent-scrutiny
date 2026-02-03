"use client";

import { DiffEditor, Editor } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { diffLines } from "diff";
import type { FeedbackItem } from "@/lib/feedback";
import type { ViewMode } from "@/app/types";
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

/**
 * 変更行を検出する
 * diffライブラリを使用して行単位の差分を計算し、
 * 変更・追加された行のみを正確に特定する
 */
function getChangedLines(original: string, modified: string): Set<number> {
  const changedLines = new Set<number>();
  const diff = diffLines(original, modified);

  let modifiedLineNum = 0;
  for (const part of diff) {
    const lineCount = part.count ?? 0;
    if (part.added) {
      for (let i = 0; i < lineCount; i++) {
        modifiedLineNum++;
        changedLines.add(modifiedLineNum);
      }
    } else if (!part.removed) {
      modifiedLineNum += lineCount;
    }
  }
  return changedLines;
}

export interface MonacoDiffViewerProps {
  original: string;
  modified: string;
  filePath: string;
  language?: string;
  theme?: "light" | "vs-dark";
  highlightLineIds?: string[];
  viewMode?: ViewMode;
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
  viewMode = "inline",
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

  // viewMode 変更時に editorReady をリセット（新しい editor がマウントされるまで待機させる）
  useEffect(() => {
    setEditorReady(false);
  }, [viewMode]);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const diffEditorRef = useRef<Monaco.editor.IDiffEditor | null>(null);
  const modifiedEditorRef = useRef<Monaco.editor.ICodeEditor | null>(null);
  const originalEditorRef = useRef<Monaco.editor.ICodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const highlightDecorationIdsRef = useRef<string[]>([]);
  const rangeHighlightDecorationIdsRef = useRef<string[]>([]);
  const collapsedIconDecorationIdsRef = useRef<string[]>([]);
  const rangeStartLineRef = useRef<number | null>(null);
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
  const prevCreatingAtLineRef = useRef<number | null | undefined>(undefined);
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

  const updateRangeHighlight = useCallback(
    (startLine: number | null, endLine: number | null) => {
      const editor = modifiedEditorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco) return;
      if (startLine == null) {
        const nextIds = editor.deltaDecorations(
          rangeHighlightDecorationIdsRef.current,
          []
        );
        rangeHighlightDecorationIdsRef.current = nextIds;
        return;
      }
      const s = Math.min(startLine, endLine ?? startLine);
      const e = Math.max(startLine, endLine ?? startLine);
      const newDecos = [];
      for (let line = s; line <= e; line++) {
        newDecos.push({
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "scrutiny-range-highlight",
            linesDecorationsClassName: "scrutiny-range-line-decoration",
          },
        });
      }
      const nextIds = editor.deltaDecorations(
        rangeHighlightDecorationIdsRef.current,
        newDecos
      );
      rangeHighlightDecorationIdsRef.current = nextIds;
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
      options: { linesDecorationsClassName: "scrutiny-feedback-line-decoration" },
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
    const diffEditor = diffEditorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !editorReady) return;

    // hideUnchangedRegions の変更が必要かどうかを判定
    const shouldDisableHideUnchanged = diffEditor && viewMode !== "latest" && creatingAtLine != null;
    const shouldEnableHideUnchanged = diffEditor && viewMode !== "latest" && creatingAtLine == null;

    // ViewZone構築ロジックを関数化
    const buildViewZones = () => {
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
      // shouldAutoFocus: creatingAtLine が新しく設定された時のみ true
      const shouldAutoFocus = creatingAtLine != null && prevCreatingAtLineRef.current == null;
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
                shouldAutoFocus={shouldAutoFocus}
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
      // prevCreatingAtLineRef を更新
      prevCreatingAtLineRef.current = creatingAtLine;

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
    };

    // クリーンアップ関数
    const cleanup = () => {
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
      // hideUnchangedRegions を再有効化
      if (diffEditorRef.current && viewMode !== "latest") {
        diffEditorRef.current.updateOptions({
          hideUnchangedRegions: { enabled: true },
        });
      }
    };

    // hideUnchangedRegions を変更する場合は、変更後に1フレーム待機してからViewZoneを構築
    if (shouldDisableHideUnchanged || shouldEnableHideUnchanged) {
      diffEditor!.updateOptions({
        hideUnchangedRegions: { enabled: creatingAtLine == null },
      });

      // Monacoのビュー再構築完了を待ってからViewZoneを構築
      const rafId = requestAnimationFrame(() => {
        buildViewZones();

        // コメント作成対象行を表示領域内に収める
        if (creatingAtLine != null) {
          editor.revealLineInCenter(creatingAtLine);
        }
      });

      return () => {
        cancelAnimationFrame(rafId);
        cleanup();
      };
    } else {
      // hideUnchangedRegions の変更が不要な場合は即座にViewZoneを構築
      buildViewZones();
      return cleanup;
    }
  }, [feedbackItems, resolvedItems, editorReady, creatingAtLine, creatingAtLineEnd, collapsedIdsKey, viewMode]);

  const handleMount = useCallback(
    (editor: Monaco.editor.IDiffEditor, monaco: typeof Monaco) => {
      diffEditorRef.current = editor;
      const originalEditor = editor.getOriginalEditor();
      const modifiedEditor = editor.getModifiedEditor();
      modifiedEditorRef.current = modifiedEditor;
      originalEditorRef.current = originalEditor;
      monacoRef.current = monaco;
      setEditorReady(true);

      originalEditor.updateOptions({ readOnly: true });
      modifiedEditor.updateOptions({ readOnly: true, glyphMargin: true });

      const cursorLineDispose = modifiedEditor.onDidChangeCursorPosition((e) => {
        onCursorLineChangedRef.current?.(e.position.lineNumber);
      });

      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      // 行番号ドラッグで範囲選択コメント追加
      // DOMレベルのmousemoveリスナー参照（cleanup用）
      let onDocumentMouseMove: ((e: MouseEvent) => void) | null = null;
      let onDocumentMouseUp: ((e: MouseEvent) => void) | null = null;

      const mouseDownDispose = modifiedEditor.onMouseDown((e) => {
        if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
          const lineNumber = e.target.position?.lineNumber;
          if (!lineNumber) return;
          rangeStartLineRef.current = lineNumber;
          updateRangeHighlight(lineNumber, lineNumber);

          // DOMレベルでmousemoveを監視（ドラッグ中も検知するため）
          onDocumentMouseMove = (moveEvent: MouseEvent) => {
            if (rangeStartLineRef.current == null) return;
            const target = modifiedEditor.getTargetAtClientPoint(moveEvent.clientX, moveEvent.clientY);
            const line = target?.position?.lineNumber;
            if (line) {
              updateRangeHighlight(rangeStartLineRef.current, line);
            }
          };

          onDocumentMouseUp = (upEvent: MouseEvent) => {
            document.removeEventListener("mousemove", onDocumentMouseMove!);
            document.removeEventListener("mouseup", onDocumentMouseUp!);
            onDocumentMouseMove = null;
            onDocumentMouseUp = null;

            const startLine = rangeStartLineRef.current;
            if (startLine == null) return;

            const target = modifiedEditor.getTargetAtClientPoint(upEvent.clientX, upEvent.clientY);
            const endLine = target?.position?.lineNumber ?? startLine;

            const s = Math.min(startLine, endLine);
            const eEnd = Math.max(startLine, endLine);

            updateRangeHighlight(null, null);
            rangeStartLineRef.current = null;

            onCreateAtLineRef.current?.(filePathRef.current, s, s === eEnd ? undefined : eEnd);
          };

          document.addEventListener("mousemove", onDocumentMouseMove);
          document.addEventListener("mouseup", onDocumentMouseUp);
        }
      });

      // 折りたたまれたコメントアイコンをクリックした場合
      const onWrapperMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!wrapper.contains(target)) return;

        const isCommentIcon = target.closest?.(".scrutiny-comment-icon") != null;
        if (isCommentIcon) {
          const modified = modifiedEditorRef.current?.getTargetAtClientPoint(e.clientX, e.clientY);
          if (modified?.position) {
            const lineNumber = modified.position.lineNumber;
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
      };

      const useCapture = true;
      wrapper.addEventListener("mousedown", onWrapperMouseDown, useCapture);

      const dispose = () => {
        cursorLineDispose.dispose();
        mouseDownDispose.dispose();
        // DOMイベントリスナーのクリーンアップ
        if (onDocumentMouseMove) {
          document.removeEventListener("mousemove", onDocumentMouseMove);
        }
        if (onDocumentMouseUp) {
          document.removeEventListener("mouseup", onDocumentMouseUp);
        }
        wrapper.removeEventListener("mousedown", onWrapperMouseDown, useCapture);
        updateRangeHighlight(null, null);
        rangeStartLineRef.current = null;
        diffEditorRef.current = null;
        modifiedEditorRef.current = null;
        originalEditorRef.current = null;
        monacoRef.current = null;
        highlightDecorationIdsRef.current = [];
        rangeHighlightDecorationIdsRef.current = [];
        collapsedIconDecorationIdsRef.current = [];
        setEditorReady(false);
      };
      editor.onDidDispose(dispose);
    },
    [updateRangeHighlight]
  );

  const language = languageProp ?? getLanguageFromPath(filePath);

  // 変更行を計算（latestモード用）
  const changedLines = useMemo(() => getChangedLines(original, modified), [original, modified]);

  // Latestモード用のmount handler
  const handleLatestMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      modifiedEditorRef.current = editor;
      monacoRef.current = monaco;
      setEditorReady(true);

      editor.updateOptions({ readOnly: true, glyphMargin: true });

      // 変更行のデコレーションを適用
      const decos: Monaco.editor.IModelDeltaDecoration[] = [];
      for (const lineNumber of changedLines) {
        decos.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: { linesDecorationsClassName: "scrutiny-changed-line-decoration" },
        });
      }
      const ids = editor.deltaDecorations([], decos);
      highlightDecorationIdsRef.current = ids;

      const cursorLineDispose = editor.onDidChangeCursorPosition((e) => {
        onCursorLineChangedRef.current?.(e.position.lineNumber);
      });

      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      // 行番号ドラッグで範囲選択コメント追加
      // DOMレベルのmousemoveリスナー参照（cleanup用）
      let onDocumentMouseMove: ((e: MouseEvent) => void) | null = null;
      let onDocumentMouseUp: ((e: MouseEvent) => void) | null = null;

      const mouseDownDispose = editor.onMouseDown((e) => {
        if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
          const lineNumber = e.target.position?.lineNumber;
          if (!lineNumber) return;
          rangeStartLineRef.current = lineNumber;
          updateRangeHighlight(lineNumber, lineNumber);

          // DOMレベルでmousemoveを監視（ドラッグ中も検知するため）
          onDocumentMouseMove = (moveEvent: MouseEvent) => {
            if (rangeStartLineRef.current == null) return;
            const target = editor.getTargetAtClientPoint(moveEvent.clientX, moveEvent.clientY);
            const line = target?.position?.lineNumber;
            if (line) {
              updateRangeHighlight(rangeStartLineRef.current, line);
            }
          };

          onDocumentMouseUp = (upEvent: MouseEvent) => {
            document.removeEventListener("mousemove", onDocumentMouseMove!);
            document.removeEventListener("mouseup", onDocumentMouseUp!);
            onDocumentMouseMove = null;
            onDocumentMouseUp = null;

            const startLine = rangeStartLineRef.current;
            if (startLine == null) return;

            const target = editor.getTargetAtClientPoint(upEvent.clientX, upEvent.clientY);
            const endLine = target?.position?.lineNumber ?? startLine;

            const s = Math.min(startLine, endLine);
            const eEnd = Math.max(startLine, endLine);

            updateRangeHighlight(null, null);
            rangeStartLineRef.current = null;

            onCreateAtLineRef.current?.(filePathRef.current, s, s === eEnd ? undefined : eEnd);
          };

          document.addEventListener("mousemove", onDocumentMouseMove);
          document.addEventListener("mouseup", onDocumentMouseUp);
        }
      });

      // 折りたたまれたコメントアイコンをクリックした場合
      const onWrapperMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!wrapper.contains(target)) return;

        const isCommentIcon = target.closest?.(".scrutiny-comment-icon") != null;
        if (isCommentIcon) {
          const position = editor.getTargetAtClientPoint(e.clientX, e.clientY);
          if (position?.position) {
            const lineNumber = position.position.lineNumber;
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
      };

      const useCapture = true;
      wrapper.addEventListener("mousedown", onWrapperMouseDown, useCapture);

      return () => {
        cursorLineDispose.dispose();
        mouseDownDispose.dispose();
        // DOMイベントリスナーのクリーンアップ
        if (onDocumentMouseMove) {
          document.removeEventListener("mousemove", onDocumentMouseMove);
        }
        if (onDocumentMouseUp) {
          document.removeEventListener("mouseup", onDocumentMouseUp);
        }
        wrapper.removeEventListener("mousedown", onWrapperMouseDown, useCapture);
        updateRangeHighlight(null, null);
        rangeStartLineRef.current = null;
        modifiedEditorRef.current = null;
        monacoRef.current = null;
        highlightDecorationIdsRef.current = [];
        rangeHighlightDecorationIdsRef.current = [];
        collapsedIconDecorationIdsRef.current = [];
        setEditorReady(false);
      };
    },
    [updateRangeHighlight, changedLines]
  );

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
        /* 行番号クリック時のハイライト */
        .scrutiny-range-highlight {
          background: rgba(59, 130, 246, 0.18) !important;
        }
        .vs-dark .scrutiny-range-highlight {
          background: rgba(96, 165, 250, 0.22) !important;
        }
        /* 範囲選択時の縦線（linesDecorationsClassName用） */
        .scrutiny-range-line-decoration {
          background: rgb(59, 130, 246) !important;
          width: 3px !important;
          margin-left: 3px;
        }
        .vs-dark .scrutiny-range-line-decoration {
          background: rgb(96, 165, 250) !important;
        }
        /* フィードバック対象行の縦線ハイライト（展開時） */
        .scrutiny-feedback-line-decoration {
          background: rgb(59, 130, 246) !important;
          width: 3px !important;
          margin-left: 3px;
        }
        .vs-dark .scrutiny-feedback-line-decoration {
          background: rgb(96, 165, 250) !important;
        }
        /* ViewZone のスタイル */
        .view-zones .view-zone {
          z-index: 10;
          position: relative;
          pointer-events: auto;
        }
        /* 行番号のクリック可能なスタイル */
        .monaco-editor .margin-view-overlays .line-numbers {
          cursor: pointer !important;
        }
        /* 折りたたまれたコメントアイコン */
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
        /* Latest モードの変更行ハイライト */
        .scrutiny-changed-line-decoration {
          background: #22c55e !important;
          width: 3px !important;
          margin-left: 3px !important;
        }
        .vs-dark .scrutiny-changed-line-decoration {
          background: #4ade80 !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // viewModeに応じてrenderSideBySideを決定
  const renderSideBySide = viewMode === "sideBySide";

  return (
    <div ref={wrapperRef} className="relative min-h-0 flex-1">
      {viewMode === "latest" ? (
        <Editor
          key={`editor-${viewMode}`}
          height="100%"
          language={language}
          value={modified}
          theme={theme}
          beforeMount={handleBeforeMount}
          onMount={handleLatestMount}
          options={{
            readOnly: true,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            glyphMargin: true,
          }}
        />
      ) : (
        <DiffEditor
          key={`diff-${viewMode}`}
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
      )}
    </div>
  );
}
