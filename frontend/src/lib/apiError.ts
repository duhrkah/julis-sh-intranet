/**
 * FastAPI/Pydantic validation errors return detail as array of { type, loc, msg, input, ctx, url }.
 * This normalizes detail to a string so it can be safely rendered in React.
 */
export function normalizeApiDetail(
  detail: unknown,
  fallback = 'Ein Fehler ist aufgetreten.'
): string {
  if (detail == null) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc || []).join('.')}: ${d.msg ?? ''}`.trim())
      .filter(Boolean)
      .join('; ') || fallback;
  }
  return fallback;
}

/**
 * Extract a display message from an axios-style error (e.response?.data?.detail).
 */
export function getApiErrorMessage(
  e: unknown,
  fallback = 'Ein Fehler ist aufgetreten.'
): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return normalizeApiDetail(detail, fallback);
}
