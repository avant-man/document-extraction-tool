import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  fetchPdfBuffer: vi.fn(),
  deleteBlobSafe: vi.fn(),
  extractTextFromBuffer: vi.fn(),
  extractWithClaude: vi.fn(),
}));

vi.mock('./services/blobService', () => ({
  fetchPdfBuffer: mocks.fetchPdfBuffer,
  deleteBlobSafe: mocks.deleteBlobSafe,
}));

vi.mock('./services/pdfService', () => ({
  extractTextFromBuffer: mocks.extractTextFromBuffer,
}));

vi.mock('./services/claudeService', () => ({
  extractWithClaude: mocks.extractWithClaude,
}));

import app from './app';

const minimalReportJson = JSON.stringify({
  summary: {
    watershedName: 'Test Watershed',
    planYear: 2024,
    totalGoals: 0,
    totalBMPs: 0,
    completionRate: 0,
    totalEstimatedCost: 0,
    geographicScope: 'local',
  },
  goals: [],
  bmps: [],
  implementation: [],
  monitoring: [],
  outreach: [],
  geographicAreas: [],
});

describe('app (HTTP integration)', () => {
  beforeEach(() => {
    mocks.fetchPdfBuffer.mockReset();
    mocks.deleteBlobSafe.mockReset();
    mocks.extractTextFromBuffer.mockReset();
    mocks.extractWithClaude.mockReset();

    mocks.fetchPdfBuffer.mockResolvedValue(Buffer.from('%PDF-1.4 minimal'));
    mocks.deleteBlobSafe.mockResolvedValue(undefined);
    mocks.extractTextFromBuffer.mockResolvedValue('plain text');
    mocks.extractWithClaude.mockResolvedValue(minimalReportJson);
  });

  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('POST /api/extract returns 200 with validated report when pipeline succeeds', async () => {
    const res = await request(app)
      .post('/api/extract')
      .send({ blobUrl: 'https://example.com/x.pdf' })
      .expect(200);

    expect(res.body.summary).toMatchObject({
      watershedName: 'Test Watershed',
      planYear: 2024,
      completionRateBasis: 'none',
    });
    expect(mocks.fetchPdfBuffer).toHaveBeenCalledWith('https://example.com/x.pdf');
  });

  it('POST /api/extract returns 400 when blobUrl is missing', async () => {
    const res = await request(app).post('/api/extract').send({}).expect(400);
    expect(res.body).toEqual({ error: 'blobUrl required' });
    expect(mocks.fetchPdfBuffer).not.toHaveBeenCalled();
  });

  it('POST /api/extract returns 400 when blobUrl is not https', async () => {
    const res = await request(app)
      .post('/api/extract')
      .send({ blobUrl: 'http://example.com/x.pdf' })
      .expect(400);
    expect(res.body).toEqual({ error: 'blobUrl must be an https URL' });
    expect(mocks.fetchPdfBuffer).not.toHaveBeenCalled();
  });

  it('POST /api/extract returns 502 when blob fetch fails', async () => {
    mocks.fetchPdfBuffer.mockRejectedValueOnce(new Error('network'));

    const res = await request(app)
      .post('/api/extract')
      .send({ blobUrl: 'https://example.com/x.pdf' })
      .expect(502);

    expect(res.body).toEqual({ error: 'Failed to fetch PDF from storage' });
  });
});
