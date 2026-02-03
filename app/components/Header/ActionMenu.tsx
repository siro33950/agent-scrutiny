interface ActionMenuProps {
  actionType: "submit" | "approve";
  onSelect: (type: "submit" | "approve") => void;
}

export function ActionMenu({ actionType, onSelect }: ActionMenuProps) {
  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 min-w-[280px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => onSelect("submit")}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
          actionType === "submit" ? "bg-zinc-50 dark:bg-zinc-700/50" : ""
        }`}
      >
        <span className="mt-0.5 w-4 shrink-0 text-center text-emerald-600 dark:text-emerald-400" aria-hidden>
          {actionType === "submit" ? "✓" : ""}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Submit</div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Feedbackをエージェントに送信し、対応を依頼します。
          </div>
        </div>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onSelect("approve")}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
          actionType === "approve" ? "bg-zinc-50 dark:bg-zinc-700/50" : ""
        }`}
      >
        <span className="mt-0.5 w-4 shrink-0 text-center text-blue-600 dark:text-blue-400" aria-hidden>
          {actionType === "approve" ? "✓" : ""}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Approve</div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            現在の変更をコミットするようエージェントに依頼します。
          </div>
        </div>
      </button>
    </div>
  );
}
