import { useCallback, useEffect, useRef, useState } from "react";

export function useFileContent(
  openTabs: string[],
  activeTabIndex: number,
  effectiveTarget: string,
  diffBase: string
) {
  const [fileContentCache, setFileContentCache] = useState<
    Record<string, { oldContent: string; newContent: string }>
  >({});
  const fetchingPathsRef = useRef<Set<string>>(new Set());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const prevRefreshTriggerRef = useRef(0);

  const clearCache = useCallback(() => {
    setFileContentCache({});
    fetchingPathsRef.current = new Set();
  }, []);

  const refreshOpenTabs = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const activePath = openTabs[activeTabIndex];
    // refreshTriggerが変わったときのみ開いているタブをすべて再フェッチ
    const shouldRefreshAll = refreshTrigger !== prevRefreshTriggerRef.current;
    prevRefreshTriggerRef.current = refreshTrigger;
    const pathsToRefresh = shouldRefreshAll ? openTabs : [];
    const toFetch = [
      ...new Set(
        [activePath, ...pathsToRefresh, ...openTabs.filter((path) => !(path in fileContentCache))].filter(Boolean)
      ),
    ].filter((path) => !fetchingPathsRef.current.has(path));
    if (toFetch.length === 0) return;
    const aborted = new Set<string>();
    toFetch.forEach((path) => fetchingPathsRef.current.add(path));
    toFetch.forEach((path) => {
      const params = new URLSearchParams();
      params.set("path", path);
      if (effectiveTarget) params.set("target", effectiveTarget);
      params.set("base", diffBase);
      const url = `/api/file-content?${params.toString()}`;
      fetch(url)
        .then((res) => res.json())
        .then((data: { oldContent?: string; newContent?: string }) => {
          fetchingPathsRef.current.delete(path);
          if (aborted.has(path)) return;
          const oldVal = data.oldContent ?? "";
          const newVal = data.newContent ?? "";
          setFileContentCache((prev) => {
            if (prev[path]?.oldContent === oldVal && prev[path]?.newContent === newVal) return prev;
            return { ...prev, [path]: { oldContent: oldVal, newContent: newVal } };
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
    });
    return () => {
      for (const p of toFetch) {
        aborted.add(p);
      }
    };
  }, [openTabs, activeTabIndex, fileContentCache, effectiveTarget, diffBase, refreshTrigger]);

  return { fileContentCache, clearCache, refreshOpenTabs };
}
