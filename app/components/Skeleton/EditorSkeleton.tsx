"use client";

export function EditorSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-label="読み込み中">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-2 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-7 w-7 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-7 w-7 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-zinc-50 p-4 dark:bg-zinc-900">
        <div className="flex flex-col gap-2">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-8 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div
                className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700"
                style={{ width: `${100 + (i % 5) * 40 + Math.sin(i) * 30}px` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
