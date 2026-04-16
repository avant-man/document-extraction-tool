import { describe, expect, it } from 'vitest';
import { buildExtractionWarnings } from './extractionWarnings';

describe('buildExtractionWarnings', () => {
  it('warns when OCR is off and native text is tiny', () => {
    const w = buildExtractionWarnings({
      nativeTotalTrimmedChars: 10,
      annotatedChars: 50,
      ocrEngine: 'none',
      ocrAppliedToPages: [],
      autoGlobalSparseApplied: false
    });
    expect(w.some(x => x.code === 'ocr_disabled_low_native_text')).toBe(true);
    expect(w.some(x => x.code === 'low_extractable_signal')).toBe(true);
  });

  it('warns when tesseract produced no OCR pages on low native text', () => {
    const w = buildExtractionWarnings({
      nativeTotalTrimmedChars: 20,
      annotatedChars: 20,
      ocrEngine: 'tesseract',
      ocrAppliedToPages: [],
      autoGlobalSparseApplied: false
    });
    expect(w.some(x => x.code === 'ocr_no_pages_applied')).toBe(true);
  });

  it('includes auto_global_sparse when applied', () => {
    const w = buildExtractionWarnings({
      nativeTotalTrimmedChars: 100,
      annotatedChars: 5000,
      ocrEngine: 'tesseract',
      ocrAppliedToPages: [1],
      autoGlobalSparseApplied: true
    });
    expect(w.some(x => x.code === 'auto_global_sparse_ocr')).toBe(true);
  });
});
