import { useCallback, useState } from "react";
import type { FeedbackItem } from "@/lib/feedback";

interface InlineCommentState {
  creatingAt: { filePath: string; lineNumber: number; lineNumberEnd?: number } | null;
  saving: boolean;
}

export function useInlineComment(
  effectiveTarget: string,
  fetchFeedback: () => Promise<void>,
  setError: (msg: string) => void
) {
  const [state, setState] = useState<InlineCommentState>({
    creatingAt: null,
    saving: false,
  });

  const startCreate = useCallback(
    (filePath: string, lineNumber: number, lineNumberEnd?: number) => {
      setState({
        creatingAt: { filePath, lineNumber, lineNumberEnd },
        saving: false,
      });
    },
    []
  );

  const save = useCallback(
    async (
      filePath: string,
      lineNumber: number,
      lineNumberEnd: number | undefined,
      comment: string
    ) => {
      setState((prev) => ({ ...prev, saving: true }));
      try {
        const body: Record<string, string | number | boolean> = {
          file_path: filePath,
          line_number: lineNumber,
          comment,
          target: effectiveTarget,
        };
        if (lineNumber === 0) {
          body.whole_file = true;
        } else if (lineNumberEnd !== undefined) {
          body.line_number_end = lineNumberEnd;
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
        setState({ creatingAt: null, saving: false });
      } catch (e) {
        setError(e instanceof Error ? e.message : "不明なエラー");
        setState((prev) => ({ ...prev, saving: false }));
      }
    },
    [effectiveTarget, fetchFeedback, setError]
  );

  const resolve = useCallback(
    async (item: FeedbackItem) => {
      setState((prev) => ({ ...prev, saving: true }));
      try {
        const body = {
          resolve: true,
          target: effectiveTarget,
          file_path: item.file_path,
          line_number: item.line_number,
          comment: item.comment,
          ...(item.line_number_end !== undefined
            ? { line_number_end: item.line_number_end }
            : {}),
          ...(item.whole_file ? { whole_file: true } : {}),
        };
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Resolve に失敗しました");
        }
        await fetchFeedback();
        setState({ creatingAt: null, saving: false });
      } catch (e) {
        setError(e instanceof Error ? e.message : "不明なエラー");
        setState((prev) => ({ ...prev, saving: false }));
      }
    },
    [effectiveTarget, fetchFeedback, setError]
  );

  const deleteItem = useCallback(
    async (item: FeedbackItem) => {
      setState((prev) => ({ ...prev, saving: true }));
      try {
        const body = {
          delete: true,
          target: effectiveTarget,
          file_path: item.file_path,
          line_number: item.line_number,
          comment: item.comment,
          ...(item.line_number_end !== undefined
            ? { line_number_end: item.line_number_end }
            : {}),
          ...(item.whole_file ? { whole_file: true } : {}),
        };
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "削除に失敗しました");
        }
        await fetchFeedback();
        setState({ creatingAt: null, saving: false });
      } catch (e) {
        setError(e instanceof Error ? e.message : "不明なエラー");
        setState((prev) => ({ ...prev, saving: false }));
      }
    },
    [effectiveTarget, fetchFeedback, setError]
  );

  const unresolve = useCallback(
    async (item: FeedbackItem) => {
      setState((prev) => ({ ...prev, saving: true }));
      try {
        const body = {
          unresolve: true,
          target: effectiveTarget,
          file_path: item.file_path,
          line_number: item.line_number,
          comment: item.comment,
          ...(item.line_number_end !== undefined
            ? { line_number_end: item.line_number_end }
            : {}),
          ...(item.whole_file ? { whole_file: true } : {}),
        };
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "再開に失敗しました");
        }
        await fetchFeedback();
        setState({ creatingAt: null, saving: false });
      } catch (e) {
        setError(e instanceof Error ? e.message : "不明なエラー");
        setState((prev) => ({ ...prev, saving: false }));
      }
    },
    [effectiveTarget, fetchFeedback, setError]
  );

  const cancel = useCallback(() => {
    setState({ creatingAt: null, saving: false });
  }, []);

  return { state, startCreate, save, resolve, deleteItem, unresolve, cancel };
}
