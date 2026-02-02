const BASE_REF_MAX_LENGTH = 200;
const BASE_REF_PATTERN = /^[A-Za-z0-9/_.~^@:-]+$/;

/**
 * 渡された ref を検証する。
 * シェルインジェクション・パストラバーサルを防ぐため、許可文字のみ・長さ上限を課す。
 * @returns 検証済みの ref、無効な場合は null
 */
export function validateBaseRef(base: string): string | null {
  if (typeof base !== "string" || !base.trim()) return null;
  const trimmed = base.trim();
  if (trimmed.length > BASE_REF_MAX_LENGTH) return null;
  if (!BASE_REF_PATTERN.test(trimmed)) return null;
  return trimmed;
}
