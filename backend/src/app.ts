import express from 'express';
import cors from 'cors';
import extractRouter from './routes/extract';
import blobUploadRouter from './routes/blobUpload';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', extractRouter);
app.use('/api', blobUploadRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

export default app;
