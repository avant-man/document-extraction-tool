import { ExtractedReport } from '../types/extraction';
import { logger } from '../lib/logger';
import { phraseSupportedBySource } from '../lib/sourceMatch';
import { safeTrim } from '../lib/stringUtils';

/** When exactly one dollar literal from regexNumerics appears near the BMP name, snap cost to that value. */
function alignReportNumerics(data: ExtractedReport, regexNumerics: Map<string, number>, sourceText: string): void {
  if (regexNumerics.size === 0) return;

  for (const bmp of data.bmps) {
    if (bmp == null || typeof bmp !== 'object') continue;
    const name = safeTrim(bmp.name);
    if (!name) continue;

    const lower = sourceText.toLowerCase();
    const idx = lower.indexOf(name.toLowerCase());
    if (idx < 0) continue;

    const winStart = Math.max(0, idx - 80);
    const winEnd = Math.min(sourceText.length, idx + name.length + 320);
    const window = sourceText.slice(winStart, winEnd);

    const dollarHits = [...regexNumerics.entries()].filter(([raw]) => raw.startsWith('$') && window.includes(raw));
    if (dollarHits.length !== 1) continue;

    const val = dollarHits[0]![1];
    if (bmp.cost == null || Math.abs(bmp.cost - val) > 0.01) {
      logger.info('validate.numeric_align', { field: 'cost', bmp: name, value: val });
      bmp.cost = val;
    }
  }
}

function computeCompletionRate(data: ExtractedReport): {
  rate: number;
  basis: 'benchmarks' | 'implementation' | 'none';
} {
  const allBenchmarks = data.goals
    .filter((g): g is NonNullable<typeof g> => g != null && typeof g === 'object')
    .flatMap(g => g.benchmarks ?? [])
    .filter((b): b is NonNullable<typeof b> => b != null && typeof b === 'object');
  const metBenchmarks = allBenchmarks.filter(b => b.status === 'met');
  if (allBenchmarks.length > 0) {
    return {
      rate: Math.round((metBenchmarks.length / allBenchmarks.length) * 100),
      basis: 'benchmarks'
    };
  }

  const impl = (data.implementation ?? []).filter(
    (a): a is NonNullable<typeof a> => a != null && typeof a === 'object'
  );
  if (impl.length > 0) {
    const complete = impl.filter(a => a.status === 'complete').length;
    return {
      rate: Math.round((complete / impl.length) * 100),
      basis: 'implementation'
    };
  }

  return { rate: 0, basis: 'none' };
}

function applyImplementationCompletionRate(data: ExtractedReport): void {
  const allBenchmarks = data.goals
    .filter((g): g is NonNullable<typeof g> => g != null && typeof g === 'object')
    .flatMap(g => g.benchmarks ?? [])
    .filter((b): b is NonNullable<typeof b> => b != null && typeof b === 'object');
  const impl = (data.implementation ?? []).filter(
    (a): a is NonNullable<typeof a> => a != null && typeof a === 'object'
  );
  if (allBenchmarks.length > 0 && impl.length > 0) {
    const complete = impl.filter(a => a.status === 'complete').length;
    data.summary.implementationCompletionRate = Math.round((complete / impl.length) * 100);
  } else {
    delete data.summary.implementationCompletionRate;
  }
}

function applyReportedProgressFromLlm(
  summary: ExtractedReport['summary'],
  reportedPct: unknown,
  reportedSrc: unknown
): void {
  if (typeof reportedPct === 'number' && !Number.isNaN(reportedPct)) {
    summary.reportedProgressPercent = Math.max(0, Math.min(100, Math.round(reportedPct)));
    if (typeof reportedSrc === 'string' && reportedSrc.trim()) {
      summary.reportedProgressSource = reportedSrc.trim();
    } else {
      summary.reportedProgressSource = null;
    }
  } else {
    delete summary.reportedProgressPercent;
    delete summary.reportedProgressSource;
  }
}

export function validate(
  rawJson: string,
  regexNumerics: Map<string, number>,
  sourceText: string
): ExtractedReport {
  let data: ExtractedReport;
  try {
    data = JSON.parse(rawJson) as ExtractedReport;
  } catch (err) {
    logger.error('validate.json_parse_failed', err);
    throw new Error('LLM returned non-JSON response');
  }

  const required = ['summary', 'goals', 'bmps', 'implementation', 'monitoring', 'outreach', 'geographicAreas'];
  for (const field of required) {
    if (!(field in data)) throw new Error(`Missing field: ${field}`);
  }

  const savedReportedPct = data.summary.reportedProgressPercent;
  const savedReportedSrc = data.summary.reportedProgressSource;

  const goalsBefore = data.goals.length;
  const bmpsBefore = data.bmps.length;
  const geoBefore = data.geographicAreas.length;

  const removedGoalTitles: string[] = [];
  data.goals = data.goals.filter(g => {
    if (g == null || typeof g !== 'object') return false;
    const title = safeTrim(g.title);
    if (!title) return false;
    const ok = phraseSupportedBySource(title, sourceText);
    if (!ok) removedGoalTitles.push(title);
    return ok;
  });

  const removedBmpNames: string[] = [];
  data.bmps = data.bmps.filter(b => {
    if (b == null || typeof b !== 'object') return false;
    const name = safeTrim(b.name);
    if (!name) return false;
    const ok = phraseSupportedBySource(name, sourceText);
    if (!ok) removedBmpNames.push(name);
    return ok;
  });

  const removedGeoNames: string[] = [];
  data.geographicAreas = data.geographicAreas.filter(a => {
    if (a == null || typeof a !== 'object') return false;
    const name = safeTrim(a.name);
    if (!name) return false;
    const ok = phraseSupportedBySource(name, sourceText);
    if (!ok) removedGeoNames.push(name);
    return ok;
  });

  logger.info('validate.llm_vs_filter', {
    stage: 'validate',
    goalsFromLlm: goalsBefore,
    goalsAfterFilter: data.goals.length,
    bmpsFromLlm: bmpsBefore,
    bmpsAfterFilter: data.bmps.length,
    geoFromLlm: geoBefore,
    geoAfterFilter: data.geographicAreas.length
  });

  logger.info('validate.hallucination_filter', {
    stage: 'validate',
    goalsRemoved: goalsBefore - data.goals.length,
    bmpsRemoved: bmpsBefore - data.bmps.length,
    geographicAreasRemoved: geoBefore - data.geographicAreas.length,
    removedGoalTitlesSample: removedGoalTitles.slice(0, 5),
    removedBmpNamesSample: removedBmpNames.slice(0, 5),
    removedGeoNamesSample: removedGeoNames.slice(0, 3)
  });

  alignReportNumerics(data, regexNumerics, sourceText);

  const { rate, basis } = computeCompletionRate(data);
  data.summary.completionRate = rate;
  data.summary.completionRateBasis = basis;

  applyImplementationCompletionRate(data);
  applyReportedProgressFromLlm(data.summary, savedReportedPct, savedReportedSrc);

  data.summary.totalGoals = data.goals.length;
  data.summary.totalBMPs = data.bmps.length;

  logger.debug('validate.summary', {
    stage: 'validate',
    completionRate: data.summary.completionRate,
    completionRateBasis: data.summary.completionRateBasis,
    implementationCompletionRate: data.summary.implementationCompletionRate,
    reportedProgressPercent: data.summary.reportedProgressPercent,
    totalGoals: data.summary.totalGoals,
    totalBMPs: data.summary.totalBMPs
  });

  return data;
}
