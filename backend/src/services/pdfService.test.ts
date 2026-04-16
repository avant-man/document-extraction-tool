import { describe, expect, it } from 'vitest';
import { assemblePageTextFromTextContentItems } from './pdfService';

/** Minimal 6-element PDF transform: [a,b,c,d,e,f] — we use e,f as x,y. */
function tr(x: number, y: number): number[] {
  return [1, 0, 0, 1, x, y];
}

describe('assemblePageTextFromTextContentItems', () => {
  it('orders same-line fragments left-to-right by x', () => {
    const text = assemblePageTextFromTextContentItems([
      { str: 'world', transform: tr(100, 500) },
      { str: 'Hello', transform: tr(40, 500) }
    ]);
    expect(text).toBe('Hello world');
  });

  it('inserts newlines between lines with different y', () => {
    const text = assemblePageTextFromTextContentItems([
      { str: 'bottom', transform: tr(40, 100) },
      { str: 'top', transform: tr(40, 500) }
    ]);
    expect(text).toBe('top\nbottom');
  });

  it('appends items without transform at the end', () => {
    const text = assemblePageTextFromTextContentItems([
      { str: 'ok', transform: tr(0, 400) },
      { str: 'orphan' }
    ]);
    expect(text).toBe('ok\norphan');
  });

  it('returns empty string for no textual items', () => {
    expect(assemblePageTextFromTextContentItems([])).toBe('');
  });
});
