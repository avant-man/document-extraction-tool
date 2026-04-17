import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getAsyncExtractionEnvStatus,
  isSyncPostExtractBlockedOnVercel
} from './asyncExtractionReadiness';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getAsyncExtractionEnvStatus', () => {
  it('reports ready when both vars are non-empty', () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'blob-token');
    vi.stubEnv('INNGEST_EVENT_KEY', 'inngest-key');
    expect(getAsyncExtractionEnvStatus()).toEqual({ ready: true, missing: [] });
  });

  it('treats whitespace-only as missing', () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '   ');
    vi.stubEnv('INNGEST_EVENT_KEY', 'x');
    const s = getAsyncExtractionEnvStatus();
    expect(s.ready).toBe(false);
    expect(s.missing).toContain('BLOB_READ_WRITE_TOKEN');
  });

  it('lists all missing when unset', () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    vi.stubEnv('INNGEST_EVENT_KEY', '');
    const s = getAsyncExtractionEnvStatus();
    expect(s.ready).toBe(false);
    expect(s.missing).toEqual(
      expect.arrayContaining(['BLOB_READ_WRITE_TOKEN', 'INNGEST_EVENT_KEY'])
    );
    expect(s.missing.length).toBe(2);
  });
});

describe('isSyncPostExtractBlockedOnVercel', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is false when VERCEL is unset', () => {
    expect(isSyncPostExtractBlockedOnVercel()).toBe(false);
  });

  it('is true when VERCEL is 1', () => {
    vi.stubEnv('VERCEL', '1');
    expect(isSyncPostExtractBlockedOnVercel()).toBe(true);
  });
});
