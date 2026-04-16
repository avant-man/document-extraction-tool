/**
 * Read a PDF from disk and log native text stats, sparse indices, and optional OCR (respects env).
 * Usage (from repo root or backend):
 *   npx ts-node scripts/diagnosePdfFixture.ts [path/to.pdf]
 * Env: PDF_DIAGNOSE_PATH fallback; OCR_ENGINE=tesseract to exercise raster+Tesseract (slow).
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const root = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

async function main() {
  const argPath = process.argv[2];
  const envPath = process.env.PDF_DIAGNOSE_PATH;
  const defaultFixture = path.join(
    root,
    'docs/superpowers/specs/Bogue_Chitto_Creek_Watershed_Plan_2004.pdf'
  );
  const pdfPath = argPath ?? envPath ?? defaultFixture;

  if (!fs.existsSync(pdfPath)) {
    console.error('File not found:', pdfPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(pdfPath);
  console.log('PDF:', pdfPath);
  console.log('Bytes:', buffer.length);
  console.log('OCR_ENGINE:', process.env.OCR_ENGINE ?? '(unset → none)');

  const { extractPagesFromBuffer } = await import('../src/services/pdfService');
  const { detectSparsePageIndices } = await import('../src/lib/sparsePages');
  const { sumNativeTrimmedLengths, resolveSparseIndicesForOcr } = await import('../src/lib/ocrSparsePolicy');
  const { getOcrEngineKind, applyOcrToSparsePages } = await import('../src/services/ocrService');

  const { pages, numPages } = await extractPagesFromBuffer(buffer);
  const lengths = pages.map(p => p.trim().length);
  const totalNative = sumNativeTrimmedLengths(pages);
  const sparse = detectSparsePageIndices(pages);
  const engine = getOcrEngineKind();
  const { sparsePageIndices, autoGlobalSparseApplied } = resolveSparseIndicesForOcr(pages, engine, sparse);

  console.log('numPages (pdf-parse):', numPages);
  console.log('pageCount:', pages.length);
  console.log('nativeTrimmedLengths (first 10):', lengths.slice(0, 10));
  console.log('sumNativeTrimmedChars:', totalNative);
  console.log('sparsePageIndices (heuristic):', sparse.slice(0, 20), sparse.length > 20 ? `... (+${sparse.length - 20})` : '');
  console.log('autoGlobalSparseApplied:', autoGlobalSparseApplied);
  console.log('sparsePageIndices (after policy):', sparsePageIndices.slice(0, 20), sparsePageIndices.length > 20 ? `...` : '');

  const { pages: merged, ocrAppliedToPages } = await applyOcrToSparsePages({
    pdfBuffer: buffer,
    pages,
    sparsePageIndices1Based: sparsePageIndices,
    engine
  });
  const mergedLens = merged.map(p => p.trim().length);
  console.log('ocrAppliedToPages:', ocrAppliedToPages.slice(0, 30), ocrAppliedToPages.length > 30 ? '...' : '');
  console.log('postOcrTrimmedLengths (first 10):', mergedLens.slice(0, 10));
  console.log('sumPostOcrTrimmedChars:', sumNativeTrimmedLengths(merged));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
