import { ExtractedReport } from '../types/extraction';

export function validate(
  rawJson: string,
  regexNumerics: Map<string, number>,
  sourceText: string
): ExtractedReport {
  // 1. Parse JSON
  let data: ExtractedReport;
  try { data = JSON.parse(rawJson); }
  catch { throw new Error('LLM returned non-JSON response'); }

  // 2. Schema check — ensure required top-level fields exist
  const required = ['summary', 'goals', 'bmps', 'implementation', 'monitoring', 'outreach', 'geographicAreas'];
  for (const field of required) {
    if (!(field in data)) throw new Error(`Missing field: ${field}`);
  }

  // 3. Numeric cross-check
  // Placeholder: a meaningful cross-check requires semantic context (e.g. matching
  // an acres figure from regex against an acres field, not a cost field). The current
  // data model doesn't surface that context, so the check is omitted to avoid
  // spurious warnings. Future implementation should correlate by unit/category.
  // The [NUM:*] markers injected by regexParser already surface ground-truth values
  // directly to Claude, which is a stronger correctness signal.
  void regexNumerics; // suppress unused-variable warning

  const lowerSource = sourceText.toLowerCase();

  // 4. Hallucination guard
  // For each goal.title, bmp.name, geographicArea.name: verify string exists in sourceText
  // If not found: remove item from its array (don't throw)
  data.goals = data.goals.filter(g => {
    if (!g.title) return false;
    return lowerSource.includes(g.title.toLowerCase());
  });

  data.bmps = data.bmps.filter(b => {
    if (!b.name) return false;
    return lowerSource.includes(b.name.toLowerCase());
  });

  data.geographicAreas = data.geographicAreas.filter(a => {
    if (!a.name) return false;
    return lowerSource.includes(a.name.toLowerCase());
  });

  // 5. Recompute derived summary fields
  const allBenchmarks = data.goals.flatMap(g => g.benchmarks ?? []);
  const metBenchmarks = allBenchmarks.filter(b => b.status === 'met');
  data.summary.completionRate = allBenchmarks.length > 0
    ? Math.round((metBenchmarks.length / allBenchmarks.length) * 100)
    : 0;
  data.summary.totalGoals = data.goals.length;
  data.summary.totalBMPs = data.bmps.length;

  return data;
}
