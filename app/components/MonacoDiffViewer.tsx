"use client";

import { DiffEditor } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useCallback, useEffect, useRef, useState } from "react";

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
  onSelectLines?: (filePath: string, lineNumber: number, lineNumberEnd?: number) => void;
  highlightLineIds?: string[];
}

export function MonacoDiffViewer({
  original,
  modified,
  filePath,
  language: languageProp,
  theme = "light",
  onSelectLines,
  highlightLineIds,
}: MonacoDiffViewerProps) {
  const [editorReady, setEditorReady] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const modifiedEditorRef = useRef<Monaco.editor.ICodeEditor | null>(null);
  const originalEditorRef = useRef<Monaco.editor.ICodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const hoverDecorationIdsRef = useRef<string[]>([]);
  const highlightDecorationIdsRef = useRef<string[]>([]);
  const dragRangeDecorationIdsRef = useRef<string[]>([]);
  const dragStartLineRef = useRef<number | null>(null);
  const dragEndLineRef = useRef<number | null>(null);
  const onSelectLinesRef = useRef(onSelectLines);
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;
  onSelectLinesRef.current = onSelectLines;

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

      const onWrapperMouseMove = (e: MouseEvent) => {
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
        onSelectLinesRef.current?.(filePathRef.current, s, s === e ? undefined : e);
      };

      const onWrapperMouseUp = () => {
        finishDrag();
      };

      const onWrapperMouseLeave = () => {};

      const useCapture = true;
      wrapper.addEventListener("mousemove", onWrapperMouseMove, useCapture);
      wrapper.addEventListener("mousedown", onWrapperMouseDown, useCapture);
      wrapper.addEventListener("mouseup", onWrapperMouseUp, useCapture);
      wrapper.addEventListener("mouseleave", onWrapperMouseLeave, useCapture);

      const docMouseUp = () => {
        if (dragStartLineRef.current != null) finishDrag();
      };
      document.addEventListener("mouseup", docMouseUp);

      const dispose = () => {
        cursorLineDispose.dispose();
        wrapper.removeEventListener("mousemove", onWrapperMouseMove, useCapture);
        wrapper.removeEventListener("mousedown", onWrapperMouseDown, useCapture);
        wrapper.removeEventListener("mouseup", onWrapperMouseUp, useCapture);
        wrapper.removeEventListener("mouseleave", onWrapperMouseLeave, useCapture);
        document.removeEventListener("mouseup", docMouseUp);
        updateDragRangeDecoration(null, null);
        modifiedEditorRef.current = null;
        originalEditorRef.current = null;
        monacoRef.current = null;
        hoverDecorationIdsRef.current = [];
        highlightDecorationIdsRef.current = [];
        dragRangeDecorationIdsRef.current = [];
        updatePlusDecoration(null);
        setEditorReady(false);
      };
      editor.onDidDispose(dispose);
    },
    [updatePlusDecoration, updateDragRangeDecoration]
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
    // Ensure glyph "+" style applies inside Monaco (same document)
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
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div ref={wrapperRef} className="min-h-0 flex-1">
      <DiffEditor
        height="100%"
        language={language}
        original={original}
        modified={modified}
        theme={theme}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          renderSideBySide: false,
          readOnly: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
