import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY_TABS = "agent-scrutiny-tabs";
const STORAGE_KEY_ACTIVE_TAB = "agent-scrutiny-active-tab";

function loadTabsFromStorage(): { tabs: string[]; activeIndex: number } {
  if (typeof window === "undefined") return { tabs: [], activeIndex: 0 };
  try {
    const tabs = JSON.parse(localStorage.getItem(STORAGE_KEY_TABS) ?? "[]");
    const activeIndex = parseInt(localStorage.getItem(STORAGE_KEY_ACTIVE_TAB) ?? "0", 10);
    return { tabs: Array.isArray(tabs) ? tabs : [], activeIndex: isNaN(activeIndex) ? 0 : activeIndex };
  } catch {
    return { tabs: [], activeIndex: 0 };
  }
}

export function useTabs() {
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const { tabs, activeIndex } = loadTabsFromStorage();
    if (tabs.length > 0) {
      setOpenTabs(tabs);
      setActiveTabIndex(Math.min(activeIndex, tabs.length - 1));
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(openTabs));
    localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, String(activeTabIndex));
  }, [openTabs, activeTabIndex, initialized]);

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
