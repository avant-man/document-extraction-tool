import { safeTrim } from './stringUtils';

/**
 * Whether an LLM-extracted title/name is supported by the raw PDF text.
 * Uses substring, compact (no-whitespace), and token-overlap matching so
 * paraphrases and mild PDF line-break fragmentation still pass.
 */
const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'with',
  'from',
  'no',
  'as',
  'is',
  'are'
]);

function significantTokens(normalized: string): string[] {
  return normalized
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9-]/gi, ''))
    .filter(t => {
      if (t.length < 3) return false;
      return !STOPWORDS.has(t.toLowerCase());
    });
}

export function phraseSupportedBySource(phrase: unknown, rawText: unknown): boolean {
  if (typeof rawText !== 'string') return false;
  const phraseStr = safeTrim(phrase);
  if (!phraseStr) return false;

  const source = rawText.toLowerCase();
  const normalized = phraseStr.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return false;

  if (source.includes(normalized)) return true;

  const compactSrc = source.replace(/\s+/g, '');
  const compactPhrase = normalized.replace(/\s/g, '');
  if (compactPhrase.length >= 8 && compactSrc.includes(compactPhrase)) return true;

  const tokens = significantTokens(normalized);
  if (tokens.length > 0) {
    let hits = 0;
    for (const t of tokens) {
      const tl = t.toLowerCase();
      if (source.includes(tl)) hits++;
    }
    const threshold = Math.max(2, Math.ceil(tokens.length * 0.35));
    if (hits >= threshold) return true;
  }

  const shortTokens = normalized
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9]/gi, ''))
    .filter(t => t.length >= 2);
  if (shortTokens.length === 0) return false;
  let shortHits = 0;
  for (const t of shortTokens) {
    if (source.includes(t.toLowerCase())) shortHits++;
  }
  return shortHits >= Math.ceil(shortTokens.length * 0.5) && shortHits >= 1;
}
