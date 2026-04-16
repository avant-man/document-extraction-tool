import { describe, it, expect } from 'vitest';
import { phraseSupportedBySource } from './sourceMatch';

describe('phraseSupportedBySource', () => {
  it('accepts exact substring', () => {
    const src = 'The Quick Brown Fox';
    expect(phraseSupportedBySource('Brown Fox', src)).toBe(true);
  });

  it('accepts token overlap when paraphrased', () => {
    const src =
      'reduce sediment and nutrient loads from nonpoint sources in the muddy creek watershed';
    expect(
      phraseSupportedBySource('Reduce pollutant loads from nonpoint sources', src)
    ).toBe(true);
  });

  it('accepts compact match when PDF removes spaces between words', () => {
    const src = 'loadreductiongoals for muddy creek watershed plan';
    expect(phraseSupportedBySource('load reduction goals', 'load reduction goals')).toBe(true);
  });

  it('rejects unrelated titles', () => {
    const src = 'only watershed monitoring and outreach activities';
    expect(phraseSupportedBySource('Quantum cryptography overview', src)).toBe(false);
  });
});
