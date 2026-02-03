import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

const ALLOWED_HOSTS = ["localhost", "127.0.0.1"];

/**
 * リクエストのOriginまたはHostヘッダーがlocalhostであることを検証
 * @returns null if valid, error message if invalid
 */
export function checkOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Origin ヘッダーがある場合（クロスオリジンリクエスト）
  if (origin) {
    if (ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed.replace(/:3\d{3}$/, "")))) {
      return null;
    }
    // localhost以外のOriginは拒否
    try {
      const url = new URL(origin);
      if (ALLOWED_HOSTS.includes(url.hostname)) {
        return null;
      }
    } catch {
      // Invalid URL
    }
    return `許可されていないOriginからのリクエストです: ${origin}`;
  }

  // Origin ヘッダーがない場合はHostをチェック
  if (host) {
    const hostname = host.split(":")[0];
    if (ALLOWED_HOSTS.includes(hostname)) {
      return null;
    }
    return `許可されていないHostからのリクエストです: ${host}`;
  }

  // Origin も Host もない場合（通常ありえない）
  return "OriginまたはHostヘッダーが必要です";
}
