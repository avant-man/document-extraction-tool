import { isBlankEnv } from './stringUtils';

/**
 * When native text is globally tiny (scan-only PDF), mark every page as an OCR candidate
 * so junk per-page length does not skip rasterization. Only applies when Tesseract is enabled.
 */
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (isBlankEnv(raw)) return fallback;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Sum of trim() lengths across all native page strings. */
export function sumNativeTrimmedLengths(pages: string[]): number {
  let s = 0;
  for (const p of pages) {
    s += (p ?? '').trim().length;
  }
  return s;
}

/** If total native chars falls below this, all pages are OCR candidates (when engine is tesseract). Default 500. */
export function getAutoOcrGlobalNativeCharThreshold(): number {
  return parsePositiveInt(process.env.AUTO_OCR_NATIVE_TOTAL_CHARS_THRESHOLD, 500);
}

export function resolveSparseIndicesForOcr(
  nativePages: string[],
  engine: 'none' | 'tesseract',
  baseSparse1Based: number[]
): { sparsePageIndices1Based: number[]; autoGlobalSparseApplied: boolean } {
  if (engine !== 'tesseract') {
    return { sparsePageIndices1Based: baseSparse1Based, autoGlobalSparseApplied: false };
  }

  const total = sumNativeTrimmedLengths(nativePages);
  if (total < getAutoOcrGlobalNativeCharThreshold() && nativePages.length > 0) {
    return {
      sparsePageIndices1Based: nativePages.map((_, i) => i + 1),
      autoGlobalSparseApplied: true
    };
  }

  return { sparsePageIndices1Based: baseSparse1Based, autoGlobalSparseApplied: false };
}
