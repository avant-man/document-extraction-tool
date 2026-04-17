import {
  extractionJobAnnotateAndPlan,
  extractionJobClaudeBatchPart,
  extractionJobClaudeSingle,
  extractionJobFail,
  extractionJobFetchNative,
  extractionJobMergeAndValidate,
  extractionJobOcrChunk
} from '../extraction/pipeline';
import { logger } from '../lib/logger';
import { inngest } from './client';

export const extractionPipelineJob = inngest.createFunction(
  { id: 'extraction-pipeline', name: 'Watershed extraction pipeline', retries: 4 },
  { event: 'extraction/job.requested' },
  async ({ event, step, runId, attempt, maxAttempts }) => {
    const { jobId } = event.data as { jobId: string };

    logger.info('inngest.extraction.start', {
      stage: 'inngest_run',
      status: 'started',
      jobId,
      inngestRunId: runId,
      inngestEventId: event.id,
      inngestEventName: event.name,
      attempt,
      maxAttempts: maxAttempts ?? null
    });

    try {
      const ctx = await step.run('fetch-native', async () => extractionJobFetchNative(jobId));

      for (let i = 0; i < ctx.ocrChunksTotal; i++) {
        await step.run(`ocr-chunk-${i}`, async () => extractionJobOcrChunk(jobId, i));
      }

      const plan = await step.run('annotate-plan', async () => extractionJobAnnotateAndPlan(jobId));

      if (plan.useBatchedExtraction) {
        const batches = plan.batches;
        if (!batches?.length) {
          throw new Error('annotate-plan returned batched mode without batches array');
        }
        for (let i = 0; i < plan.batchCount; i++) {
          const pageNums = batches[i];
          if (!pageNums?.length) {
            throw new Error(`annotate-plan batch ${i} has no pages`);
          }
          await step.run(`claude-batch-${i}`, async () =>
            extractionJobClaudeBatchPart(jobId, i, { pageNums, totalBatches: batches.length })
          );
        }
      } else {
        await step.run('claude-single', async () => extractionJobClaudeSingle(jobId));
      }

      await step.run('merge-validate', async () => extractionJobMergeAndValidate(jobId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await extractionJobFail(jobId, msg);
      throw err;
    }
  }
);
