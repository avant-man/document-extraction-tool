import { randomUUID } from 'crypto';
import { Router } from 'express';
import { fetchPdfBuffer, deleteBlobSafe } from '../services/blobService';
import { extractTextFromBuffer } from '../services/pdfService';
import { annotateText } from '../services/regexParser';
import { extractWithClaude } from '../services/claudeService';
import { validate } from '../services/validator';
import { logger, runWithRequestContext } from '../lib/logger';
import { sanitizeBlobUrlForLog } from '../lib/sanitizeUrl';

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
      const rawText = await extractTextFromBuffer(buffer);
      logger.info('extract.stage', { stage: 'pdf', durationMs: Date.now() - tPdf });

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

      const tClaude = Date.now();
      const rawJson = await extractWithClaude(annotatedText);
      logger.info('extract.stage', { stage: 'claude', durationMs: Date.now() - tClaude });

      const tVal = Date.now();
      const result = validate(rawJson, regexNumerics, rawText);
      logger.info('extract.stage', { stage: 'validate', durationMs: Date.now() - tVal });

      logger.info('extract.complete', {
        durationMs: Date.now() - requestStart,
        status: 200
      });
      return res.json(result);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Extraction failed';
      logger.error('extract.pipeline_failed', err, { stage: 'pipeline' });
      return res.status(500).json({ error: errMessage });
    }
  });
});

export default router;
