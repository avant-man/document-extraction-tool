import { describe, expect, it, afterEach } from 'vitest';
import { detectSparsePageIndices, getSparseCharThreshold, nativePageAlphanumericRatio } from './sparsePages';

describe('sparsePages', () => {
  afterEach(() => {
    delete process.env.OCR_SPARSE_CHAR_THRESHOLD;
    delete process.env.OCR_SPARSE_MIN_ALNUM_RATIO;
  });

  it('detectSparsePageIndices marks short pages as sparse (1-based)', () => {
    expect(detectSparsePageIndices(['hello', 'x'.repeat(200), ''], 80)).toEqual([1, 3]);
  });

  it('getSparseCharThreshold reads env', () => {
    process.env.OCR_SPARSE_CHAR_THRESHOLD = '10';
    expect(getSparseCharThreshold()).toBe(10);
    expect(detectSparsePageIndices(['123456789'], 10)).toEqual([1]);
  });

  it('detectSparsePageIndices marks long low-alphanumeric native layers as sparse', () => {
    process.env.OCR_SPARSE_MIN_ALNUM_RATIO = '0.15';
    const junk = '§'.repeat(100) + '░'.repeat(100);
    expect(junk.length).toBeGreaterThanOrEqual(80);
    expect(nativePageAlphanumericRatio(junk)).toBeLessThan(0.15);
    expect(detectSparsePageIndices([junk], 80)).toEqual([1]);
  });
});
