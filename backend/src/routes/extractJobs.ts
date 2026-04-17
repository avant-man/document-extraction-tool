import { randomUUID } from 'crypto';
import { Router } from 'express';
import { inngest } from '../inngest/client';
import { putJobState, getJobState, getJobResultJson, deleteJobStateBlob } from '../extraction/jobBlobStore';
import type { ExtractionJobState, JobProgress } from '../extraction/types';
import { getAsyncExtractionEnvStatus } from '../lib/asyncExtractionReadiness';
import { logger, runWithRequestContext } from '../lib/logger';
import { sanitizeBlobUrlForLog } from '../lib/sanitizeUrl';

const router = Router();

function computeProgress(state: ExtractionJobState): JobProgress {
  const ocrTotal = state.ocrChunkPlans?.length ?? 0;
  const ocrCur = state.ocrChunkCurrent ?? 0;
  const claudeTotal =
    state.batchCount != null && state.batchCount > 0
      ? state.batchCount
      : state.useBatchedExtraction === false
        ? 1
        : null;
  const claudeCur = state.claudeBatchCurrent ?? null;

  return {
    ocrChunk: ocrTotal > 0 ? ocrCur : null,
    ocrChunksTotal: ocrTotal > 0 ? ocrTotal : null,
    claudeBatch: claudeCur,
    claudeBatchesTotal: claudeTotal
  };
}

router.post('/extract/jobs', (req, res) => {
  const correlationId = randomUUID();
  return runWithRequestContext(correlationId, async () => {
    const { blobUrl, filename } = req.body as { blobUrl?: string; filename?: string };

    if (!blobUrl || typeof blobUrl !== 'string') {
      return res.status(400).json({ error: 'blobUrl required' });
    }
    if (!blobUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'blobUrl must be an https URL' });
    }

    const asyncEnv = getAsyncExtractionEnvStatus();
    if (asyncEnv.missing.includes('BLOB_READ_WRITE_TOKEN')) {
      return res.status(503).json({ error: 'BLOB_READ_WRITE_TOKEN is required for async extraction jobs' });
    }
    if (asyncEnv.missing.includes('INNGEST_EVENT_KEY')) {
      logger.warn('extract.jobs.no_inngest', { reason: 'INNGEST_EVENT_KEY missing' });
      return res.status(503).json({
        error: 'Async extraction requires INNGEST_EVENT_KEY (Inngest cloud) or run Inngest Dev locally with keys configured.'
      });
    }

    const jobId = randomUUID();
    const now = new Date().toISOString();
    const initial: ExtractionJobState = {
      jobId,
      status: 'queued',
      stage: 'queued',
      sourceBlobUrl: blobUrl,
      filename: typeof filename === 'string' ? filename : undefined,
      createdAt: now,
      updatedAt: now
    };

    try {
      await putJobState(jobId, initial);
    } catch (err) {
      logger.error('extract.jobs.state_write_failed', err);
      return res.status(500).json({ error: 'Failed to create extraction job' });
    }

    try {
      await inngest.send({
        name: 'extraction/job.requested',
        data: { jobId }
      });
    } catch (err) {
      logger.error('extract.jobs.inngest_send_failed', err);
      await deleteJobStateBlob(jobId);
      return res.status(502).json({ error: 'Failed to queue extraction job' });
    }

    logger.info('extract.jobs.accepted', {
      jobId,
      blobRef: sanitizeBlobUrlForLog(blobUrl)
    });

    return res.status(202).json({ jobId });
  });
});

router.get('/extract/jobs/:jobId', (req, res) => {
  const correlationId = randomUUID();
  return runWithRequestContext(correlationId, async () => {
    const { jobId } = req.params;
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ error: 'jobId required' });
    }

    const state = await getJobState(jobId);
    if (!state) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const progress = computeProgress(state);

    if (state.status === 'failed') {
      return res.status(200).json({
        jobId,
        status: 'failed',
        stage: 'failed',
        progress,
        error: state.error ?? 'Extraction failed',
        result: null
      });
    }

    if (state.status === 'completed' && state.stage === 'done') {
      const raw = await getJobResultJson(jobId);
      if (raw == null) {
        return res.status(500).json({ error: 'Job completed but result missing' });
      }
      return res.status(200).json({
        jobId,
        status: 'completed',
        stage: 'done',
        progress,
        result: raw
      });
    }

    return res.status(200).json({
      jobId,
      status: state.status,
      stage: state.stage,
      progress,
      result: null,
      error: null
    });
  });
});

export default router;
