import express from 'express';
import cors from 'cors';
import { serve } from 'inngest/express';
import extractRouter from './routes/extract';
import extractJobsRouter from './routes/extractJobs';
import blobUploadRouter from './routes/blobUpload';
import { inngest } from './inngest/client';
import { extractionPipelineJob } from './inngest/extractionJob';
import { getAsyncExtractionEnvStatus } from './lib/asyncExtractionReadiness';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (_req, res) => {
  const asyncExtraction = getAsyncExtractionEnvStatus();
  res.json({ ok: true, asyncExtraction });
});
app.use('/api/inngest', serve({ client: inngest, functions: [extractionPipelineJob] }));
app.use('/api', extractRouter);
app.use('/api', extractJobsRouter);
app.use('/api', blobUploadRouter);

export default app;
