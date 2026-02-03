export const STATUS_CONFIG = {
  draft: {
    label: "下書き",
    border: "border-l-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  submitted: {
    label: "送信済",
    border: "border-l-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  resolved: {
    label: "完了",
    border: "border-l-green-500",
    bg: "bg-green-50 dark:bg-green-950",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    text: "text-green-600 dark:text-green-400",
    dot: "bg-green-500",
  },
} as const;

export type FeedbackStatus = keyof typeof STATUS_CONFIG;
