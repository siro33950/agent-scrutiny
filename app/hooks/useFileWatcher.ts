"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "agent-scrutiny-auto-reload";
const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 3000;
const FILE_CHANGE_DEBOUNCE_MS = 500;

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

interface UseFileWatcherOptions {
  target: string | undefined;
  onFileChange: () => void;
}

interface UseFileWatcherResult {
  autoReloadEnabled: boolean;
  connectionState: ConnectionState;
  toggleAutoReload: () => void;
}

export function useFileWatcher({
  target,
  onFileChange,
}: UseFileWatcherOptions): UseFileWatcherResult {
  const [autoReloadEnabled, setAutoReloadEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });

  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileChangeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onFileChangeRef = useRef(onFileChange);
  const connectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onFileChangeRef.current = onFileChange;
  }, [onFileChange]);

  const disconnect = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (fileChangeTimerRef.current) {
      clearTimeout(fileChangeTimerRef.current);
      fileChangeTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnectionState("disconnected");
  }, []);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionState("connecting");

    const params = new URLSearchParams();
    if (target) {
      params.set("target", target);
    }
    const url = `/api/watch${params.toString() ? `?${params.toString()}` : ""}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      retryCountRef.current = 0;
      setConnectionState("connected");
    };

    eventSource.addEventListener("file-changed", () => {
      if (fileChangeTimerRef.current) {
        clearTimeout(fileChangeTimerRef.current);
      }
      fileChangeTimerRef.current = setTimeout(() => {
        fileChangeTimerRef.current = null;
        onFileChangeRef.current();
      }, FILE_CHANGE_DEBOUNCE_MS);
    });

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;

      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        setConnectionState("connecting");
        retryTimerRef.current = setTimeout(() => {
          connectRef.current?.();
        }, RETRY_INTERVAL_MS);
      } else {
        setConnectionState("error");
      }
    };
  }, [target]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (autoReloadEnabled && target) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [autoReloadEnabled, target, connect, disconnect]);

  const toggleAutoReload = useCallback(() => {
    setAutoReloadEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return {
    autoReloadEnabled,
    connectionState,
    toggleAutoReload,
  };
}
