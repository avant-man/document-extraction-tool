import { describe, it, expect } from 'vitest';
import { phraseSupportedBySource } from './sourceMatch';

describe('phraseSupportedBySource', () => {
  it('returns false for non-string phrase or rawText', () => {
    expect(phraseSupportedBySource(null, 'hello world')).toBe(false);
    expect(phraseSupportedBySource(123 as unknown as string, 'hello 123')).toBe(false);
    expect(phraseSupportedBySource('hello', null as unknown as string)).toBe(false);
  });

  it('supports normal substring match', () => {
    expect(phraseSupportedBySource('sediment loads', 'Reduce sediment loads from agricultural lands.')).toBe(
      true
    );
  });
});
