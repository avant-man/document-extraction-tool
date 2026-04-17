import { Redis } from '@upstash/redis';
import { logger } from '../lib/logger';
import type { ExtractionJobState } from './types';

let redisSingleton: Redis | null = null;

function stateKey(jobId: string): string {
  return `extraction-job:${jobId}:state`;
}

/** Upstash Redis via Vercel Storage / Marketplace — same REST env as `@upstash/redis` `fromEnv()`. */
export function isJobStateKvMirrorConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function getRedis(): Redis | null {
  if (!isJobStateKvMirrorConfigured()) return null;
  if (!redisSingleton) {
    redisSingleton = Redis.fromEnv();
  }
  return redisSingleton;
}

/** Best-effort mirror after Blob `state.json` write so poll can read Redis instead of Blob. */
export async function mirrorJobStateToKv(jobId: string, state: ExtractionJobState): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(stateKey(jobId), JSON.stringify(state));
  } catch (err) {
    logger.warn('job_state.redis_mirror_set_failed', {
      jobId,
      message: err instanceof Error ? err.message : String(err)
    });
    try {
      await redis.del(stateKey(jobId));
    } catch {
      /* ignore */
    }
  }
}

export async function readJobStateFromKv(jobId: string): Promise<ExtractionJobState | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get<string>(stateKey(jobId));
  if (raw == null || raw === '') return null;
  try {
    return JSON.parse(raw) as ExtractionJobState;
  } catch {
    return null;
  }
}

export async function deleteJobStateKvMirror(jobId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(stateKey(jobId));
  } catch {
    /* ignore */
  }
}
