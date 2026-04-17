import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { isBlankEnv } from '../lib/stringUtils';

const nodeRequire = createRequire(__filename);

const DEFAULT_RENDER_SCALE = 1.75;

export function getPdfRenderScale(): number {
  const raw = process.env.OCR_RENDER_SCALE;
  if (isBlankEnv(raw)) return DEFAULT_RENDER_SCALE;
  const n = Number.parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 && n <= 4 ? n : DEFAULT_RENDER_SCALE;
}

/**
 * Rasterize a single PDF page to PNG bytes (for OCR).
 * Uses the document's `canvasFactory` so pdf.js internal drawImage/compositing
 * only sees @napi-rs `CanvasElement` instances from the same factory (mixing
 * ad-hoc `createCanvas()` with the transport factory caused napi drawImage errors).
 */
export async function renderPdfPageToPngBuffer(
  pdfBuffer: Buffer,
  pageNumber1Based: number,
  scale = getPdfRenderScale()
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  try {
    const workerSrc = pathToFileURL(nodeRequire.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    }
  } catch {
    /* leave default; worker may still resolve via bundler includeFiles */
  }
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    isEvalSupported: false
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdf: any;
  try {
    pdf = await loadingTask.promise;
  } catch (e) {
    await loadingTask.destroy().catch(() => undefined);
    throw e;
  }

  try {
    if (pageNumber1Based < 1 || pageNumber1Based > pdf.numPages) {
      throw new Error(`renderPdfPageToPngBuffer: page ${pageNumber1Based} out of range 1..${pdf.numPages}`);
    }

    const page = await pdf.getPage(pageNumber1Based);
    const viewport = page.getViewport({ scale });
    const w = Math.max(1, Math.floor(viewport.width));
    const h = Math.max(1, Math.floor(viewport.height));

    const canvasFactory = pdf.canvasFactory;
    const canvasEntry = canvasFactory.create(w, h);
    const { canvas, context } = canvasEntry;

    try {
      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
        annotationMode: pdfjs.AnnotationMode.DISABLE
      }).promise;
      return canvas.toBuffer('image/png') as Buffer;
    } finally {
      canvasFactory.destroy(canvasEntry);
    }
  } finally {
    await pdf.destroy().catch(() => undefined);
  }
}

export type RasterAttemptResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; message: string };

export async function tryRenderPdfPageToPngBuffer(
  pdfBuffer: Buffer,
  pageNumber1Based: number,
  scale = getPdfRenderScale()
): Promise<RasterAttemptResult> {
  try {
    const buffer = await renderPdfPageToPngBuffer(pdfBuffer, pageNumber1Based, scale);
    return { ok: true, buffer };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
