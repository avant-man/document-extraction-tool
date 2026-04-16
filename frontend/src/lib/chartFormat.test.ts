import { describe, expect, it } from 'vitest';
import { formatAcresProgress } from './chartFormat';

describe('formatAcresProgress', () => {
  it('formats achieved and target with locale and unit suffix', () => {
    expect(formatAcresProgress(0, 500)).toBe('0 / 500 ac');
    expect(formatAcresProgress(380, 500)).toBe('380 / 500 ac');
  });
});
