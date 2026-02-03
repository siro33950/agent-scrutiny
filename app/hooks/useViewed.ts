import { useCallback, useState, useEffect } from "react";

const STORAGE_KEY = "scrutiny-viewed-files";

function loadViewed(target: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${target}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveViewed(target: string, viewed: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY}:${target}`, JSON.stringify([...viewed]));
  } catch {
    // ignore
  }
}

export function useViewed(effectiveTarget: string) {
  const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    setViewedFiles(loadViewed(effectiveTarget));
  }, [effectiveTarget]);

  const toggleViewed = useCallback(
    (path: string) => {
      setViewedFiles((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        saveViewed(effectiveTarget, next);
        return next;
      });
    },
    [effectiveTarget]
  );

  const markViewed = useCallback(
    (path: string) => {
      setViewedFiles((prev) => {
        if (prev.has(path)) return prev;
        const next = new Set(prev);
        next.add(path);
        saveViewed(effectiveTarget, next);
        return next;
      });
    },
    [effectiveTarget]
  );

  return { viewedFiles, toggleViewed, markViewed };
}
