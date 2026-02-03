import chokidar, { FSWatcher } from "chokidar";
import path from "path";
import { SKIP_DIRS, DEBOUNCE_MS } from "./watch-config";

type ChangeCallback = (event: string, filePath: string) => void;

interface WatcherEntry {
  watcher: FSWatcher;
  subscribers: Set<ChangeCallback>;
}

/**
 * ファイル監視を管理するシングルトンクラス
 */
class FileWatcherManager {
  private watchers: Map<string, WatcherEntry> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * 指定されたターゲットディレクトリのファイル変更を購読
   */
  subscribe(targetDir: string, callback: ChangeCallback): () => void {
    const normalizedTarget = path.resolve(targetDir);
    let entry = this.watchers.get(normalizedTarget);

    if (!entry) {
      entry = this.createWatcher(normalizedTarget);
      this.watchers.set(normalizedTarget, entry);
    }

    entry.subscribers.add(callback);

    return () => this.unsubscribe(normalizedTarget, callback);
  }

  /**
   * 購読を解除
   */
  private unsubscribe(targetDir: string, callback: ChangeCallback): void {
    const entry = this.watchers.get(targetDir);
    if (!entry) return;

    entry.subscribers.delete(callback);

    if (entry.subscribers.size === 0) {
      void entry.watcher.close().catch((err) => {
        console.error("Failed to close watcher:", err);
      });
      this.watchers.delete(targetDir);

      // targetDirに紐づく全てのデバウンスタイマーをクリア
      for (const [key, timer] of this.debounceTimers) {
        if (key.startsWith(`${targetDir}:`)) {
          clearTimeout(timer);
          this.debounceTimers.delete(key);
        }
      }
    }
  }

  /**
   * chokidar watcherを作成
   */
  private createWatcher(targetDir: string): WatcherEntry {
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ignoredPatterns = Array.from(SKIP_DIRS).map(
      (dir) => new RegExp(`(^|[/\\\\])${escapeRegExp(dir)}([/\\\\]|$)`)
    );

    const watcher = chokidar.watch(targetDir, {
      ignored: ignoredPatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    const entry: WatcherEntry = {
      watcher,
      subscribers: new Set(),
    };

    const notifySubscribers = (event: string, filePath: string) => {
      const relativePath = path.relative(targetDir, filePath);
      for (const callback of entry.subscribers) {
        callback(event, relativePath);
      }
    };

    const debouncedNotify = (event: string, filePath: string) => {
      const timerKey = `${targetDir}:${filePath}`;
      const existingTimer = this.debounceTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.debounceTimers.delete(timerKey);
        notifySubscribers(event, filePath);
      }, DEBOUNCE_MS);

      this.debounceTimers.set(timerKey, timer);
    };

    watcher
      .on("add", (filePath) => debouncedNotify("add", filePath))
      .on("change", (filePath) => debouncedNotify("change", filePath))
      .on("unlink", (filePath) => debouncedNotify("unlink", filePath))
      .on("addDir", (filePath) => debouncedNotify("addDir", filePath))
      .on("unlinkDir", (filePath) => debouncedNotify("unlinkDir", filePath));

    return entry;
  }

  /**
   * 現在のwatcher数を取得（デバッグ用）
   */
  getWatcherCount(): number {
    return this.watchers.size;
  }

  /**
   * 特定ターゲットの購読者数を取得（デバッグ用）
   */
  getSubscriberCount(targetDir: string): number {
    const normalizedTarget = path.resolve(targetDir);
    const entry = this.watchers.get(normalizedTarget);
    return entry?.subscribers.size ?? 0;
  }
}

export const fileWatcherManager = new FileWatcherManager();
