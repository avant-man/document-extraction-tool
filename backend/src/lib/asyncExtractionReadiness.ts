export type AsyncExtractionEnvVar = 'BLOB_READ_WRITE_TOKEN' | 'INNGEST_EVENT_KEY';

export type AsyncExtractionEnvStatus = {
  /** True when both Blob and Inngest keys are set (trimmed non-empty). */
  ready: boolean;
  /** Env names that are missing for async jobs (`POST /api/extract/jobs`). */
  missing: AsyncExtractionEnvVar[];
  /**
   * When true, `GET /api/extract/jobs/:id` prefers an Upstash Redis mirror written on each `putJobState`
   * (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, e.g. Vercel Redis integration). Pipeline steps still read Blob.
   */
  jobStateKvMirror: boolean;
  /** Helps verify Inngest sync URL matches this deployment and signing is configured. */
  deployment: {
    inngestSigningConfigured: boolean;
    /** `VERCEL_URL` host without scheme (e.g. `project.vercel.app`). Undefined outside Vercel. */
    vercelHost: string | null;
  };
};

function jobStateKvMirrorConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

export function getAsyncExtractionEnvStatus(): AsyncExtractionEnvStatus {
  const missing: AsyncExtractionEnvVar[] = [];
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    missing.push('BLOB_READ_WRITE_TOKEN');
  }
  if (!process.env.INNGEST_EVENT_KEY?.trim()) {
    missing.push('INNGEST_EVENT_KEY');
  }
  const vercelUrl = process.env.VERCEL_URL?.trim();
  return {
    ready: missing.length === 0,
    missing,
    jobStateKvMirror: jobStateKvMirrorConfigured(),
    deployment: {
      inngestSigningConfigured: Boolean(process.env.INNGEST_SIGNING_KEY?.trim()),
      vercelHost: vercelUrl && vercelUrl.length > 0 ? vercelUrl.replace(/^https?:\/\//i, '') : null
    }
  };
}

/** Vercel sets `VERCEL=1` in serverless; sync `POST /api/extract` must not run there (use jobs + Inngest). */
export function isSyncPostExtractBlockedOnVercel(): boolean {
  return process.env.VERCEL === '1';
}
