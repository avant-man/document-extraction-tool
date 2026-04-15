import { del } from '@vercel/blob';

export async function fetchPdfBuffer(blobUrl: string): Promise<Buffer> {
  const response = await fetch(blobUrl);
  if (!response.ok) throw new Error(`Blob fetch failed: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteBlobSafe(blobUrl: string): Promise<void> {
  try { await del(blobUrl); } catch { /* best-effort cleanup */ }
}
