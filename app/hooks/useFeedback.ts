import { useCallback, useEffect, useState } from "react";
import type { FeedbackItem } from "@/lib/feedback";

export function useFeedback(effectiveTarget: string) {
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [resolvedItems, setResolvedItems] = useState<FeedbackItem[]>([]);

  const fetchFeedback = useCallback(async () => {
    if (!effectiveTarget) return;
    try {
      const res = await fetch(
        `/api/feedback?target=${encodeURIComponent(effectiveTarget)}`
      );
      const data = await res.json();
      setFeedbackItems(Array.isArray(data?.items) ? data.items : []);
      setResolvedItems(Array.isArray(data?.resolved) ? data.resolved : []);
    } catch {
      setFeedbackItems([]);
      setResolvedItems([]);
    }
  }, [effectiveTarget]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  return { feedbackItems, resolvedItems, fetchFeedback };
}
