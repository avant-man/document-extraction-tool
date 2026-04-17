import {
  extractionJobAnnotateAndPlan,
  extractionJobClaudeBatchPart,
  extractionJobClaudeSingle,
  extractionJobFail,
  extractionJobFetchNative,
  extractionJobMergeAndValidate,
  extractionJobOcrChunk
} from '../extraction/pipeline';
import { inngest } from './client';

export const extractionPipelineJob = inngest.createFunction(
  { id: 'extraction-pipeline', name: 'Watershed extraction pipeline', retries: 1 },
  { event: 'extraction/job.requested' },
  async ({ event, step }) => {
    const { jobId } = event.data as { jobId: string };

    try {
      const ctx = await step.run('fetch-native', async () => extractionJobFetchNative(jobId));

      for (let i = 0; i < ctx.ocrChunksTotal; i++) {
        await step.run(`ocr-chunk-${i}`, async () => extractionJobOcrChunk(jobId, i));
      }

      const plan = await step.run('annotate-plan', async () => extractionJobAnnotateAndPlan(jobId));

      if (plan.useBatchedExtraction) {
        for (let i = 0; i < plan.batchCount; i++) {
          await step.run(`claude-batch-${i}`, async () => extractionJobClaudeBatchPart(jobId, i));
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
