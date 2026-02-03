import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "agent-scrutiny-expanded-folders";

function loadFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(data) ? data : []);
  } catch {
    return new Set();
  }
}

export function useExpandedFolders() {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const saved = loadFromStorage();
    if (saved.size > 0) {
      setExpandedFolders(saved);
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expandedFolders)));
  }, [expandedFolders, initialized]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback((paths: string[]) => {
    setExpandedFolders(new Set(paths));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  const reset = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  return { expandedFolders, setExpandedFolders, toggleFolder, expandAll, collapseAll, reset };
}
