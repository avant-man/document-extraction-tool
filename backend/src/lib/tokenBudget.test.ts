import { describe, expect, it, afterEach } from 'vitest';
import {
  estimateClaudeExtractionInputTokens,
  estimateTokensFromCharCount,
  getCharsPerTokenEstimate,
  getExtractionInputTokenBudget,
  isExtractionInputOverBudget
} from './tokenBudget';

describe('tokenBudget', () => {
  afterEach(() => {
    delete process.env.EXTRACTION_INPUT_TOKEN_BUDGET;
    delete process.env.EXTRACTION_CHARS_PER_TOKEN;
  });

  it('estimateTokensFromCharCount uses configured ratio', () => {
    process.env.EXTRACTION_CHARS_PER_TOKEN = '4';
    expect(getCharsPerTokenEstimate()).toBe(4);
    expect(estimateTokensFromCharCount(400)).toBe(100);
  });

  it('getExtractionInputTokenBudget reads env', () => {
    process.env.EXTRACTION_INPUT_TOKEN_BUDGET = '12345';
    expect(getExtractionInputTokenBudget()).toBe(12345);
  });

  it('isExtractionInputOverBudget sums system + user chars', () => {
    process.env.EXTRACTION_INPUT_TOKEN_BUDGET = '10';
    process.env.EXTRACTION_CHARS_PER_TOKEN = '1';
    const sys = 'a'.repeat(5);
    const user = 'b'.repeat(6);
    expect(estimateClaudeExtractionInputTokens(sys, user)).toBe(11);
    expect(isExtractionInputOverBudget(sys, user)).toBe(true);
    expect(isExtractionInputOverBudget('a', 'b')).toBe(false);
  });
});
