export type AsyncExtractionEnvVar = 'BLOB_READ_WRITE_TOKEN' | 'INNGEST_EVENT_KEY';

export type AsyncExtractionEnvStatus = {
  /** True when both Blob and Inngest keys are set (trimmed non-empty). */
  ready: boolean;
  /** Env names that are missing for async jobs (`POST /api/extract/jobs`). */
  missing: AsyncExtractionEnvVar[];
};

export function getAsyncExtractionEnvStatus(): AsyncExtractionEnvStatus {
  const missing: AsyncExtractionEnvVar[] = [];
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    missing.push('BLOB_READ_WRITE_TOKEN');
  }
  if (!process.env.INNGEST_EVENT_KEY?.trim()) {
    missing.push('INNGEST_EVENT_KEY');
  }
  return { ready: missing.length === 0, missing };
}

/** Vercel sets `VERCEL=1` in serverless; sync `POST /api/extract` must not run there (use jobs + Inngest). */
export function isSyncPostExtractBlockedOnVercel(): boolean {
  return process.env.VERCEL === '1';
}
