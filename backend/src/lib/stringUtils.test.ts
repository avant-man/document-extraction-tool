import { describe, it, expect } from 'vitest';
import { safeTrim, isBlankEnv } from './stringUtils';

describe('stringUtils', () => {
  it('safeTrim handles nullish and non-strings', () => {
    expect(safeTrim(null)).toBe('');
    expect(safeTrim(undefined)).toBe('');
    expect(safeTrim(42)).toBe('');
    expect(safeTrim('  x  ')).toBe('x');
  });

  it('isBlankEnv treats null, undefined, empty, and whitespace as blank', () => {
    expect(isBlankEnv(undefined)).toBe(true);
    expect(isBlankEnv(null)).toBe(true);
    expect(isBlankEnv('')).toBe(true);
    expect(isBlankEnv('  \t')).toBe(true);
    expect(isBlankEnv('1')).toBe(false);
  });
});
