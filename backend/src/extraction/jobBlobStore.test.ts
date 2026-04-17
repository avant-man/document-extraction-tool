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

import { getJobState, jobStatePathname } from './jobBlobStore';

describe('jobBlobStore', () => {
  const prevToken = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(() => {
    mockGet.mockReset();
    mockHead.mockReset();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
  });

  afterEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = prevToken;
  });

  it('getJobState reads by pathname with public access', async () => {
    const state = { jobId: 'job-1', status: 'running' as const, stage: 'claude' as const };
    const json = JSON.stringify(state);
    const enc = new TextEncoder();
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
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(jobStatePathname('job-1'), {
      access: 'public',
      token: 'test-token'
    });
  });

  it('getJobState returns null when token missing', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const out = await getJobState('job-1');
    expect(out).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
