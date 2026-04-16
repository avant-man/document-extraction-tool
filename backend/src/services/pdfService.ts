import pdfParse from 'pdf-parse';
import { logger } from '../lib/logger';

/** PDF user space: y increases upward; larger y ≈ visually higher on the page. */
const LINE_Y_TOLERANCE = 4;

export interface TextContentItemLike {
  str?: string;
  transform?: number[];
}

export type ExtractPagesResult = {
  /** One string per PDF page, same order as the document */
  pages: string[];
  /** `numpages` from pdf-parse */
  numPages: number;
};

/**
 * Build page text from pdf.js getTextContent() items in reading order (top-to-bottom,
 * left-to-right) with newlines between detected lines. Avoids naive join order which
 * follows stream order and breaks tables/multi-column layouts.
 */
export function assemblePageTextFromTextContentItems(items: TextContentItemLike[]): string {
  type Piece = { str: string; x: number; y: number };
  const pieces: Piece[] = [];
  const orphans: string[] = [];

  for (const item of items) {
    if (!item || typeof item.str !== 'string' || item.str === '') continue;
    const t = item.transform;
    if (!Array.isArray(t) || t.length < 6) {
      orphans.push(item.str);
      continue;
    }
    pieces.push({ str: item.str, x: t[4], y: t[5] });
  }

  if (pieces.length === 0) {
    return orphans.length > 0 ? orphans.join(' ') : '';
  }

  pieces.sort((a, b) => {
    if (Math.abs(b.y - a.y) > LINE_Y_TOLERANCE) return b.y - a.y;
    return a.x - b.x;
  });

  let out = '';
  let prevY = pieces[0].y;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (i > 0) {
      if (Math.abs(p.y - prevY) > LINE_Y_TOLERANCE) {
        out += '\n';
      } else {
        out += ' ';
      }
    }
    out += p.str;
    prevY = p.y;
  }

  if (orphans.length > 0) {
    out += (out ? '\n' : '') + orphans.join(' ');
  }

  return out;
}

/** Join per-page strings into the canonical `--- PAGE n ---` document shape used by regex + validator. */
export function joinPageTexts(pageTexts: string[]): string {
  if (pageTexts.length === 0) return '';
  return pageTexts.map((text, i) => `--- PAGE ${i + 1} ---\n${text}`).join('\n\n');
}

export async function extractPagesFromBuffer(buffer: Buffer): Promise<ExtractPagesResult> {
  const t0 = Date.now();
  const pageTexts: string[] = [];
  const data = await pdfParse(buffer, {
    pagerender: (pageData: { getTextContent: () => Promise<{ items: TextContentItemLike[] }> }) => {
      return pageData.getTextContent().then((content: { items: TextContentItemLike[] }) => {
        const text = assemblePageTextFromTextContentItems(content.items ?? []);
        pageTexts.push(text);
        return text;
      });
    }
  });

  let pages: string[];
  if (pageTexts.length === 0 && data.text) {
    pages = [data.text];
  } else {
    pages = [...pageTexts];
  }

  logger.debug('pdf.extract_pages', {
    stage: 'pdf',
    durationMs: Date.now() - t0,
    numPages: data.numpages,
    pageCount: pages.length,
    pageTextLengths: pages.map(t => t.length)
  });

  return { pages, numPages: data.numpages };
}

export async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  const { pages } = await extractPagesFromBuffer(buffer);
  return joinPageTexts(pages);
}
