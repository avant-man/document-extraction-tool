/**
 * Synchronous extraction: runs the full pipeline in one HTTP request.
 * Prefer `POST /api/extract/jobs` + poll for production and long PDFs (Vercel `maxDuration` caps a single invocation).
 * This route remains for integration tests and quick local runs.
 */
import { randomUUID } from 'crypto';
import { Router } from 'express';
import { fetchPdfBuffer, deleteBlobSafe } from '../services/blobService';
import { runSyncExtractionFromBuffer } from '../extraction/pipeline';
import { isSyncPostExtractBlockedOnVercel } from '../lib/asyncExtractionReadiness';
import { logger, runWithRequestContext } from '../lib/logger';
import { sanitizeBlobUrlForLog } from '../lib/sanitizeUrl';

const router = Router();

router.post('/extract', (req, res) => {
  const correlationId = randomUUID();
  return runWithRequestContext(correlationId, async () => {
    const requestStart = Date.now();

    if (isSyncPostExtractBlockedOnVercel()) {
      logger.warn('extract.sync_disabled_vercel', {
        stage: 'blocked',
        detail: 'POST /api/extract is disabled on Vercel; use POST /api/extract/jobs and poll GET /api/extract/jobs/:jobId'
      });
      return res.status(410).json({
        error:
          'Synchronous POST /api/extract is disabled on Vercel. Use POST /api/extract/jobs with { blobUrl, filename }, then poll GET /api/extract/jobs/:jobId until status is completed.',
        code: 'sync_extract_disabled_on_vercel',
        useAsyncPath: {
          createJob: 'POST /api/extract/jobs',
          pollJob: 'GET /api/extract/jobs/:jobId'
        }
      });
    }

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
    logger.info('extract.request', {
      stage: 'accepted',
      blobRef,
      route: 'sync_post_extract',
      hint: 'prefer POST /api/extract/jobs for production and long PDFs'
    });

    let buffer: Buffer;
    let blobFetchMs = 0;
    try {
      const tBlob = Date.now();
      buffer = await fetchPdfBuffer(blobUrl);
      blobFetchMs = Date.now() - tBlob;
      logger.info('extract.stage', {
        stage: 'blob_fetch',
        durationMs: blobFetchMs,
        byteLength: buffer.length,
        blobRef
      });
    } catch (err) {
      logger.error('extract.blob_fetch_failed', err, { stage: 'blob_fetch', blobRef });
      return res.status(502).json({ error: 'Failed to fetch PDF from storage' });
    }

    void deleteBlobSafe(blobUrl);

    try {
      const pipelineStarted = Date.now();
      const { report, extractionWarnings } = await runSyncExtractionFromBuffer(buffer);
      const pipelineDurationMs = Date.now() - pipelineStarted;
      logger.info('extract.complete', {
        durationMs: Date.now() - requestStart,
        pipelineDurationMs,
        blobFetchMs,
        status: 200
      });
      return res.json({ ...report, extractionWarnings });
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === 'document_text_exceeds_model_context') {
        const estimatedInputTokens =
          err && typeof err === 'object' && 'estimatedInputTokens' in err
            ? (err as { estimatedInputTokens?: number }).estimatedInputTokens
            : undefined;
        const budgetTokens =
          err && typeof err === 'object' && 'budgetTokens' in err
            ? (err as { budgetTokens?: number }).budgetTokens
            : undefined;
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
      const errMessage = err instanceof Error ? err.message : 'Extraction failed';
      logger.error('extract.pipeline_failed', err, { stage: 'pipeline' });
      return res.status(500).json({ error: errMessage });
    }
  });
});

export default router;
