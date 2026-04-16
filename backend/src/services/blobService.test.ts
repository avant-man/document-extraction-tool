import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
vi.mock('@vercel/blob', () => ({
  del: vi.fn(),
  get: (...args: unknown[]) => mockGet(...args),
}));

import { fetchPdfBuffer } from './blobService';

describe('fetchPdfBuffer', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('returns buffer from blob get stream', async () => {
    const data = new Uint8Array([1, 2, 3]);
    mockGet.mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      }),
    });

    const buf = await fetchPdfBuffer('https://x.public.blob.vercel-storage.com/f.pdf');
    expect(buf.equals(Buffer.from([1, 2, 3]))).toBe(true);
    expect(mockGet).toHaveBeenCalledWith('https://x.public.blob.vercel-storage.com/f.pdf', {
      access: 'public',
    });
  });

  it('throws when get returns non-200', async () => {
    mockGet.mockResolvedValue({
      statusCode: 404,
      stream: null,
    });
    await expect(fetchPdfBuffer('https://x')).rejects.toThrow('Blob get failed: status 404');
  });

  it('throws when get returns null', async () => {
    mockGet.mockResolvedValue(null);
    await expect(fetchPdfBuffer('https://x')).rejects.toThrow('Blob get failed: not found');
  });
});
