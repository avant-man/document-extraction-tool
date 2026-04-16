export type ExtractionWarning = {
  code: string;
  message: string;
};

const LOW_ANNOTATED_CHARS = 400;

export function buildExtractionWarnings(params: {
  nativeTotalTrimmedChars: number;
  annotatedChars: number;
  ocrEngine: 'none' | 'tesseract';
  ocrAppliedToPages: number[];
  autoGlobalSparseApplied: boolean;
}): ExtractionWarning[] {
  const warnings: ExtractionWarning[] = [];
  const { nativeTotalTrimmedChars, annotatedChars, ocrEngine, ocrAppliedToPages, autoGlobalSparseApplied } = params;

  if (ocrEngine === 'none' && nativeTotalTrimmedChars < 200) {
    warnings.push({
      code: 'ocr_disabled_low_native_text',
      message:
        'Very little selectable text was found and OCR is off (OCR_ENGINE=none). Set OCR_ENGINE=tesseract on the server for scan-only PDFs.'
    });
  }

  if (ocrEngine === 'tesseract' && ocrAppliedToPages.length === 0 && nativeTotalTrimmedChars < 500) {
    warnings.push({
      code: 'ocr_no_pages_applied',
      message:
        'Tesseract is enabled but no pages received OCR text. Check logs for pdf.raster_failed or ocr.page_failed; try OCR_RENDER_SCALE=2 or lower OCR_SPARSE_CHAR_THRESHOLD.'
    });
  }

  if (annotatedChars < LOW_ANNOTATED_CHARS) {
    warnings.push({
      code: 'low_extractable_signal',
      message:
        'Annotated document text is very short; extraction may be empty after validation. Scan PDFs need OCR_ENGINE=tesseract and sufficient OCR_MAX_PAGES.'
    });
  }

  if (autoGlobalSparseApplied) {
    warnings.push({
      code: 'auto_global_sparse_ocr',
      message:
        'Total native text was below AUTO_OCR_NATIVE_TOTAL_CHARS_THRESHOLD; all pages were treated as OCR candidates.'
    });
  }

  return warnings;
}
