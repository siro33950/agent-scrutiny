import { useCallback, useState } from "react";

export interface DiffStat {
  additions: number;
  deletions: number;
}

export function useFiles() {
  const [files, setFiles] = useState<string[]>([]);
  const [modifiedSet, setModifiedSet] = useState<Set<string>>(new Set());
  const [untrackedSet, setUntrackedSet] = useState<Set<string>>(new Set());
  const [diffStats, setDiffStats] = useState<Record<string, DiffStat>>({});
  const [changeTypes, setChangeTypes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async (effectiveTarget: string, diffBase: string) => {
    if (!effectiveTarget) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/files?target=${encodeURIComponent(effectiveTarget)}&base=${encodeURIComponent(diffBase)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ファイル一覧の取得に失敗しました");
        setFiles([]);
        setModifiedSet(new Set());
        setUntrackedSet(new Set());
        setDiffStats({});
        setChangeTypes({});
        return;
      }
      const list = Array.isArray(data.files) ? data.files : [];
      const mod = Array.isArray(data.modified) ? data.modified : [];
      const untracked = Array.isArray(data.untracked) ? data.untracked : [];
      setFiles(list);
      setModifiedSet(new Set(mod));
      setUntrackedSet(new Set(untracked));
      setDiffStats(data.diffStats && typeof data.diffStats === "object" ? data.diffStats : {});
      setChangeTypes(data.changeTypes && typeof data.changeTypes === "object" ? data.changeTypes : {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "不明なエラー");
      setFiles([]);
      setModifiedSet(new Set());
      setUntrackedSet(new Set());
      setDiffStats({});
      setChangeTypes({});
    } finally {
      setLoading(false);
    }
  }, []);

  return { files, modifiedSet, untrackedSet, diffStats, changeTypes, loading, error, setError, fetchFiles };
}
