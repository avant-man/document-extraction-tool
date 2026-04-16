import type {
  BMP,
  ExtractedReport,
  GeographicArea,
  Goal,
  ImplementationActivity,
  MonitoringMetric,
  OutreachActivity
} from '../types/extraction';
import { logger } from '../lib/logger';

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function pickMergedSummary(partials: ExtractedReport[]): ExtractedReport['summary'] {
  for (const p of partials) {
    const w = p.summary?.watershedName?.trim();
    if (w) {
      return { ...p.summary };
    }
  }
  return { ...partials[0]!.summary };
}

/**
 * Concatenates array sections from multi-batch Claude passes; dedupes by stable keys.
 * Later batches win on key collision. Summary metadata is taken from the first batch with a non-empty watershed name.
 */
export function mergePartialExtractions(partials: ExtractedReport[]): ExtractedReport {
  if (partials.length === 0) {
    throw new Error('mergePartialExtractions: no partials');
  }
  if (partials.length === 1) {
    return partials[0]!;
  }

  const summary = pickMergedSummary(partials);
  for (const p of partials) {
    const rp = p.summary?.reportedProgressPercent;
    if (typeof rp === 'number' && !Number.isNaN(rp)) {
      summary.reportedProgressPercent = rp;
      summary.reportedProgressSource = p.summary?.reportedProgressSource ?? null;
      break;
    }
  }

  const goalsMap = new Map<string, Goal>();
  for (const p of partials) {
    for (const g of p.goals ?? []) {
      const key = (g.id?.trim() || normKey(g.title)) || '';
      if (!key) continue;
      const prev = goalsMap.get(key);
      if (prev && JSON.stringify(prev) !== JSON.stringify(g)) {
        logger.info('merge.conflict', { entity: 'goal', key, resolution: 'later_batch' });
      }
      goalsMap.set(key, g);
    }
  }

  const bmpsMap = new Map<string, BMP>();
  for (const p of partials) {
    for (const b of p.bmps ?? []) {
      const key = normKey(b.name);
      if (!key) continue;
      const prev = bmpsMap.get(key);
      if (prev && JSON.stringify(prev) !== JSON.stringify(b)) {
        logger.info('merge.conflict', { entity: 'bmp', key, resolution: 'later_batch' });
      }
      bmpsMap.set(key, b);
    }
  }

  const implMap = new Map<string, ImplementationActivity>();
  for (const p of partials) {
    for (const a of p.implementation ?? []) {
      const key = `${a.year}|${normKey(a.activity)}|${normKey(a.responsible)}`;
      implMap.set(key, a);
    }
  }

  const monMap = new Map<string, MonitoringMetric>();
  for (const p of partials) {
    for (const m of p.monitoring ?? []) {
      const key = `${normKey(m.parameter)}|${normKey(m.location)}`;
      monMap.set(key, m);
    }
  }

  const outMap = new Map<string, OutreachActivity>();
  for (const p of partials) {
    for (const o of p.outreach ?? []) {
      const key = `${normKey(o.activity)}|${normKey(o.timeline)}`;
      outMap.set(key, o);
    }
  }

  const geoMap = new Map<string, GeographicArea>();
  for (const p of partials) {
    for (const a of p.geographicAreas ?? []) {
      const key = normKey(a.name);
      if (!key) continue;
      geoMap.set(key, a);
    }
  }

  logger.info('merge.partial_reports', {
    batchCount: partials.length,
    goals: goalsMap.size,
    bmps: bmpsMap.size,
    implementation: implMap.size,
    monitoring: monMap.size,
    outreach: outMap.size,
    geographicAreas: geoMap.size
  });

  return {
    summary,
    goals: [...goalsMap.values()],
    bmps: [...bmpsMap.values()],
    implementation: [...implMap.values()],
    monitoring: [...monMap.values()],
    outreach: [...outMap.values()],
    geographicAreas: [...geoMap.values()]
  };
}
