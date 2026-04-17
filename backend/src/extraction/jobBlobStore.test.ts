import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGet = vi.fn();
const mockHead = vi.fn();

const redisStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn()
}));

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => redisStore
  }
}));

vi.mock('@vercel/blob', () => ({
  del: vi.fn(),
  get: (...args: unknown[]) => mockGet(...args),
  head: (...args: unknown[]) => mockHead(...args),
  list: vi.fn(),
  put: vi.fn()
}));

vi.mock('../lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn()
  }
}));

import { logger } from '../lib/logger';
import { getJobState, getJobStateForPoll, jobStatePathname } from './jobBlobStore';

describe('jobBlobStore', () => {
  const prevToken = process.env.BLOB_READ_WRITE_TOKEN;
  const prevUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const prevUpstashTok = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    mockGet.mockReset();
    mockHead.mockReset();
    redisStore.get.mockReset();
    redisStore.set.mockReset();
    redisStore.del.mockReset();
    vi.mocked(logger.error).mockReset();
    vi.mocked(logger.warn).mockReset();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = prevToken;
    if (prevUpstashUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = prevUpstashUrl;
    if (prevUpstashTok === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = prevUpstashTok;
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

  it('getJobStateForPoll uses Upstash when configured and skips Blob read', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'secret';
    const state = { jobId: 'job-1', status: 'running' as const, stage: 'ocr' as const };
    redisStore.get.mockResolvedValue(JSON.stringify(state));

    const out = await getJobStateForPoll('job-1');
    expect(out).toEqual(state);
    expect(redisStore.get).toHaveBeenCalledWith('extraction-job:job-1:state');
    expect(mockHead).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('getJobStateForPoll falls back to Blob when Redis returns null', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'secret';
    redisStore.get.mockResolvedValue(null);
    const state = { jobId: 'job-1', status: 'queued' as const, stage: 'queued' as const };
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

    const out = await getJobStateForPoll('job-1');
    expect(out).toEqual(state);
    expect(mockHead).toHaveBeenCalled();
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
