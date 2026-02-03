"use client";

import { useEffect, useRef, useState } from "react";
import { ActionMenu } from "./ActionMenu";

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
}

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
    </header>
  );
}
