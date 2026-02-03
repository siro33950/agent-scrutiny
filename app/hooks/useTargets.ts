import { useEffect, useState } from "react";

export function useTargets() {
  const [targets, setTargets] = useState<string[]>([]);
  const [defaultTarget, setDefaultTarget] = useState<string>("");
  const [selectedTarget, setSelectedTarget] = useState<string>("");

  useEffect(() => {
    fetch("/api/targets")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { targets?: string[]; defaultTarget?: string }) => {
        const list = Array.isArray(data.targets) ? data.targets : [];
        const def = typeof data.defaultTarget === "string" ? data.defaultTarget : (list[0] ?? "default");
        setTargets(list);
        setDefaultTarget(def);
        setSelectedTarget((prev) => (prev === "" ? def : prev));
      })
      .catch((e) => {
        console.error(e);
        setTargets([]);
        setDefaultTarget("default");
        setSelectedTarget((prev) => (prev === "" ? "default" : prev));
      });
  }, []);

  const effectiveTarget = selectedTarget || defaultTarget;

  return { targets, defaultTarget, selectedTarget, setSelectedTarget, effectiveTarget };
}
