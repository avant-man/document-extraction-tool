import { fetchPdfBuffer, deleteBlobSafe } from '../services/blobService';
import { extractPagesFromBuffer, joinPageTexts } from '../services/pdfService';
import { annotateText } from '../services/regexParser';
import { extractWithClaude, WATERSHED_EXTRACTION_SYSTEM_PROMPT } from '../services/claudeService';
import { mergePartialExtractions } from '../services/mergeExtractedReports';
import {
  buildPageBatchesForClaude,
  getExtractionMaxPagesPerBatch,
  joinAnnotatedPagesForBatch,
  splitAnnotatedDocumentByPages
} from '../lib/pageBatches';
import type { ExtractedReport } from '../types/extraction';
import { validate } from '../services/validator';
import { logger } from '../lib/logger';
import {
  estimateClaudeExtractionInputTokens,
  getExtractionInputTokenBudget,
  isExtractionInputOverBudget
} from '../lib/tokenBudget';
import { detectSparsePageIndices, getSparseCharThreshold } from '../lib/sparsePages';
import { resolveSparseIndicesForOcr, sumNativeTrimmedLengths } from '../lib/ocrSparsePolicy';
import { buildExtractionWarnings } from '../lib/extractionWarnings';
import {
  applyOcrToSparsePages,
  getOcrEngineKind,
  getOcrMaxPagesPerRequest,
  getOcrPagesPerStep
} from '../services/ocrService';
import type { ExtractionPipelineSyncResult, ExtractionJobState, FetchNativeStepResult } from './types';
import * as jobBlob from './jobBlobStore';

function chunkOcrIndices(candidates: number[], chunkSize: number): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < candidates.length; i += chunkSize) {
    chunks.push(candidates.slice(i, i + chunkSize));
  }
  return chunks;
}

