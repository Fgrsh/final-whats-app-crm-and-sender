/**
 * Safe API fetch helpers that guard against HTML responses (e.g. during server restarts or Vite fallbacks)
 * and network disconnections.
 */

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<T | null> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      return null;
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    // Transient network errors, dev server restarts, or aborted requests
    return null;
  }
}
