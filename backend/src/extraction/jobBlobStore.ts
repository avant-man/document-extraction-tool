import { del, get, list, put } from '@vercel/blob';
import type { ExtractionJobState } from './types';

const PREFIX = 'extraction-jobs';

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
  await put(pathname, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }), {
    access: 'public',
    addRandomSuffix: false,
    token,
    contentType: 'application/json'
  });
}

export async function getJobState(jobId: string): Promise<ExtractionJobState | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const { blobs } = await list({ prefix: `${PREFIX}/${jobId}/`, token, limit: 50 });
  const meta = blobs.find(b => b.pathname.endsWith('/state.json') || b.pathname.endsWith('state.json'));
  if (!meta?.url) return null;
  const res = await get(meta.url, { access: 'public', token });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  const text = (await streamToBuffer(res.stream as ReadableStream<Uint8Array>)).toString('utf8');
  return JSON.parse(text) as ExtractionJobState;
}

export async function putJobPages(jobId: string, pages: string[]): Promise<void> {
  const token = requireToken();
  await put(jobPagesPathname(jobId), JSON.stringify({ pages }), {
    access: 'public',
    addRandomSuffix: false,
    token,
    contentType: 'application/json'
  });
}

export async function getJobPages(jobId: string): Promise<string[] | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const { blobs } = await list({ prefix: `${PREFIX}/${jobId}/`, token, limit: 50 });
  const f = blobs.find(b => b.pathname.endsWith('/pages.json'));
  if (!f?.url) return null;
  const res = await get(f.url, { access: 'public', token });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  const text = (await streamToBuffer(res.stream as ReadableStream<Uint8Array>)).toString('utf8');
  const data = JSON.parse(text) as { pages?: string[] };
  return data.pages ?? null;
}

export async function putJobPdf(jobId: string, buffer: Buffer): Promise<string> {
  const token = requireToken();
  const blob = await put(jobPdfPathname(jobId), buffer, {
    access: 'public',
    addRandomSuffix: false,
    token,
    contentType: 'application/pdf'
  });
  return blob.url;
}

export async function getJobPdfBuffer(jobId: string): Promise<Buffer | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const { blobs } = await list({ prefix: `${PREFIX}/${jobId}/`, token, limit: 50 });
  const f = blobs.find(b => b.pathname.endsWith('/source.pdf'));
  if (!f?.url) return null;
  const res = await get(f.url, { access: 'public', token });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return streamToBuffer(res.stream as ReadableStream<Uint8Array>);
}

export async function putAnnotatedAndRegex(
  jobId: string,
  annotatedText: string,
  regexEntries: [string, number][]
): Promise<void> {
  const token = requireToken();
  await put(jobAnnotatedPathname(jobId), annotatedText, {
    access: 'public',
    addRandomSuffix: false,
    token,
    contentType: 'text/plain; charset=utf-8'
  });
  await put(jobRegexNumericsPathname(jobId), JSON.stringify({ entries: regexEntries }), {
    access: 'public',
    addRandomSuffix: false,
    token,
    contentType: 'application/json'
  });
}

export async function getAnnotatedText(jobId: string): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const { blobs } = await list({ prefix: `${PREFIX}/${jobId}/`, token, limit: 50 });
  const f = blobs.find(b => b.pathname.endsWith('/annotated.txt'));
  if (!f?.url) return null;
  const res = await get(f.url, { access: 'public', token });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return (await streamToBuffer(res.stream as ReadableStream<Uint8Array>)).toString('utf8');
}

export async function getRegexNumericsMap(jobId: string): Promise<Map<string, number> | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const { blobs } = await list({ prefix: `${PREFIX}/${jobId}/`, token, limit: 50 });
  const f = blobs.find(b => b.pathname.endsWith('/regexNumerics.json'));
  if (!f?.url) return null;
  const res = await get(f.url, { access: 'public', token });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  const text = (await streamToBuffer(res.stream as ReadableStream<Uint8Array>)).toString('utf8');
  const data = JSON.parse(text) as { entries?: [string, number][] };
  if (!data.entries) return new Map();
  return new Map(data.entries);
}

export async function putPartialBatch(jobId: string, batchIndex: number, jsonStr: string): Promise<void> {
  const token = requireToken();
  await put(jobPartialPathname(jobId, batchIndex), jsonStr, {
    access: 'public',
    addRandomSuffix: false,
    token,
    contentType: 'application/json'
  });
}

export async function getPartialBatch(jobId: string, batchIndex: number): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const pathname = jobPartialPathname(jobId, batchIndex);
  const { blobs } = await list({ prefix: `${PREFIX}/${jobId}/partials/`, token, limit: 100 });
  const f = blobs.find(b => b.pathname === pathname || b.pathname.endsWith(`batch-${batchIndex}.json`));
  if (!f?.url) return null;
  const res = await get(f.url, { access: 'public', token });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return (await streamToBuffer(res.stream as ReadableStream<Uint8Array>)).toString('utf8');
}

export async function getJobResultJson(jobId: string): Promise<unknown | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const { blobs } = await list({ prefix: `${PREFIX}/${jobId}/`, token, limit: 50 });
  const f = blobs.find(b => b.pathname.endsWith('/result.json'));
  if (!f?.url) return null;
  const res = await get(f.url, { access: 'public', token });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  const text = (await streamToBuffer(res.stream as ReadableStream<Uint8Array>)).toString('utf8');
  return JSON.parse(text) as unknown;
}

export async function putJobResult(jobId: string, body: unknown): Promise<string> {
  const token = requireToken();
  const blob = await put(jobResultPathname(jobId), JSON.stringify(body), {
    access: 'public',
    addRandomSuffix: false,
    token,
    contentType: 'application/json'
  });
  return blob.url;
}

export async function deleteJobStateBlob(jobId: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  const { blobs } = await list({ prefix: `${PREFIX}/${jobId}/`, token, limit: 50 });
  const meta = blobs.find(b => b.pathname.endsWith('/state.json') || b.pathname.endsWith('state.json'));
  if (meta?.url) {
    try {
      await del(meta.url, { token });
    } catch {
      /* ignore */
    }
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
