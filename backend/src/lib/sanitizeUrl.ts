/**
 * Host + pathname only, no query or hash (tokens often live in query strings).
 */
export function sanitizeBlobUrlForLog(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}
