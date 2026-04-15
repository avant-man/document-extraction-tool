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
  // Walk data numerics against regexNumerics map ±10%
  // Log a warning if mismatch > 10% — do NOT throw
  const lowerSource = sourceText.toLowerCase();

  // Collect numeric values from the extracted data for cross-checking
  const dataValues: number[] = [
    data.summary.totalEstimatedCost,
    ...data.bmps.map(b => b.cost),
    ...data.bmps.map(b => b.targetAcres),
    ...data.bmps.map(b => b.implementedAcres),
    ...data.implementation.map(a => a.cost),
    ...data.goals.map(g => g.targetReduction),
    ...data.goals.flatMap(g => g.benchmarks.map(b => b.target)),
    ...data.goals.flatMap(g => g.benchmarks.map(b => b.current)),
  ].filter(v => v != null && !isNaN(v) && v > 0);

  for (const [key, regexVal] of regexNumerics) {
    for (const dataVal of dataValues) {
      if (regexVal > 0 && Math.abs(dataVal - regexVal) / regexVal > 0.1) {
        // Only warn if values are in a similar magnitude range (within 10x)
        if (dataVal / regexVal > 0.1 && dataVal / regexVal < 10) {
          console.warn(`[validator] Numeric mismatch: source "${key}" = ${regexVal}, extracted = ${dataVal}`);
        }
      }
    }
  }

  // 4. Hallucination guard
  // For each goal.title, bmp.name, geographicArea.name: verify string exists in sourceText
  // If not found: remove item from its array (don't throw)
  data.goals = data.goals.filter(g => {
    if (!g.title) return false;
    return lowerSource.includes(g.title.toLowerCase().substring(0, 20));
  });

  data.bmps = data.bmps.filter(b => {
    if (!b.name) return false;
    return lowerSource.includes(b.name.toLowerCase().substring(0, 20));
  });

  data.geographicAreas = data.geographicAreas.filter(a => {
    if (!a.name) return false;
    return lowerSource.includes(a.name.toLowerCase().substring(0, 20));
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
