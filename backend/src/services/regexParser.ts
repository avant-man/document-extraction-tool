import { AnnotatedDocument } from '../types/extraction';
import { logger } from '../lib/logger';

export interface RegexNumericResult {
  map: Map<string, number>;
  annotatedText: string;
}

export function buildRegexNumerics(text: string): RegexNumericResult {
  const map = new Map<string, number>();

  // Collect all matches with their positions so we can inject markers
  const matches: Array<{ index: number; raw: string; value: number }> = [];

  // acres: e.g. "450 acres", "1,200.5 acres"
  const acresRe = /[\d,]+\.?\d*\s*acres/gi;
  for (const match of text.matchAll(acresRe)) {
    const raw = match[0];
    const value = parseFloat(raw.replace(/[^\d.]/g, ''));
    if (!isNaN(value)) {
      map.set(raw, value);
      matches.push({ index: match.index!, raw, value });
    }
  }

  // percentages: e.g. "75%"
  const pctRe = /\d+\.?\d*\s*%/g;
  for (const match of text.matchAll(pctRe)) {
    const raw = match[0];
    const value = parseFloat(raw);
    if (!isNaN(value)) {
      map.set(raw, value);
      matches.push({ index: match.index!, raw, value });
    }
  }

  // dollar amounts: e.g. "$12,000" or "$7,037.01"
  const dollarRe = /\$[\d,]+(?:\.\d+)?/g;
  for (const match of text.matchAll(dollarRe)) {
    const raw = match[0];
    const value = parseFloat(raw.replace(/[^\d.]/g, ''));
    if (!isNaN(value)) {
      map.set(raw, value);
      matches.push({ index: match.index!, raw, value });
    }
  }

  // miles: e.g. "5 miles"
  const milesRe = /\d+\s+miles/gi;
  for (const match of text.matchAll(milesRe)) {
    const raw = match[0];
    const value = parseFloat(raw);
    if (!isNaN(value)) {
      map.set(raw, value);
      matches.push({ index: match.index!, raw, value });
    }
  }

  // Sort matches by position descending so replacements don't shift earlier indices
  matches.sort((a, b) => b.index - a.index);

  // Inject [NUM:raw] markers inline into the text
  let annotatedText = text;
  for (const { index, raw } of matches) {
    annotatedText =
      annotatedText.slice(0, index) +
      `[NUM:${raw}]` +
      annotatedText.slice(index + raw.length);
  }

  return { map, annotatedText };
}

export function annotateText(text: string): AnnotatedDocument {
  const { map: regexNumerics, annotatedText: numericAnnotated } = buildRegexNumerics(text);

  const lines = numericAnnotated.split('\n');
  const annotated: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Filter pure page-number lines
    if (/^\s*\d+\s*$/.test(line)) {
      continue;
    }

    // Filter short header/footer lines near PAGE markers
    // Check within ±2 lines of a PAGE marker
    if (trimmed.length < 4) {
      const nearby = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3));
      const nearPage = nearby.some(l => /--- PAGE \d+ ---/.test(l));
      if (nearPage) continue;
    }

    // PDF page sentinels must stay exact: trimmed `---` would match hyphen bullet tagging below.
    if (/^--- PAGE \d+ ---\s*$/.test(trimmed)) {
      annotated.push(line);
      continue;
    }

    // Inject section markers before matching lines (MDEQ / WIP patterns)
    if (
      /\bGoal\s+\d+[:.)]/i.test(line) ||
      /Management\s+Goals/i.test(line) ||
      /\bWatershed\s+Goals/i.test(line) ||
      /\bObjective\s+\d+[:.)]/i.test(line) ||
      /^Objectives?\s*[:.]?\s*$/i.test(trimmed) ||
      /\bLoad\s+Reduction/i.test(line)
    ) {
      annotated.push('[SECTION:goal]');
    } else if (/\bBMP[:\s]/i.test(line) || /Best\s+Management\s+Practices/i.test(line)) {
      annotated.push('[SECTION:bmp]');
    } else if (/Implementation\s+Activities/i.test(line)) {
      annotated.push('[SECTION:implementation]');
    } else if (/\bMonitoring\b/i.test(line)) {
      annotated.push('[SECTION:monitoring]');
    } else if (/\bOutreach\b/i.test(line)) {
      annotated.push('[SECTION:outreach]');
    }

    // Tag bullet lines
    if (/^[•\-]/.test(trimmed)) {
      annotated.push('[BULLET:1]' + line);
    } else if (/^[○–]/.test(trimmed) || /^  \S/.test(line)) {
      annotated.push('[BULLET:2]' + line);
    } else {
      annotated.push(line);
    }
  }

  // Rows that include acre numerics + BMP-related vocabulary help tie costs/acres to practices
  const withBmpHints = annotated.flatMap(line => {
    if (
      /\[NUM:[^\]]*acres\]/i.test(line) &&
      /(structural|vegetative|management|planting|fencing|protection|basin|diversions|nutrient|trough|nrcs|practice)/i.test(
        line
      )
    ) {
      return ['[BMP_ROW_WITH_ACRES]', line];
    }
    return [line];
  });

  const out = withBmpHints.join('\n');
  logger.debug('regex.annotate', {
    stage: 'regex',
    regexNumericsSize: regexNumerics.size,
    annotatedChars: out.length
  });

  return { text: out, regexNumerics };
}
