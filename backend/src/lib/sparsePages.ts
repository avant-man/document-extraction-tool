import { isBlankEnv } from './stringUtils';

/**
 * Pages with very little selectable text are candidates for OCR (scan-only / partial layers).
 * Threshold counts trimmed characters on the native extracted string for that page.
 */
const DEFAULT_SPARSE_CHAR_THRESHOLD = 80;

/** If set and > 0, pages with long but low-information native text (junk layer) count as sparse when alnum/total < this. */
const DEFAULT_SPARSE_MIN_ALNUM_RATIO = 0.12;

export function getSparseCharThreshold(): number {
  const raw = process.env.OCR_SPARSE_CHAR_THRESHOLD;
  if (isBlankEnv(raw)) return DEFAULT_SPARSE_CHAR_THRESHOLD;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_SPARSE_CHAR_THRESHOLD;
}

/**
 * Minimum ratio of [A-Za-z0-9] to total trimmed length for a page to be considered "non-sparse"
 * when length is already >= threshold. `null` disables (length-only heuristic).
 */
export function getSparseMinAlphanumericRatio(): number | null {
  const raw = process.env.OCR_SPARSE_MIN_ALNUM_RATIO;
  if (isBlankEnv(raw)) return DEFAULT_SPARSE_MIN_ALNUM_RATIO;
  const n = Number.parseFloat(String(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(1, n);
}

export function nativePageAlphanumericRatio(pageText: string): number {
  const t = (pageText ?? '').trim();
  if (t.length === 0) return 0;
  const alnum = (t.match(/[a-zA-Z0-9]/g) ?? []).length;
  return alnum / t.length;
}

export function pageLooksSparseNative(
  pageText: string,
  thresholdChars = getSparseCharThreshold(),
  minAlnumRatio: number | null = getSparseMinAlphanumericRatio()
): boolean {
  const t = (pageText ?? '').trim();
  if (t.length < thresholdChars) return true;
  if (minAlnumRatio == null) return false;
  return nativePageAlphanumericRatio(pageText ?? '') < minAlnumRatio;
}

/** @returns 1-based page indices where native text is considered sparse */
export function detectSparsePageIndices(pages: string[], thresholdChars = getSparseCharThreshold()): number[] {
  const minR = getSparseMinAlphanumericRatio();
  const sparse: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    if (pageLooksSparseNative(pages[i] ?? '', thresholdChars, minR)) {
      sparse.push(i + 1);
    }
  }
  return sparse;
}
