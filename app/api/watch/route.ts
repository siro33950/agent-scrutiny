import { NextRequest } from "next/server";
import { loadConfig, getTargetDir } from "@/lib/config";
import { fileWatcherManager } from "@/lib/file-watcher";
import { SSE_EVENTS, KEEPALIVE_INTERVAL_MS } from "@/lib/watch-config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("target") ?? undefined;
  const targetDir = getTargetDir(projectRoot, config, target);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let keepaliveTimer: NodeJS.Timeout | null = null;
      let isClosed = false;

      const sendEvent = (event: string, data: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          cleanup();
        }
      };

      const onFileChange = (event: string, filePath: string) => {
        sendEvent(
          SSE_EVENTS.FILE_CHANGED,
          JSON.stringify({ event, path: filePath, timestamp: Date.now() })
        );
      };

      const unsubscribe = fileWatcherManager.subscribe(targetDir, onFileChange);

      keepaliveTimer = setInterval(() => {
        sendEvent(SSE_EVENTS.KEEPALIVE, JSON.stringify({ timestamp: Date.now() }));
      }, KEEPALIVE_INTERVAL_MS);

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;

        if (keepaliveTimer) {
          clearInterval(keepaliveTimer);
          keepaliveTimer = null;
        }

        unsubscribe();

        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
