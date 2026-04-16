import { estimateClaudeExtractionInputTokens } from './tokenBudget';

/**
 * Upper bound for first-batch hint length when packing pages (real hint uses actual batch/page numbers).
 */
const FIRST_BATCH_BUDGET_PREFIX =
  'Batch 99 of 99 (PDF pages 999-999). Extract the full watershed plan from the text below.\n\n';

/**
 * Instruction prepended to user content for batches after the first.
 * Must stay stable for token budgeting in buildPageBatchesForClaude.
 */
export const NON_FIRST_BATCH_USER_PREFIX = `You are processing a LATER BATCH of a multi-part watershed plan (not the first batch).
Extract ONLY items clearly supported by the text below.
For the "summary" object, return EXACTLY these placeholder values (do not invent metadata):
{"watershedName":"","planYear":0,"totalGoals":0,"totalBMPs":0,"completionRate":0,"totalEstimatedCost":0,"geographicScope":""}
Omit reportedProgressPercent and reportedProgressSource (or set them to null).
Fill goals, bmps, implementation, monitoring, outreach, geographicAreas from THIS batch only; use [] where nothing applies.

--- BATCH TEXT ---

`;

export type AnnotatedPageSlice = { pageNum: number; text: string };

/**
 * Splits full annotated document text into per-page slices (expects --- PAGE n --- markers).
 */
export function splitAnnotatedDocumentByPages(annotatedText: string): AnnotatedPageSlice[] {
  const t = annotatedText.trimStart();
  const first = /^--- PAGE (\d+) ---\n/.exec(t);
  if (!first) {
    return [{ pageNum: 1, text: annotatedText.trim() }];
  }

  const pages: AnnotatedPageSlice[] = [];
  const rest = t.slice(first[0].length);
  const firstNum = Number(first[1]);
  const segments = rest.split(/\n--- PAGE (\d+) ---\n/);
  pages.push({ pageNum: firstNum, text: segments[0] ?? '' });
  for (let i = 1; i < segments.length; i += 2) {
    const num = Number(segments[i]);
    if (!Number.isFinite(num)) break;
    pages.push({ pageNum: num, text: segments[i + 1] ?? '' });
  }
  return pages;
}

export function joinAnnotatedPagesForBatch(allPages: AnnotatedPageSlice[], pageNums: number[]): string {
  const set = new Set(pageNums);
  const selected = allPages.filter(p => set.has(p.pageNum)).sort((a, b) => a.pageNum - b.pageNum);
  return selected.map(p => `--- PAGE ${p.pageNum} ---\n${p.text}`).join('\n\n');
}

export type BatchHint = {
  batchIndex: number;
  totalBatches: number;
  startPage: number;
  endPage: number;
  isFirstBatch: boolean;
};

export function buildClaudeUserContentForBatch(annotatedBatchBody: string, batch: BatchHint): string {
  if (batch.isFirstBatch) {
    return `Batch ${batch.batchIndex + 1} of ${batch.totalBatches} (PDF pages ${batch.startPage}-${batch.endPage}). Extract the full watershed plan from the text below.\n\n${annotatedBatchBody}`;
  }
  return `${NON_FIRST_BATCH_USER_PREFIX}${annotatedBatchBody}`;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getExtractionMaxBatches(): number {
  return parsePositiveInt(process.env.EXTRACTION_MAX_BATCHES, 48);
}

/**
 * Max PDF pages per Claude batch when splitting oversized documents.
 * Unset or non-positive values mean no cap (pack until token budget only).
 */
export function getExtractionMaxPagesPerBatch(): number {
  const raw = process.env.EXTRACTION_MAX_PAGES_PER_BATCH;
  if (raw === undefined || raw.trim() === '') {
    return Number.POSITIVE_INFINITY;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return n;
}

/**
 * Greedy page packing: first batch uses FIRST_BATCH_USER_PREFIX; later batches use NON_FIRST_BATCH_USER_PREFIX.
 * Returns null if a single page cannot fit the budget, or if batch count exceeds EXTRACTION_MAX_BATCHES.
 */
export function buildPageBatchesForClaude(
  systemPrompt: string,
  pages: AnnotatedPageSlice[],
  budgetTokens: number
): number[][] | null {
  if (pages.length === 0) {
    return null;
  }

  const maxBatches = getExtractionMaxBatches();
  const maxPagesPerBatch = getExtractionMaxPagesPerBatch();
  const batches: number[][] = [];
  let pageIdx = 0;

  while (pageIdx < pages.length) {
    if (batches.length >= maxBatches) {
      return null;
    }

    const isFirstBatch = batches.length === 0;
    const prefix = isFirstBatch ? FIRST_BATCH_BUDGET_PREFIX : NON_FIRST_BATCH_USER_PREFIX;
    const current: number[] = [];

    while (pageIdx < pages.length) {
      const next = pages[pageIdx]!;
      const candidate = [...current, next.pageNum];
      const body = joinAnnotatedPagesForBatch(pages, candidate);
      const est = estimateClaudeExtractionInputTokens(systemPrompt, prefix + body);
      if (est <= budgetTokens) {
        current.push(next.pageNum);
        pageIdx++;
        if (current.length >= maxPagesPerBatch) {
          break;
        }
      } else {
        if (current.length === 0) {
          return null;
        }
        break;
      }
    }

    if (current.length === 0) {
      return null;
    }
    batches.push(current);
  }

  return batches;
}
