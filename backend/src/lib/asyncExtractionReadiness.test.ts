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
    const s = getAsyncExtractionEnvStatus();
    expect(s.ready).toBe(true);
    expect(s.missing).toEqual([]);
    expect(s.jobStateKvMirror).toBe(false);
    expect(s.deployment.inngestSigningConfigured).toBe(false);
    expect(s.deployment.vercelHost).toBeNull();
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

  it('reports jobStateKvMirror when Upstash Redis REST env is set', () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'b');
    vi.stubEnv('INNGEST_EVENT_KEY', 'i');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok');
    const s = getAsyncExtractionEnvStatus();
    expect(s.jobStateKvMirror).toBe(true);
  });

  it('reports deployment hints from signing key and VERCEL_URL', () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'b');
    vi.stubEnv('INNGEST_EVENT_KEY', 'i');
    vi.stubEnv('INNGEST_SIGNING_KEY', 'sign');
    vi.stubEnv('VERCEL_URL', 'https://my-app.vercel.app');
    const s = getAsyncExtractionEnvStatus();
    expect(s.deployment.inngestSigningConfigured).toBe(true);
    expect(s.deployment.vercelHost).toBe('my-app.vercel.app');
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
