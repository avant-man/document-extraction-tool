import { del, get, head, list, put } from '@vercel/blob';
import type { ExtractionJobState } from './types';

const PREFIX = 'extraction-jobs';

/** Reads: enough attempts to ride out intermittent Vercel Blob 403s on hot paths (poll + Inngest). */
const BLOB_GET_MAX_ATTEMPTS = 6;

/** Writes: patchJobState / putJobPages must not fail the whole step on a single transient 403. */
const BLOB_PUT_MAX_ATTEMPTS = 5;

function isTransientBlobError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /403|408|409|429|5\d\d|fetch|ECONNRESET|ETIMEDOUT|EAI_AGAIN|Timeout/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function publicReadOpts(token: string) {
  // Do not set useCache: false here: for public blobs the SDK still appends ?cache=0,
  // which can make the blob origin respond 400. useCache is only meaningful for private blobs.
  return { access: 'public' as const, token };
}

/** Read by known pathname (avoids list() truncation missing state.json, etc.). */
async function getBlobBodyUtf8(pathname: string, token: string): Promise<string | null> {
  for (let attempt = 1; attempt <= BLOB_GET_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await get(pathname, publicReadOpts(token));
      if (!res || res.statusCode !== 200 || !res.stream) return null;
      return (await streamToBuffer(res.stream as ReadableStream<Uint8Array>)).toString('utf8');
    } catch (err) {
      if (attempt < BLOB_GET_MAX_ATTEMPTS && isTransientBlobError(err)) {
        await sleep(Math.min(2000, 150 * 2 ** (attempt - 1)));
        continue;
      }
      throw err;
    }
  }
  return null;
}

async function getBlobBodyBuffer(pathname: string, token: string): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= BLOB_GET_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await get(pathname, publicReadOpts(token));
      if (!res || res.statusCode !== 200 || !res.stream) return null;
      return streamToBuffer(res.stream as ReadableStream<Uint8Array>);
    } catch (err) {
      if (attempt < BLOB_GET_MAX_ATTEMPTS && isTransientBlobError(err)) {
        await sleep(Math.min(2000, 150 * 2 ** (attempt - 1)));
        continue;
      }
      throw err;
    }
  }
  return null;
}

async function putBlobResilient(
  pathname: string,
  body: string | Buffer,
  token: string,
  contentType: string
): Promise<Awaited<ReturnType<typeof put>>> {
  const opts = jobPutOptions(token, contentType);
  for (let attempt = 1; attempt <= BLOB_PUT_MAX_ATTEMPTS; attempt++) {
    try {
      return await put(pathname, body, opts);
    } catch (err) {
      if (attempt < BLOB_PUT_MAX_ATTEMPTS && isTransientBlobError(err)) {
        await sleep(Math.min(2000, 150 * 2 ** (attempt - 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('putBlobResilient: exhausted attempts');
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.length) chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

function requireToken(): string {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for extraction jobs');
  }
  return t;
}

/** Stable pathnames per job; retries / step replays must overwrite. */
function jobPutOptions(token: string, contentType: string) {
  return {
    access: 'public' as const,
    addRandomSuffix: false as const,
    allowOverwrite: true,
    token,
    contentType
  };
}

export function jobPdfPathname(jobId: string): string {
  return `${PREFIX}/${jobId}/source.pdf`;
}

export function jobPagesPathname(jobId: string): string {
  return `${PREFIX}/${jobId}/pages.json`;
}

export function jobAnnotatedPathname(jobId: string): string {
  return `${PREFIX}/${jobId}/annotated.txt`;
}

export function jobRegexNumericsPathname(jobId: string): string {
  return `${PREFIX}/${jobId}/regexNumerics.json`;
}

export function jobStatePathname(jobId: string): string {
  return `${PREFIX}/${jobId}/state.json`;
}

export function jobPartialPathname(jobId: string, batchIndex: number): string {
  return `${PREFIX}/${jobId}/partials/batch-${batchIndex}.json`;
}

export function jobResultPathname(jobId: string): string {
  return `${PREFIX}/${jobId}/result.json`;
}

export async function putJobState(jobId: string, state: ExtractionJobState): Promise<void> {
  const token = requireToken();
  const pathname = jobStatePathname(jobId);
  await putBlobResilient(pathname, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }), token, 'application/json');
}

export async function getJobState(jobId: string): Promise<ExtractionJobState | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const text = await getBlobBodyUtf8(jobStatePathname(jobId), token);
  if (text == null) return null;
  return JSON.parse(text) as ExtractionJobState;
}

export async function putJobPages(jobId: string, pages: string[]): Promise<void> {
  const token = requireToken();
  await putBlobResilient(jobPagesPathname(jobId), JSON.stringify({ pages }), token, 'application/json');
}

export async function getJobPages(jobId: string): Promise<string[] | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const text = await getBlobBodyUtf8(jobPagesPathname(jobId), token);
  if (text == null) return null;
  const data = JSON.parse(text) as { pages?: string[] };
  return data.pages ?? null;
}

export async function putJobPdf(jobId: string, buffer: Buffer): Promise<string> {
  const token = requireToken();
  const blob = await putBlobResilient(jobPdfPathname(jobId), buffer, token, 'application/pdf');
  return blob.url;
}

export async function getJobPdfBuffer(jobId: string): Promise<Buffer | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  return getBlobBodyBuffer(jobPdfPathname(jobId), token);
}

