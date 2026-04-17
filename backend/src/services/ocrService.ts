import { createRequire } from 'node:module';
import path from 'node:path';
import { logger } from '../lib/logger';
import { getSparseCharThreshold } from '../lib/sparsePages';
import { tryRenderPdfPageToPngBuffer, getPdfRenderScale } from './pdfRasterService';

/** Keep in sync with backend `package.json` tesseract.js-core version (WASM base URL on CDN). */
const TESSERACT_JS_CORE_PKG_VERSION = '5.1.1';

export type TesseractWorkerCreateOptions = {
  /** Must be a filesystem path in Node (Worker threads); never an https URL. */
  workerPath: string;
  /** WASM engine files; https CDN is OK and avoids missing `.wasm` in serverless bundles. */
  corePath: string;
};

function resolveNodeTesseractWorkerScript(): string {
  const require = createRequire(__filename);
  try {
    return require.resolve('tesseract.js/src/worker-script/node/index.js');
  } catch {
    const pkgJson = require.resolve('tesseract.js/package.json');
    return path.join(path.dirname(pkgJson), 'src/worker-script/node/index.js');
  }
}

/**
 * Vercel/serverless bundles often ship `tesseract.js-core` `.js` without sibling `.wasm` files,
 * which causes ENOENT at runtime. Pointing `corePath` at jsDelivr fixes WASM loading.
 * Node still requires a **local** `workerPath` (see tesseract.js FAQ for worker threads).
 *
 * Set `TESSERACT_USE_CDN=1` on other hosts with the same WASM bundling issue.
 * Set `TESSERACT_DISABLE_CDN=1` to force default local `node_modules` layout only.
 */
function shouldLoadTesseractCoreFromCdn(): boolean {
  if (process.env.TESSERACT_USE_CDN === '1') return true;
  const vercel = process.env.VERCEL;
  if (vercel !== undefined && vercel !== '') return true;
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv !== undefined && vercelEnv !== '') return true;
  return false;
}

export function getTesseractWorkerCreateOptions(): TesseractWorkerCreateOptions | undefined {
  if (process.env.TESSERACT_DISABLE_CDN === '1') return undefined;
  if (shouldLoadTesseractCoreFromCdn()) {
    const v = TESSERACT_JS_CORE_PKG_VERSION;
    return {
      workerPath: resolveNodeTesseractWorkerScript(),
      corePath: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${v}`
    };
  }
  return undefined;
}

export type OcrEngineKind = 'none' | 'tesseract';

const DEFAULT_OCR_MAX_PAGES = 60;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** `none` skips OCR. `tesseract` runs Tesseract on sparse pages (see sparsePages + raster). */
export function getOcrEngineKind(): OcrEngineKind {
  const v = (process.env.OCR_ENGINE ?? 'none').trim().toLowerCase();
  if (v === 'tesseract') return 'tesseract';
  return 'none';
}

export function getOcrMaxPagesPerRequest(): number {
  return parsePositiveInt(process.env.OCR_MAX_PAGES, DEFAULT_OCR_MAX_PAGES);
}

export type ApplyOcrParams = {
  pdfBuffer: Buffer;
  pages: string[];
  /** 1-based indices (from detectSparsePageIndices) */
  sparsePageIndices1Based: number[];
  engine: OcrEngineKind;
};

export type ApplyOcrResult = {
  pages: string[];
  /** 1-based page numbers where OCR text replaced native */
  ocrAppliedToPages: number[];
};

/**
 * For each sparse page, optionally rasterize + OCR and replace native text when OCR returns content.
 */
export async function applyOcrToSparsePages(params: ApplyOcrParams): Promise<ApplyOcrResult> {
  const { pdfBuffer, pages, sparsePageIndices1Based, engine } = params;
  const out = [...pages];
  const ocrAppliedToPages: number[] = [];

  if (engine === 'none' || sparsePageIndices1Based.length === 0) {
    return { pages: out, ocrAppliedToPages };
  }

  const threshold = getSparseCharThreshold();
  const maxOcr = getOcrMaxPagesPerRequest();
  const scale = getPdfRenderScale();

  const candidates = sparsePageIndices1Based.filter(p => p >= 1 && p <= out.length).slice(0, maxOcr);

  const rasterFailures: { pageNumber1Based: number; message: string }[] = [];

  const { createWorker } = await import('tesseract.js');
  const remoteAssets = getTesseractWorkerCreateOptions();
  const worker = remoteAssets
    ? await createWorker('eng', 1, remoteAssets)
    : await createWorker('eng');
  try {
    for (const pageNum of candidates) {
      const idx = pageNum - 1;
      const native = out[idx] ?? '';
      if (native.trim().length >= threshold) continue;

      const raster = await tryRenderPdfPageToPngBuffer(pdfBuffer, pageNum, scale);
      if (!raster.ok) {
        rasterFailures.push({ pageNumber1Based: pageNum, message: raster.message });
        continue;
      }
      const png = raster.buffer;

      try {
        const {
          data: { text }
        } = await worker.recognize(png);
        const cleaned = (text ?? '').trim();
        if (cleaned.length > 0) {
          out[idx] = cleaned;
          ocrAppliedToPages.push(pageNum);
        }
      } catch (err) {
        logger.warn('ocr.page_failed', {
          pageNumber1Based: pageNum,
          message: err instanceof Error ? err.message : String(err)
        });
      }
    }
  } finally {
    await worker.terminate().catch(() => undefined);
  }

  if (rasterFailures.length > 0) {
    const sample = rasterFailures[0]!.message;
    const allSame = rasterFailures.every(f => f.message === sample);
    logger.warn('pdf.raster_summary', {
      failedCount: rasterFailures.length,
      firstPage: Math.min(...rasterFailures.map(f => f.pageNumber1Based)),
      lastPage: Math.max(...rasterFailures.map(f => f.pageNumber1Based)),
      sampleMessage: sample,
      uniformMessage: allSame
    });
  }

  return { pages: out, ocrAppliedToPages };
}
