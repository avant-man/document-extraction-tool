/**
 * Normalizes common LLM output (markdown fences, preamble) into a JSON object string.
 */

function stripBom(s: string): string {
  if (s.length > 0 && s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

function stripMarkdownFence(s: string): string {
  const t = s.trim();
  const fenceOpen = /```(?:json)?\s*\r?\n?/i;
  const m = fenceOpen.exec(t);
  if (!m) return t;
  const afterOpen = t.slice(m.index + m[0].length);
  const closeIdx = afterOpen.indexOf('```');
  if (closeIdx === -1) return t;
  return afterOpen.slice(0, closeIdx).trim();
}

/**
 * Extracts the first `{...}` segment with balanced braces, respecting JSON string rules.
 */
function extractBalancedJsonObject(s: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') { inString = false; continue; }
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

export function parseLlmJsonResponse(raw: string): string {
  let s = stripBom(raw.trim());
  s = stripMarkdownFence(s);
  s = s.trim();

  const braceStart = s.indexOf('{');
  if (braceStart === -1) return s;

  const balanced = extractBalancedJsonObject(s, braceStart);
  return balanced ?? s.slice(braceStart);
}
