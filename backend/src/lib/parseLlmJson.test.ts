import { describe, it, expect } from 'vitest';
import { parseLlmJsonResponse } from './parseLlmJson';

describe('parseLlmJsonResponse', () => {
  it('returns bare object JSON', () => {
    const j = '{"a":1}';
    expect(parseLlmJsonResponse(j)).toBe(j);
  });

  it('strips markdown json fence', () => {
    const inner = '{"x":2}';
    const raw = '```json\n' + inner + '\n```';
    expect(parseLlmJsonResponse(raw)).toBe(inner);
  });

  it('handles preamble before fence', () => {
    const inner = '{"y":3}';
    const raw = 'Here is the data:\n```\n' + inner + '\n```';
    expect(parseLlmJsonResponse(raw)).toBe(inner);
  });

  it('extracts first balanced object with preamble text', () => {
    const inner = '{"msg":"brace } in string"}';
    const raw = 'Prefix\n' + inner + ' junk after';
    expect(parseLlmJsonResponse(raw)).toBe(inner);
  });

  it('strips BOM', () => {
    const inner = '{"z":4}';
    expect(parseLlmJsonResponse('\uFEFF' + inner)).toBe(inner);
  });

  it('falls back to slice from first brace when unbalanced', () => {
    const bad = '{"a":1';
    expect(parseLlmJsonResponse('x' + bad)).toBe(bad);
  });
});
