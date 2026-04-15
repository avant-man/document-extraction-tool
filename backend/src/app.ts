import express from 'express';
import cors from 'cors';
import extractRouter from './routes/extract';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', extractRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

export default app;
