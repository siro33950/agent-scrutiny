interface BannerProps {
  error: string | null;
  submitStatus: "idle" | "success" | "error";
  submitMessage: string;
  onDismiss: (type: string) => void;
}

export function Banner({ error, submitStatus, submitMessage, onDismiss }: BannerProps) {
  return (
    <div className="border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      {error && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => onDismiss("error")}
            className="shrink-0 rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      )}
      {!error && submitStatus === "success" && submitMessage && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          <span>{submitMessage}</span>
          <button
            type="button"
            onClick={() => onDismiss("success")}
            className="shrink-0 rounded p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      )}
      {!error && submitStatus === "error" && submitMessage && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          <span>{submitMessage}</span>
          <button
            type="button"
            onClick={() => onDismiss("error")}
            className="shrink-0 rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/50"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
