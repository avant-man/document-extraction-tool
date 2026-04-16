import { describe, expect, it, afterEach } from 'vitest';
import { resolveSparseIndicesForOcr, sumNativeTrimmedLengths, getAutoOcrGlobalNativeCharThreshold } from './ocrSparsePolicy';

describe('ocrSparsePolicy', () => {
  afterEach(() => {
    delete process.env.AUTO_OCR_NATIVE_TOTAL_CHARS_THRESHOLD;
  });

  it('sumNativeTrimmedLengths sums trimmed page lengths', () => {
    expect(sumNativeTrimmedLengths(['  ab ', 'cd'])).toBe(4);
  });

  it('resolveSparseIndicesForOcr leaves heuristic when engine is none', () => {
    const pages = ['a', 'b'];
    const r = resolveSparseIndicesForOcr(pages, 'none', [1, 2]);
    expect(r.sparsePageIndices1Based).toEqual([1, 2]);
    expect(r.autoGlobalSparseApplied).toBe(false);
  });

  it('resolveSparseIndicesForOcr expands to all pages when native total is below threshold', () => {
    process.env.AUTO_OCR_NATIVE_TOTAL_CHARS_THRESHOLD = '100';
    const pages = ['x'.repeat(30), 'y'.repeat(30)];
    expect(sumNativeTrimmedLengths(pages)).toBe(60);
    const r = resolveSparseIndicesForOcr(pages, 'tesseract', [1]);
    expect(r.autoGlobalSparseApplied).toBe(true);
    expect(r.sparsePageIndices1Based).toEqual([1, 2]);
  });

  it('getAutoOcrGlobalNativeCharThreshold reads env', () => {
    process.env.AUTO_OCR_NATIVE_TOTAL_CHARS_THRESHOLD = '200';
    expect(getAutoOcrGlobalNativeCharThreshold()).toBe(200);
  });
});
