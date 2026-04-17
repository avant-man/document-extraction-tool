/** Trims only real strings; returns "" for null, undefined, or non-strings. */
export function safeTrim(s: unknown): string {
  if (s == null || typeof s !== 'string') return '';
  return s.trim();
}

/** True when env value is missing, null, empty, or whitespace-only. */
export function isBlankEnv(raw: string | undefined | null): boolean {
  return raw == null || String(raw).trim() === '';
}
