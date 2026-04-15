import { AnnotatedDocument } from '../types/extraction';

export function buildRegexNumerics(text: string): Map<string, number> {
  const map = new Map<string, number>();

  // acres: e.g. "450 acres", "1,200.5 acres"
  const acresRe = /[\d,]+\.?\d*\s*acres/gi;
  for (const match of text.matchAll(acresRe)) {
    const raw = match[0];
    const value = parseFloat(raw.replace(/[^\d.]/g, ''));
    if (!isNaN(value)) map.set(raw, value);
  }

  // percentages: e.g. "75%"
  const pctRe = /\d+\.?\d*\s*%/g;
  for (const match of text.matchAll(pctRe)) {
    const raw = match[0];
    const value = parseFloat(raw);
    if (!isNaN(value)) map.set(raw, value);
  }

  // dollar amounts: e.g. "$12,000"
  const dollarRe = /\$[\d,]+/g;
  for (const match of text.matchAll(dollarRe)) {
    const raw = match[0];
    const value = parseFloat(raw.replace(/[^\d.]/g, ''));
    if (!isNaN(value)) map.set(raw, value);
  }

  // miles: e.g. "5 miles"
  const milesRe = /\d+\s+miles/gi;
  for (const match of text.matchAll(milesRe)) {
    const raw = match[0];
    const value = parseFloat(raw);
    if (!isNaN(value)) map.set(raw, value);
  }

  return map;
}

export function annotateText(text: string): AnnotatedDocument {
  const regexNumerics = buildRegexNumerics(text);

  const lines = text.split('\n');
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

    // Inject section markers before matching lines
    if (/\bGoal\s+\d+[:.]/i.test(line)) {
      annotated.push('[SECTION:goal]');
    } else if (/\bBMP[:\s]/i.test(line)) {
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

  return { text: annotated.join('\n'), regexNumerics };
}
