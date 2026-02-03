"use client";

import { useEffect, useRef, useState } from "react";
import { ActionMenu } from "./ActionMenu";
import type { ThemeMode } from "@/app/hooks/useTheme";

interface HeaderProps {
  targets: string[];
  effectiveTarget: string;
  onSelectTarget: (target: string) => void;
  diffBase: string;
  onSelectDiffBase: (base: string) => void;
  branches: string[];
  actionType: "submit" | "approve";
  onActionTypeChange: (type: "submit" | "approve") => void;
  onAction: () => Promise<void>;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}

const ThemeIcon = ({ mode }: { mode: ThemeMode }) => {
  if (mode === "light") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    );
  }
  if (mode === "dark") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
};

export function Header({
  targets,
  effectiveTarget,
  onSelectTarget,
  diffBase,
  onSelectDiffBase,
  branches,
  actionType,
  onActionTypeChange,
  onAction,
  themeMode,
  onThemeModeChange,
}: HeaderProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!actionMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [actionMenuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-full items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {targets.length > 0 && (
            <select
              value={effectiveTarget}
              onChange={(e) => onSelectTarget(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
              aria-label="ルート（target）を選択"
            >
              {targets.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
          <select
            value={diffBase}
            onChange={(e) => onSelectDiffBase(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            aria-label="base を選択"
          >
            <option value="HEAD">HEAD</option>
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const modes: ThemeMode[] = ["system", "light", "dark"];
              const idx = modes.indexOf(themeMode);
              onThemeModeChange(modes[(idx + 1) % modes.length]);
            }}
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title={`テーマ: ${themeMode === "system" ? "システム" : themeMode === "light" ? "ライト" : "ダーク"}`}
            aria-label="テーマを切り替え"
          >
            <ThemeIcon mode={themeMode} />
          </button>
          <div className="relative flex" ref={actionMenuRef}>
            <button
              type="button"
              onClick={onAction}
              className={`rounded-l-md border-r border-white/20 px-3 py-1.5 text-sm font-medium text-white ${
                actionType === "submit"
                  ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                  : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
              }`}
            >
              {actionType === "submit" ? "Submit" : "Approve"}
            </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActionMenuOpen((prev) => !prev);
            }}
            className={`rounded-r-md px-2 py-1.5 text-white ${
              actionType === "submit"
                ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
            }`}
            aria-expanded={actionMenuOpen}
            aria-haspopup="true"
            aria-label="アクションを切り替え"
          >
            <span className="text-[10px] leading-none" aria-hidden>▼</span>
          </button>
          {actionMenuOpen && (
            <ActionMenu
              actionType={actionType}
              onSelect={(type) => {
                onActionTypeChange(type);
                setActionMenuOpen(false);
              }}
            />
          )}
          </div>
        </div>
      </div>
    </header>
  );
}
