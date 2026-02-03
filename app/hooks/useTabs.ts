import { useCallback, useState } from "react";

export function useTabs() {
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const selectFile = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const idx = prev.indexOf(path);
      if (idx >= 0) {
        setActiveTabIndex(idx);
        return prev;
      }
      const newIndex = prev.length;
      setActiveTabIndex(newIndex);
      return [...prev, path];
    });
  }, []);

  const closeTab = useCallback((index: number) => {
    setOpenTabs((prev) => {
      const newTabs = prev.filter((_, idx) => idx !== index);
      setActiveTabIndex((current) => {
        if (index < current) return current - 1;
        if (index === current) return Math.min(current, newTabs.length - 1);
        return current;
      });
      return newTabs;
    });
  }, []);

  const clearTabs = useCallback(() => {
    setOpenTabs([]);
    setActiveTabIndex(0);
  }, []);

  return { openTabs, activeTabIndex, setActiveTabIndex, selectFile, closeTab, clearTabs };
}