/** Full pipeline in one process (sync `POST /api/extract`; production UI uses Inngest job steps). */
export async function runSyncExtractionFromBuffer(buffer: Buffer): Promise<ExtractionPipelineSyncResult> {
  const pipelineStart = Date.now();

  const tPdf = Date.now();
  const { pages: nativePages, numPages } = await extractPagesFromBuffer(buffer);
  const pdfParseMs = Date.now() - tPdf;

  const nativeTotalTrimmedChars = sumNativeTrimmedLengths(nativePages);
  const sparseHeuristic = detectSparsePageIndices(nativePages);
  const ocrEngine = getOcrEngineKind();
  const { sparsePageIndices1Based: sparsePageIndices, autoGlobalSparseApplied } = resolveSparseIndicesForOcr(
    nativePages,
    ocrEngine,
    sparseHeuristic
  );

  const tOcr = Date.now();
  const { pages: mergedPages, ocrAppliedToPages } = await applyOcrToSparsePages({
    pdfBuffer: buffer,
    pages: nativePages,
    sparsePageIndices1Based: sparsePageIndices,
    engine: ocrEngine
  });
  const ocrMs = Date.now() - tOcr;

  const rawText = joinPageTexts(mergedPages);
  logger.info('extract.stage', {
    stage: 'pdf',
    durationMs: pdfParseMs + ocrMs,
    pdfParseMs,
    ocrMs,
    numPages,
    pageCount: mergedPages.length,
    nativeTotalTrimmedChars,
    sparseCharThreshold: getSparseCharThreshold(),
    sparseHeuristicIndices: sparseHeuristic,
    sparsePageIndices,
    autoGlobalSparseApplied,
    ocrPages: sparsePageIndices,
    ocrAppliedToPages,
    ocrEngine
  });

  const tRegex = Date.now();
  const { text: annotatedText, regexNumerics } = annotateText(rawText);
  const regexMs = Date.now() - tRegex;
  const numMarkers = (annotatedText.match(/\[NUM:/g) ?? []).length;
  logger.info('extract.stage', {
    stage: 'regex',
    durationMs: regexMs,
    regexNumericsSize: regexNumerics.size,
    regexMarkerCount: numMarkers,
    annotatedChars: annotatedText.length
  });

  const budgetTokens = getExtractionInputTokenBudget();
  const estimatedInputTokens = estimateClaudeExtractionInputTokens(
    WATERSHED_EXTRACTION_SYSTEM_PROMPT,
    annotatedText
  );
  const overFullDoc = isExtractionInputOverBudget(
    WATERSHED_EXTRACTION_SYSTEM_PROMPT,
    annotatedText,
    budgetTokens
  );
  const pageSlices = splitAnnotatedDocumentByPages(annotatedText);
  const maxPagesPerBatch = getExtractionMaxPagesPerBatch();
  const batchedDueToPageCap =
    Number.isFinite(maxPagesPerBatch) && pageSlices.length > maxPagesPerBatch;
  const useBatchedExtraction = overFullDoc || batchedDueToPageCap;

  let rawJson: string;
  let claudeMs = 0;
  let mergeMs = 0;

  if (!useBatchedExtraction) {
    const tClaude = Date.now();
    rawJson = await extractWithClaude(annotatedText, {
      estimatedInputTokens,
      pageCount: mergedPages.length,
      ocrEngine,
      ocrAppliedToPages,
      sparsePageIndices
    });
    claudeMs = Date.now() - tClaude;
    logger.info('extract.stage', {
      stage: 'claude',
      durationMs: claudeMs,
      batched: false,
      batchCount: 1
    });
  } else {
    const batches = buildPageBatchesForClaude(WATERSHED_EXTRACTION_SYSTEM_PROMPT, pageSlices, budgetTokens);
    if (!batches) {
      const e = new Error('document_text_exceeds_model_context') as Error & {
        code: string;
        estimatedInputTokens: number;
        budgetTokens: number;
      };
      e.code = 'document_text_exceeds_model_context';
      e.estimatedInputTokens = estimatedInputTokens;
      e.budgetTokens = budgetTokens;
      throw e;
    }
    const partials: ExtractedReport[] = [];
    for (let i = 0; i < batches.length; i++) {
      const pageNums = batches[i]!;
      const body = joinAnnotatedPagesForBatch(pageSlices, pageNums);
      const startP = Math.min(...pageNums);
      const endP = Math.max(...pageNums);
      const estBatch = estimateClaudeExtractionInputTokens(WATERSHED_EXTRACTION_SYSTEM_PROMPT, body);
      const tBatch = Date.now();
      const jsonStr = await extractWithClaude(
        body,
        {
          estimatedInputTokens: estBatch,
          pageCount: mergedPages.length,
          ocrEngine,
          ocrAppliedToPages,
          sparsePageIndices,
          batchIndex: i,
          totalBatches: batches.length,
          batchedExtraction: true
        },
        {
          batchIndex: i,
          totalBatches: batches.length,
          startPage: startP,
          endPage: endP,
          isFirstBatch: i === 0
        }
      );
      const batchMs = Date.now() - tBatch;
      claudeMs += batchMs;
      logger.info('extract.stage', {
        stage: 'claude_batch',
        durationMs: batchMs,
        batchIndex: i,
        totalBatches: batches.length,
        startPage: startP,
        endPage: endP
      });
      partials.push(JSON.parse(jsonStr) as ExtractedReport);
    }
    const tMerge = Date.now();
    rawJson = JSON.stringify(mergePartialExtractions(partials));
    mergeMs = Date.now() - tMerge;
    logger.info('extract.stage', {
      stage: 'merge_partials',
      durationMs: mergeMs,
      batchCount: partials.length
    });
  }

  const tValidate = Date.now();
  const result = validate(rawJson, regexNumerics, rawText);
  const validateMs = Date.now() - tValidate;

  const extractionWarnings = buildExtractionWarnings({
    nativeTotalTrimmedChars,
    annotatedChars: annotatedText.length,
    ocrEngine,
    ocrAppliedToPages,
    autoGlobalSparseApplied
  });

  const pipelineMs = Date.now() - pipelineStart;
  const accountedMs = pdfParseMs + ocrMs + regexMs + claudeMs + mergeMs + validateMs;
  logger.info('extract.timing', {
    pipelineMs,
    pdfParseMs,
    ocrMs,
    regexMs,
    claudeMs,
    mergeMs,
    validateMs,
    unloggedOverheadMs: Math.max(0, pipelineMs - accountedMs),
    batchedClaude: useBatchedExtraction
  });

  return { report: result, extractionWarnings };
}

async function patchJobState(jobId: string, patch: Partial<ExtractionJobState>): Promise<void> {
  const prev = await jobBlob.getJobState(jobId);
  if (!prev) throw new Error(`job state missing: ${jobId}`);
  await jobBlob.putJobState(jobId, { ...prev, ...patch, updatedAt: new Date().toISOString() });
}

export async function extractionJobFetchNative(jobId: string): Promise<FetchNativeStepResult> {
  const state = await jobBlob.getJobState(jobId);
  if (!state) throw new Error(`job not found: ${jobId}`);

  await patchJobState(jobId, { status: 'running', stage: 'fetching' });

  const buffer = await fetchPdfBuffer(state.sourceBlobUrl);
  await jobBlob.putJobPdf(jobId, buffer);
  await deleteBlobSafe(state.sourceBlobUrl);

  const { pages: nativePages, numPages } = await extractPagesFromBuffer(buffer);
  const nativeTotalTrimmedChars = sumNativeTrimmedLengths(nativePages);
  const sparseHeuristic = detectSparsePageIndices(nativePages);
  const ocrEngine = getOcrEngineKind();
  const { sparsePageIndices1Based: sparsePageIndices, autoGlobalSparseApplied } = resolveSparseIndicesForOcr(
    nativePages,
    ocrEngine,
    sparseHeuristic
  );

  const maxOcr = getOcrMaxPagesPerRequest();
  const candidates = sparsePageIndices.filter(p => p >= 1 && p <= nativePages.length).slice(0, maxOcr);
  const chunkSize = getOcrPagesPerStep();
  const ocrChunkPlans =
    ocrEngine === 'none' || candidates.length === 0 ? [] : chunkOcrIndices(candidates, chunkSize);

  await jobBlob.putJobPages(jobId, nativePages);

  await patchJobState(jobId, {
    stage: ocrChunkPlans.length > 0 ? 'ocr' : 'annotating',
    nativeTotalTrimmedChars,
    sparsePageIndices,
    autoGlobalSparseApplied,
    ocrEngine,
    ocrChunkPlans,
    ocrAppliedToPages: [],
    pageCount: numPages,
    pdfPathname: jobBlob.jobPdfPathname(jobId)
  });

  logger.info('extract.job.fetch_native', { jobId, ocrChunksTotal: ocrChunkPlans.length, numPages });
  return { ocrChunksTotal: ocrChunkPlans.length };
}

export async function extractionJobOcrChunk(jobId: string, chunkIndex: number): Promise<void> {
  const state = await jobBlob.getJobState(jobId);
  if (!state?.ocrChunkPlans?.length) return;

  const plans = state.ocrChunkPlans;
  if (chunkIndex < 0 || chunkIndex >= plans.length) {
    throw new Error(`ocr chunk out of range: ${chunkIndex}`);
  }

  await patchJobState(jobId, { stage: 'ocr', status: 'running' });

  const pdfBuffer = await jobBlob.getJobPdfBuffer(jobId);
  const pages = await jobBlob.getJobPages(jobId);
  if (!pdfBuffer?.length || !pages) throw new Error('job pdf or pages missing');

  const ocrEngine = getOcrEngineKind();
  const chunkIndices = plans[chunkIndex]!;

  const { pages: merged, ocrAppliedToPages: chunkApplied } = await applyOcrToSparsePages({
    pdfBuffer,
    pages,
    sparsePageIndices1Based: chunkIndices,
    engine: ocrEngine
  });

  const prevApplied = state.ocrAppliedToPages ?? [];
  const mergedApplied = [...new Set([...prevApplied, ...chunkApplied])].sort((a, b) => a - b);

  await jobBlob.putJobPages(jobId, merged);
  await patchJobState(jobId, {
    ocrAppliedToPages: mergedApplied,
    ocrChunkCurrent: chunkIndex + 1
  });

  logger.info('extract.job.ocr_chunk', { jobId, chunkIndex, chunkSize: chunkIndices.length });
}

export type AnnotatePlanResult = {
  useBatchedExtraction: boolean;
  batchCount: number;
};

export async function extractionJobAnnotateAndPlan(jobId: string): Promise<AnnotatePlanResult> {
  await patchJobState(jobId, { stage: 'annotating' });

  const pages = await jobBlob.getJobPages(jobId);
  if (!pages) throw new Error('job pages missing');

  const state = await jobBlob.getJobState(jobId);
  const rawText = joinPageTexts(pages);
  const { text: annotatedText, regexNumerics } = annotateText(rawText);
  const entries = [...regexNumerics.entries()] as [string, number][];
  await jobBlob.putAnnotatedAndRegex(jobId, annotatedText, entries);

  const budgetTokens = getExtractionInputTokenBudget();
  const estimatedInputTokens = estimateClaudeExtractionInputTokens(
    WATERSHED_EXTRACTION_SYSTEM_PROMPT,
    annotatedText
  );
  const overFullDoc = isExtractionInputOverBudget(
    WATERSHED_EXTRACTION_SYSTEM_PROMPT,
    annotatedText,
    budgetTokens
  );
  const pageSlices = splitAnnotatedDocumentByPages(annotatedText);
  const maxPagesPerBatch = getExtractionMaxPagesPerBatch();
  const batchedDueToPageCap =
    Number.isFinite(maxPagesPerBatch) && pageSlices.length > maxPagesPerBatch;
  const useBatchedExtraction = overFullDoc || batchedDueToPageCap;

  if (!useBatchedExtraction) {
    await patchJobState(jobId, {
      useBatchedExtraction: false,
      batchCount: 1,
      batches: [],
      estimatedInputTokens,
      budgetTokens,
      stage: 'claude',
      claudeBatchCurrent: 0
    });
    return { useBatchedExtraction: false, batchCount: 1 };
  }

  const batches = buildPageBatchesForClaude(WATERSHED_EXTRACTION_SYSTEM_PROMPT, pageSlices, budgetTokens);
  if (!batches) {
    await patchJobState(jobId, {
      status: 'failed',
      stage: 'failed',
      error: 'document_text_exceeds_model_context'
    });
    throw new Error('document_text_exceeds_model_context');
  }

  await patchJobState(jobId, {
    useBatchedExtraction: true,
    batchCount: batches.length,
    batches,
    estimatedInputTokens,
    budgetTokens,
    stage: 'claude',
    claudeBatchCurrent: 0
  });

  return { useBatchedExtraction: true, batchCount: batches.length };
}

export async function extractionJobClaudeSingle(jobId: string): Promise<void> {
  const annotatedText = await jobBlob.getAnnotatedText(jobId);
  const state = await jobBlob.getJobState(jobId);
  if (!annotatedText || !state) throw new Error('annotated text or state missing');

  const pages = await jobBlob.getJobPages(jobId);
  const pageCount = pages?.length ?? state.pageCount ?? 0;

  const estimatedInputTokens = estimateClaudeExtractionInputTokens(
    WATERSHED_EXTRACTION_SYSTEM_PROMPT,
    annotatedText
  );

  const rawJson = await extractWithClaude(annotatedText, {
    estimatedInputTokens,
    pageCount,
    ocrEngine: (state.ocrEngine as 'none' | 'tesseract') ?? 'none',
    ocrAppliedToPages: state.ocrAppliedToPages,
    sparsePageIndices: state.sparsePageIndices
  });

  await jobBlob.putPartialBatch(jobId, 0, rawJson);
  await patchJobState(jobId, { claudeBatchCurrent: 1 });
}

export async function extractionJobClaudeBatchPart(jobId: string, batchIndex: number): Promise<void> {
  const annotatedText = await jobBlob.getAnnotatedText(jobId);
  const state = await jobBlob.getJobState(jobId);
  if (!annotatedText || !state?.batches?.length) throw new Error('state or batches missing');

  const pageSlices = splitAnnotatedDocumentByPages(annotatedText);
  const batches = state.batches;
  const pageNums = batches[batchIndex];
  if (!pageNums) throw new Error(`batch ${batchIndex} missing`);

  const body = joinAnnotatedPagesForBatch(pageSlices, pageNums);
  const startP = Math.min(...pageNums);
  const endP = Math.max(...pageNums);
  const estBatch = estimateClaudeExtractionInputTokens(WATERSHED_EXTRACTION_SYSTEM_PROMPT, body);
  const pageCount = state.pageCount ?? pageSlices.length;

  const rawJson = await extractWithClaude(
    body,
    {
      estimatedInputTokens: estBatch,
      pageCount,
      ocrEngine: (state.ocrEngine as 'none' | 'tesseract') ?? 'none',
      ocrAppliedToPages: state.ocrAppliedToPages,
      sparsePageIndices: state.sparsePageIndices,
      batchIndex,
      totalBatches: batches.length,
      batchedExtraction: true
    },
    {
      batchIndex,
      totalBatches: batches.length,
      startPage: startP,
      endPage: endP,
      isFirstBatch: batchIndex === 0
    }
  );

  await jobBlob.putPartialBatch(jobId, batchIndex, rawJson);
  await patchJobState(jobId, { claudeBatchCurrent: batchIndex + 1 });
}

export async function extractionJobMergeAndValidate(jobId: string): Promise<void> {
  await patchJobState(jobId, { stage: 'merging' });

  const state = await jobBlob.getJobState(jobId);
  const regexNumerics = await jobBlob.getRegexNumericsMap(jobId);
  const pages = await jobBlob.getJobPages(jobId);
  const rawText = pages ? joinPageTexts(pages) : '';

  if (!state || !regexNumerics || !pages) {
    throw new Error('merge: missing state, regex, or pages');
  }

  let rawJson: string;
  if (state.useBatchedExtraction) {
    const n = state.batchCount ?? 0;
    const partials: ExtractedReport[] = [];
    for (let i = 0; i < n; i++) {
      const s = await jobBlob.getPartialBatch(jobId, i);
      if (!s) throw new Error(`missing partial batch ${i}`);
      partials.push(JSON.parse(s) as ExtractedReport);
    }
    rawJson = JSON.stringify(mergePartialExtractions(partials));
  } else {
    const s = await jobBlob.getPartialBatch(jobId, 0);
    if (!s) throw new Error('missing claude output');
    rawJson = s;
  }

  const result = validate(rawJson, regexNumerics, rawText);
  const annotatedLen = (await jobBlob.getAnnotatedText(jobId))?.length ?? 0;
  const extractionWarnings = buildExtractionWarnings({
    nativeTotalTrimmedChars: state.nativeTotalTrimmedChars ?? 0,
    annotatedChars: annotatedLen,
    ocrEngine: (state.ocrEngine as 'none' | 'tesseract') ?? 'none',
    ocrAppliedToPages: state.ocrAppliedToPages ?? [],
    autoGlobalSparseApplied: state.autoGlobalSparseApplied ?? false
  });

  const resultUrl = await jobBlob.putJobResult(jobId, { ...result, extractionWarnings });
  await patchJobState(jobId, {
    status: 'completed',
    stage: 'done',
    resultUrl
  });

  await jobBlob.deleteJobIntermediates(jobId);
  logger.info('extract.job.complete', { jobId });
}

export async function extractionJobFail(jobId: string, message: string): Promise<void> {
  try {
    await patchJobState(jobId, { status: 'failed', stage: 'failed', error: message });
  } catch {
    /* ignore */
  }
  try {
    await jobBlob.deleteJobIntermediates(jobId);
  } catch {
    /* ignore */
  }
}
