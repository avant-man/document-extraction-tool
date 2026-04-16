import { describe, expect, it, afterEach } from 'vitest';
import { joinPageTexts } from '../services/pdfService';
import { annotateText } from '../services/regexParser';
import {
  buildPageBatchesForClaude,
  joinAnnotatedPagesForBatch,
  splitAnnotatedDocumentByPages
} from './pageBatches';

describe('pageBatches', () => {
  afterEach(() => {
    delete process.env.EXTRACTION_MAX_BATCHES;
    delete process.env.EXTRACTION_MAX_PAGES_PER_BATCH;
  });

  it('splitAnnotatedDocumentByPages still sees all pages after joinPageTexts + annotateText', () => {
    const raw = joinPageTexts(['alpha', 'beta', 'gamma']);
    const { text } = annotateText(raw);
    const pages = splitAnnotatedDocumentByPages(text);
    expect(pages).toHaveLength(3);
  });

  it('splitAnnotatedDocumentByPages parses PAGE markers', () => {
    const doc = '--- PAGE 1 ---\nline a\n\n--- PAGE 2 ---\nline b';
    const pages = splitAnnotatedDocumentByPages(doc);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.pageNum).toBe(1);
    expect(pages[0]!.text.trim()).toBe('line a');
    expect(pages[1]!.pageNum).toBe(2);
    expect(pages[1]!.text.trim()).toBe('line b');
  });

  it('joinAnnotatedPagesForBatch preserves order', () => {
    const pages = [
      { pageNum: 2, text: 'b' },
      { pageNum: 1, text: 'a' }
    ];
    const joined = joinAnnotatedPagesForBatch(pages, [1, 2]);
    expect(joined).toContain('--- PAGE 1 ---');
    expect(joined).toContain('--- PAGE 2 ---');
    expect(joined.indexOf('PAGE 1')).toBeLessThan(joined.indexOf('PAGE 2'));
  });

  it('buildPageBatchesForClaude returns null when one page alone exceeds budget', () => {
    const sys = 's'.repeat(200);
    const pages = [{ pageNum: 1, text: 'p'.repeat(2_000_000) }];
    const batches = buildPageBatchesForClaude(sys, pages, 100);
    expect(batches).toBeNull();
  });

  it('buildPageBatchesForClaude splits across batches when needed', () => {
    process.env.EXTRACTION_MAX_BATCHES = '10';
    const sys = 's'.repeat(200);
    const pages = Array.from({ length: 4 }, (_, i) => ({
      pageNum: i + 1,
      text: 'x'.repeat(700)
    }));
    const batches = buildPageBatchesForClaude(sys, pages, 550);
    expect(batches).not.toBeNull();
    expect(batches!.length).toBeGreaterThan(1);
    const flat = batches!.flat();
    expect(new Set(flat).size).toBe(flat.length);
    expect(flat.sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('buildPageBatchesForClaude respects EXTRACTION_MAX_PAGES_PER_BATCH under token budget', () => {
    process.env.EXTRACTION_MAX_BATCHES = '20';
    process.env.EXTRACTION_MAX_PAGES_PER_BATCH = '2';
    const sys = 's'.repeat(200);
    const pages = Array.from({ length: 4 }, (_, i) => ({
      pageNum: i + 1,
      text: 'x'.repeat(100)
    }));
    const batches = buildPageBatchesForClaude(sys, pages, 50_000);
    expect(batches).toEqual([
      [1, 2],
      [3, 4]
    ]);
  });
});
