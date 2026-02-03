"use client";

export function FileTreeSkeleton() {
  return (
    <aside
      className="flex min-h-0 w-[260px] shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="読み込み中"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex shrink-0 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex-1 px-2 py-1.5">
              <div className="mx-auto h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <div className="flex-1 px-2 py-1.5">
              <div className="mx-auto h-4 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
            <div className="flex gap-1">
              <div className="h-6 w-6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-6 w-6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-6 w-6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto py-2 px-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="mb-2 flex items-center gap-2 py-1">
                <div className="h-4 w-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                <div
                  className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700"
                  style={{ width: `${60 + (i % 4) * 20}px` }}
                />
              </div>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
