import { randomUUID } from 'crypto';
import { Router } from 'express';
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
import { logger, runWithRequestContext } from '../lib/logger';
import { sanitizeBlobUrlForLog } from '../lib/sanitizeUrl';
import {
  estimateClaudeExtractionInputTokens,
  getExtractionInputTokenBudget,
  isExtractionInputOverBudget
} from '../lib/tokenBudget';
import { detectSparsePageIndices, getSparseCharThreshold } from '../lib/sparsePages';
import { resolveSparseIndicesForOcr, sumNativeTrimmedLengths } from '../lib/ocrSparsePolicy';
import { buildExtractionWarnings } from '../lib/extractionWarnings';
import { applyOcrToSparsePages, getOcrEngineKind } from '../services/ocrService';

const router = Router();

router.post('/extract', (req, res) => {
  const correlationId = randomUUID();
  return runWithRequestContext(correlationId, async () => {
    const requestStart = Date.now();
    const { blobUrl } = req.body;

    if (!blobUrl || typeof blobUrl !== 'string') {
      logger.warn('extract.bad_request', { reason: 'blobUrl missing or not string' });
      return res.status(400).json({ error: 'blobUrl required' });
    }
    if (!blobUrl.startsWith('https://')) {
      logger.warn('extract.bad_request', { reason: 'blobUrl not https' });
      return res.status(400).json({ error: 'blobUrl must be an https URL' });
    }

    const blobRef = sanitizeBlobUrlForLog(blobUrl);
    logger.info('extract.request', { stage: 'accepted', blobRef });

    let buffer: Buffer;
    try {
      const tBlob = Date.now();
      buffer = await fetchPdfBuffer(blobUrl);
      logger.info('extract.stage', {
        stage: 'blob_fetch',
        durationMs: Date.now() - tBlob,
        byteLength: buffer.length,
        blobRef
      });
    } catch (err) {
      logger.error('extract.blob_fetch_failed', err, { stage: 'blob_fetch', blobRef });
      return res.status(502).json({ error: 'Failed to fetch PDF from storage' });
    }

    void deleteBlobSafe(blobUrl);

    try {
      const tPdf = Date.now();
      const { pages: nativePages, numPages } = await extractPagesFromBuffer(buffer);
      const nativeTotalTrimmedChars = sumNativeTrimmedLengths(nativePages);
      const sparseHeuristic = detectSparsePageIndices(nativePages);
      const ocrEngine = getOcrEngineKind();
      const { sparsePageIndices1Based: sparsePageIndices, autoGlobalSparseApplied } = resolveSparseIndicesForOcr(
        nativePages,
        ocrEngine,
        sparseHeuristic
      );
      const { pages: mergedPages, ocrAppliedToPages } = await applyOcrToSparsePages({
        pdfBuffer: buffer,
        pages: nativePages,
        sparsePageIndices1Based: sparsePageIndices,
        engine: ocrEngine
      });
      const rawText = joinPageTexts(mergedPages);
      logger.info('extract.stage', {
        stage: 'pdf',
        durationMs: Date.now() - tPdf,
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
      const numMarkers = (annotatedText.match(/\[NUM:/g) ?? []).length;
      logger.info('extract.stage', {
        stage: 'regex',
        durationMs: Date.now() - tRegex,
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
      logger.info('extract.preflight', {
        estimatedInputTokens,
        budgetTokens,
        pageCount: mergedPages.length,
        annotatedPageSlices: pageSlices.length,
        maxPagesPerBatch: Number.isFinite(maxPagesPerBatch) ? maxPagesPerBatch : null,
        ocrEngine,
        sparsePageIndices,
        ocrAppliedToPages,
        overBudget: overFullDoc,
        batchedDueToPageCap,
        useBatchedExtraction
      });

      let rawJson: string;
      const tClaude = Date.now();
      if (!useBatchedExtraction) {
        rawJson = await extractWithClaude(annotatedText, {
          estimatedInputTokens,
          pageCount: mergedPages.length,
          ocrEngine,
          ocrAppliedToPages,
          sparsePageIndices
        });
      } else {
        const batches = buildPageBatchesForClaude(WATERSHED_EXTRACTION_SYSTEM_PROMPT, pageSlices, budgetTokens);
        if (!batches) {
          logger.warn('extract.preflight_blocked', {
            reason: 'page_or_batch_limit',
            estimatedInputTokens,
            budgetTokens,
            blobRef
          });
          return res.status(413).json({
            error: 'document_text_exceeds_model_context',
            code: 'document_text_exceeds_model_context',
            estimatedInputTokens,
            budgetTokens,
            detail: 'no_batch_fits_token_budget_or_max_batches'
          });
        }

        logger.info('extract.batched', { batchCount: batches.length, pageSlices: pageSlices.length });

        const partials: ExtractedReport[] = [];
        for (let i = 0; i < batches.length; i++) {
          const pageNums = batches[i]!;
          const body = joinAnnotatedPagesForBatch(pageSlices, pageNums);
          const startP = Math.min(...pageNums);
          const endP = Math.max(...pageNums);
          const estBatch = estimateClaudeExtractionInputTokens(WATERSHED_EXTRACTION_SYSTEM_PROMPT, body);
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
          partials.push(JSON.parse(jsonStr) as ExtractedReport);
        }
        rawJson = JSON.stringify(mergePartialExtractions(partials));
      }
      logger.info('extract.stage', { stage: 'claude', durationMs: Date.now() - tClaude });

      const tVal = Date.now();
      const result = validate(rawJson, regexNumerics, rawText);
      logger.info('extract.stage', { stage: 'validate', durationMs: Date.now() - tVal });

      const extractionWarnings = buildExtractionWarnings({
        nativeTotalTrimmedChars,
        annotatedChars: annotatedText.length,
        ocrEngine,
        ocrAppliedToPages,
        autoGlobalSparseApplied
      });
      if (extractionWarnings.length > 0) {
        logger.info('extract.warnings', { warnings: extractionWarnings.map(w => w.code) });
        logger.info('extract.notices', {
          notices: extractionWarnings.map(({ code, message }) => ({ code, message }))
        });
      }

      logger.info('extract.complete', {
        durationMs: Date.now() - requestStart,
        status: 200
      });
      return res.json({ ...result, extractionWarnings });
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Extraction failed';
      logger.error('extract.pipeline_failed', err, { stage: 'pipeline' });
      return res.status(500).json({ error: errMessage });
    }
  });
});

export default router;
