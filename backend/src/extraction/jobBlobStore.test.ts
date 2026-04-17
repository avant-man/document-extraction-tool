import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGet = vi.fn();
const mockHead = vi.fn();

vi.mock('@vercel/blob', () => ({
  del: vi.fn(),
  get: (...args: unknown[]) => mockGet(...args),
  head: (...args: unknown[]) => mockHead(...args),
  list: vi.fn(),
  put: vi.fn()
}));

vi.mock('../lib/logger', () => ({
  logger: {
    error: vi.fn()
  }
}));

import { logger } from '../lib/logger';
import { getJobState, jobStatePathname } from './jobBlobStore';

describe('jobBlobStore', () => {
  const prevToken = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(() => {
    mockGet.mockReset();
    mockHead.mockReset();
    vi.mocked(logger.error).mockReset();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
  });

  afterEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = prevToken;
  });

  it('getJobState uses head then public URL get when head returns url', async () => {
    const state = { jobId: 'job-1', status: 'running' as const, stage: 'claude' as const };
    const json = JSON.stringify(state);
    const enc = new TextEncoder();
    const publicUrl = 'https://store.public.blob.vercel-storage.com/extraction-jobs/job-1/state.json';

    mockHead.mockResolvedValue({ url: publicUrl });
    mockGet.mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(enc.encode(json));
          controller.close();
        }
      })
    });

    const out = await getJobState('job-1');
    expect(out).toEqual(state);
    expect(mockHead).toHaveBeenCalledTimes(1);
    expect(mockHead).toHaveBeenCalledWith(jobStatePathname('job-1'), { token: 'test-token' });
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(publicUrl, { access: 'public' });
  });

  it('getJobState falls back to pathname+token when public get returns non-200', async () => {
    const state = { jobId: 'job-1', status: 'running' as const, stage: 'ocr' as const };
    const json = JSON.stringify(state);
    const enc = new TextEncoder();
    const publicUrl = 'https://store.public.blob.vercel-storage.com/extraction-jobs/job-1/state.json';
    const pathname = jobStatePathname('job-1');

    mockHead.mockResolvedValue({ url: publicUrl });
    mockGet
      .mockResolvedValueOnce({ statusCode: 404, stream: null })
      .mockResolvedValueOnce({
        statusCode: 200,
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(enc.encode(json));
            controller.close();
          }
        })
      });

    const out = await getJobState('job-1');
    expect(out).toEqual(state);
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet).toHaveBeenNthCalledWith(1, publicUrl, { access: 'public' });
    expect(mockGet).toHaveBeenNthCalledWith(2, pathname, {
      access: 'public',
      token: 'test-token'
    });
  });

  it('getJobState returns null when token missing', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const out = await getJobState('job-1');
    expect(out).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockHead).not.toHaveBeenCalled();
  });

  it('getJobState retries transient blob read failures then succeeds', async () => {
    const state = { jobId: 'job-1', status: 'running' as const, stage: 'ocr' as const };
    const json = JSON.stringify(state);
    const enc = new TextEncoder();
    const okStream = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode(json));
        controller.close();
      }
    });
    const publicUrl = 'https://store.public.blob.vercel-storage.com/extraction-jobs/job-1/state.json';
    mockHead.mockResolvedValue({ url: publicUrl });
    mockGet
      .mockRejectedValueOnce(new Error('Vercel Blob: Failed to fetch blob: 403 Forbidden'))
      .mockRejectedValueOnce(new Error('Vercel Blob: Failed to fetch blob: 403 Forbidden'))
      .mockResolvedValueOnce({
        statusCode: 200,
        stream: okStream
      });

    const out = await getJobState('job-1');
    expect(out).toEqual(state);
    expect(mockGet).toHaveBeenCalledTimes(3);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('getJobState logs blob.job_read_exhausted when all attempts fail', async () => {
    const err = new Error('Vercel Blob: Failed to fetch blob: 403 Forbidden');
    mockHead.mockResolvedValue({ url: 'https://store.public.blob.vercel-storage.com/x' });
    mockGet.mockRejectedValue(err);

    await expect(getJobState('job-1')).rejects.toThrow(err);
    expect(logger.error).toHaveBeenCalledWith(
      'blob.job_read_exhausted',
      err,
      expect.objectContaining({
        readKind: 'utf8',
        headHadUrl: true,
        publicUrlGetSucceeded: false,
        headThrew: false
      })
    );
  });
});
