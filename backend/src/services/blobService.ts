import { del, get } from '@vercel/blob';
import { logger } from '../lib/logger';
import { sanitizeBlobUrlForLog } from '../lib/sanitizeUrl';

async function readableStreamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
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

function nestedCause(err: unknown): unknown {
  if (err && typeof err === 'object' && 'cause' in err) {
    return (err as { cause: unknown }).cause;
  }
  return undefined;
}

function formatBlobGetError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const cause = nestedCause(err);
  const causeStr =
    cause instanceof Error
      ? cause.message
      : cause !== undefined
        ? String(cause)
        : '';
  return causeStr ? `${msg} (cause: ${causeStr})` : msg;
}

export async function fetchPdfBuffer(blobUrl: string): Promise<Buffer> {
  let result;
  try {
    result = await get(blobUrl, { access: 'public' });
  } catch (err) {
    throw new Error(`Blob get failed: ${formatBlobGetError(err)}`);
  }
  if (!result || result.statusCode !== 200 || !result.stream) {
    const detail = result ? `status ${result.statusCode}` : 'not found';
    throw new Error(`Blob get failed: ${detail}`);
  }
  try {
    return await readableStreamToBuffer(result.stream);
  } catch (err) {
    throw new Error(`Blob get failed: ${formatBlobGetError(err)}`);
  }
}

export async function deleteBlobSafe(blobUrl: string): Promise<void> {
  const blobRef = sanitizeBlobUrlForLog(blobUrl);
  try {
    await del(blobUrl);
  } catch (err) {
    logger.warn('blob.delete_failed', { blobRef, errMessage: err instanceof Error ? err.message : String(err) });
  }
}