export async function putAnnotatedAndRegex(
  jobId: string,
  annotatedText: string,
  regexEntries: [string, number][]
): Promise<void> {
  const token = requireToken();
  await putBlobResilient(jobAnnotatedPathname(jobId), annotatedText, token, 'text/plain; charset=utf-8');
  await putBlobResilient(jobRegexNumericsPathname(jobId), JSON.stringify({ entries: regexEntries }), token, 'application/json');
}

export async function getAnnotatedText(jobId: string): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  return getBlobBodyUtf8(jobAnnotatedPathname(jobId), token);
}

export async function getRegexNumericsMap(jobId: string): Promise<Map<string, number> | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const text = await getBlobBodyUtf8(jobRegexNumericsPathname(jobId), token);
  if (text == null) return null;
  const data = JSON.parse(text) as { entries?: [string, number][] };
  if (!data.entries) return new Map();
  return new Map(data.entries);
}

export async function putPartialBatch(jobId: string, batchIndex: number, jsonStr: string): Promise<void> {
  const token = requireToken();
  await putBlobResilient(jobPartialPathname(jobId, batchIndex), jsonStr, token, 'application/json');
}

export async function getPartialBatch(jobId: string, batchIndex: number): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  return getBlobBodyUtf8(jobPartialPathname(jobId, batchIndex), token);
}

export async function getJobResultJson(jobId: string): Promise<unknown | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const text = await getBlobBodyUtf8(jobResultPathname(jobId), token);
  if (text == null) return null;
  return JSON.parse(text) as unknown;
}

export async function putJobResult(jobId: string, body: unknown): Promise<string> {
  const token = requireToken();
  const blob = await putBlobResilient(jobResultPathname(jobId), JSON.stringify(body), token, 'application/json');
  return blob.url;
}

export async function deleteJobStateBlob(jobId: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  try {
    const meta = await head(jobStatePathname(jobId), { token });
    if (meta?.url) await del(meta.url, { token });
  } catch {
    /* ignore */
  }
}

/** Removes PDF, pages, annotated text, regex map, and Claude partials. Keeps state.json and result.json for GET /jobs until TTL or explicit cleanup. */
export async function deleteJobIntermediates(jobId: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  const { blobs } = await list({ prefix: `${PREFIX}/${jobId}/`, token, limit: 1000 });
  for (const b of blobs) {
    if (
      b.pathname.endsWith('/state.json') ||
      b.pathname.endsWith('/result.json') ||
      b.pathname.endsWith('state.json') ||
      b.pathname.endsWith('result.json')
    ) {
      continue;
    }
    try {
      await del(b.url, { token });
    } catch {
      /* ignore */
    }
  }
}
