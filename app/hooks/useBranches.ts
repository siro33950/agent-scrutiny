import { useEffect, useState } from "react";

export function useBranches(effectiveTarget: string) {
  const [branches, setBranches] = useState<string[]>([]);

  useEffect(() => {
    if (!effectiveTarget) return;
    fetch(`/api/refs?target=${encodeURIComponent(effectiveTarget)}`)
      .then((res) => (res.ok ? res.json() : { branches: [] }))
      .then((data: { branches?: string[] }) => {
        setBranches(Array.isArray(data.branches) ? data.branches : []);
      })
      .catch(() => setBranches([]));
  }, [effectiveTarget]);

  return { branches };
}
