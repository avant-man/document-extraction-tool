import { describe, expect, it } from 'vitest';
import { xAxisTickCount } from './ImplementationBarChart';

describe('xAxisTickCount', () => {
  it('returns fewer ticks when inner width is small', () => {
    expect(xAxisTickCount(80)).toBe(2);
    expect(xAxisTickCount(200)).toBe(2);
  });

  it('returns more ticks when inner width allows', () => {
    expect(xAxisTickCount(400)).toBe(5);
    expect(xAxisTickCount(600)).toBe(6);
  });
});
