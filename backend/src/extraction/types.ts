import type { ExtractedReport } from '../types/extraction';
import type { ExtractionWarning } from '../lib/extractionWarnings';

export type ExtractionJobStage =
  | 'queued'
  | 'fetching'
  | 'ocr'
  | 'annotating'
  | 'claude'
  | 'merging'
  | 'done'
  | 'failed';

export type JobProgress = {
  ocrChunk: number | null;
  ocrChunksTotal: number | null;
  claudeBatch: number | null;
  claudeBatchesTotal: number | null;
};

/** Persisted in Blob at extraction-jobs/{jobId}/state.json (metadata + pointers; large payloads in sibling blobs). */
export type ExtractionJobState = {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: ExtractionJobStage;
  sourceBlobUrl: string;
  filename?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
  /** Set after fetch-native copies the upload */
  pdfPathname?: string;
  nativeTotalTrimmedChars?: number;
  sparsePageIndices?: number[];
  autoGlobalSparseApplied?: boolean;
  ocrEngine?: string;
  /** 1-based page indices per OCR step */
  ocrChunkPlans?: number[][];
  /** Completed OCR chunks (0..total) */
  ocrChunkCurrent?: number;
  ocrAppliedToPages?: number[];
  /** Planning output */
  useBatchedExtraction?: boolean;
  batchCount?: number;
  batches?: number[][];
  estimatedInputTokens?: number;
  budgetTokens?: number;
  pageCount?: number;
  /** Completed Claude batches (0..total) */
  claudeBatchCurrent?: number;
  /** URL of result JSON blob when completed (optional mirror) */
  resultUrl?: string;
};

export type ExtractionPipelineSyncResult = {
  report: ExtractedReport;
  extractionWarnings: ExtractionWarning[];
};

export type FetchNativeStepResult = {
  ocrChunksTotal: number;
};
