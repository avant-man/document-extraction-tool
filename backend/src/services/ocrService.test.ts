import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTesseractWorkerCreateOptions } from './ocrService';

describe('getTesseractWorkerCreateOptions', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns local worker script and CDN core on Vercel', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('TESSERACT_DISABLE_CDN', '');
    const o = getTesseractWorkerCreateOptions();
    expect(o?.corePath).toContain('tesseract.js-core@5.1.1');
    expect(o?.workerPath).toContain('worker-script');
    expect(o?.workerPath).not.toMatch(/^https?:\/\//);
  });

  it('returns CDN core when VERCEL is any non-empty value', () => {
    vi.stubEnv('VERCEL', 'true');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('TESSERACT_DISABLE_CDN', '');
    expect(getTesseractWorkerCreateOptions()?.corePath).toContain('jsdelivr');
  });

  it('returns CDN core when VERCEL_ENV is set without VERCEL', () => {
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('TESSERACT_DISABLE_CDN', '');
    expect(getTesseractWorkerCreateOptions()?.corePath).toContain('jsdelivr');
  });

  it('returns undefined locally when no flags', () => {
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('TESSERACT_USE_CDN', '');
    expect(getTesseractWorkerCreateOptions()).toBeUndefined();
  });

  it('respects TESSERACT_DISABLE_CDN on Vercel', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('TESSERACT_DISABLE_CDN', '1');
    expect(getTesseractWorkerCreateOptions()).toBeUndefined();
  });

  it('allows TESSERACT_USE_CDN without VERCEL', () => {
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('TESSERACT_USE_CDN', '1');
    expect(getTesseractWorkerCreateOptions()?.corePath).toContain('jsdelivr');
  });
});
