import { randomUUID } from 'crypto';
import { Router } from 'express';
import { inngest } from '../inngest/client';
import { putJobState, getJobState, getJobResultJson, deleteJobStateBlob } from '../extraction/jobBlobStore';
import type { ExtractionJobState, JobProgress } from '../extraction/types';
import { getAsyncExtractionEnvStatus } from '../lib/asyncExtractionReadiness';
import { logger, runWithRequestContext } from '../lib/logger';
import { sanitizeBlobUrlForLog } from '../lib/sanitizeUrl';

const router = Router();

/** Blob RMW races can leave `stage` as `ocr` while `claudeBatchCurrent` advances; normalize for poll UX. */
function resolvePollStage(state: ExtractionJobState): string {
  const s = state.stage;
  if (s === 'done' || s === 'failed' || s === 'merging') return s;
  if ((state.claudeBatchCurrent ?? 0) > 0) return 'claude';
  return s;
}

function computeProgress(state: ExtractionJobState): JobProgress {
  const ocrTotal = state.ocrChunkPlans?.length ?? 0;
  const ocrCur = state.ocrChunkCurrent ?? 0;
  const batchFromCount = state.batchCount != null && state.batchCount > 0 ? state.batchCount : 0;
  const batchFromBatches = state.batches?.length ?? 0;
  const effectiveBatchTotal = Math.max(batchFromCount, batchFromBatches);
  const claudeCur = state.claudeBatchCurrent ?? null;
  let claudeTotal: number | null =
    effectiveBatchTotal > 0
      ? effectiveBatchTotal
      : state.useBatchedExtraction === false
        ? 1
        : null;
  if (claudeTotal == null && (claudeCur ?? 0) > 0) {
    claudeTotal = Math.max(claudeCur ?? 0, 1);
  }

  return {
    ocrChunk: ocrTotal > 0 ? ocrCur : null,
    ocrChunksTotal: ocrTotal > 0 ? ocrTotal : null,
    claudeBatch: claudeCur,
    claudeBatchesTotal: claudeTotal
  };
}

router.post('/extract/jobs', (req, res, next) => {
  const correlationId = randomUUID();
  runWithRequestContext(correlationId, async () => {
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
      blobRef: sanitizeBlobUrlForLog(blobUrl),
      inngestStatus: 'event_queued',
      inngestEvent: 'extraction/job.requested'
    });

    return res.status(202).json({ jobId });
  }).catch(next);
});

router.get('/extract/jobs/:jobId', (req, res, next) => {
  const correlationId = randomUUID();
  runWithRequestContext(correlationId, async () => {
    const { jobId } = req.params;
    if (!jobId || typeof jobId !== 'string') {
      res.status(400).json({ error: 'jobId required' });
      return;
    }

    try {
      let state: ExtractionJobState | null;
      try {
        state = await getJobState(jobId);
      } catch (err) {
        if (err instanceof SyntaxError) {
          logger.error('extract.jobs.job_state_corrupt', err, { jobId });
          res.status(500).json({ error: 'Invalid job state data' });
          return;
        }
        logger.error('extract.jobs.get_state_failed', err, { jobId });
        res.status(503).json({
          error: 'Temporary failure reading job status.',
          retryable: true
        });
        return;
      }

      if (!state) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      const progress = computeProgress(state);

      if (state.status === 'failed') {
        res.status(200).json({
          jobId,
          status: 'failed',
          stage: 'failed',
          progress,
          error: state.error ?? 'Extraction failed',
          result: null
        });
        return;
      }

      if (state.status === 'completed' && state.stage === 'done') {
        let raw: unknown | null;
        try {
          raw = await getJobResultJson(jobId);
        } catch (err) {
          logger.error('extract.jobs.get_result_failed', err, { jobId });
          res.status(503).json({
            error: 'Temporary failure reading job result.',
            retryable: true
          });
          return;
        }
        if (raw == null) {
          res.status(500).json({ error: 'Job completed but result missing' });
          return;
        }
        res.status(200).json({
          jobId,
          status: 'completed',
          stage: 'done',
          progress,
          result: raw
        });
        return;
      }

      const pollStage = resolvePollStage(state);
      res.status(200).json({
        jobId,
        status: state.status,
        stage: pollStage,
        progress,
        result: null,
        error: null
      });
    } catch (err) {
      if (err instanceof SyntaxError) {
        logger.error('extract.jobs.job_state_parse_failed', err, { jobId });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Invalid job state data' });
        }
        return;
      }
      logger.error('extract.jobs.poll_unexpected', err, { jobId });
      if (!res.headersSent) {
        res.status(503).json({
          error: 'Unexpected error loading job.',
          retryable: true
        });
      }
    }
  }).catch(err => {
    logger.error('extract.jobs.poll_rejected', err, { jobId: req.params.jobId });
    if (!res.headersSent) {
      res.status(503).json({
        error: 'Temporary failure loading job.',
        retryable: true
      });
    } else {
      next(err);
    }
  });
});

export default router;
