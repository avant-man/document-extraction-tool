import { describe, expect, it } from 'vitest';
import { mergePartialExtractions } from './mergeExtractedReports';
import type { ExtractedReport } from '../types/extraction';

const emptySummary = (): ExtractedReport['summary'] => ({
  watershedName: '',
  planYear: 0,
  totalGoals: 0,
  totalBMPs: 0,
  completionRate: 0,
  completionRateBasis: 'none',
  totalEstimatedCost: 0,
  geographicScope: ''
});

describe('mergePartialExtractions', () => {
  it('merges bmps and prefers later batch on duplicate name', () => {
    const a: ExtractedReport = {
      summary: { ...emptySummary(), watershedName: 'W', planYear: 2020 },
      goals: [],
      bmps: [{ name: 'Fence', category: 'x', targetAcres: 1, implementedAcres: null, cost: null, priority: 'low' }],
      implementation: [],
      monitoring: [],
      outreach: [],
      geographicAreas: []
    };
    const b: ExtractedReport = {
      summary: { ...emptySummary() },
      goals: [],
      bmps: [{ name: 'Fence', category: 'x', targetAcres: 99, implementedAcres: null, cost: null, priority: 'low' }],
      implementation: [],
      monitoring: [],
      outreach: [],
      geographicAreas: []
    };
    const m = mergePartialExtractions([a, b]);
    expect(m.summary.watershedName).toBe('W');
    expect(m.bmps).toHaveLength(1);
    expect(m.bmps[0]!.targetAcres).toBe(99);
  });

  it('does not throw when JSON nulls appear on string fields (batched Claude output)', () => {
    const a = {
      summary: { ...emptySummary(), watershedName: 'W' },
      goals: [{ id: null, title: null, description: '', benchmarks: [], pollutants: [], targetReduction: 0 }],
      bmps: [{ name: null, category: 'x', targetAcres: 1, implementedAcres: null, cost: null, priority: 'low' }],
      implementation: [{ year: 2020, activity: null, responsible: null, cost: null, status: 'complete' }],
      monitoring: [{ parameter: null, location: null, frequency: '', target: '', unit: '' }],
      outreach: [{ activity: null, targetAudience: '', timeline: null, responsible: '' }],
      geographicAreas: [{ name: null, county: '', watershed: '' }]
    } as unknown as ExtractedReport;
    const b: ExtractedReport = {
      summary: { ...emptySummary() },
      goals: [],
      bmps: [{ name: 'Ok', category: 'y', targetAcres: 2, implementedAcres: null, cost: null, priority: 'low' }],
      implementation: [],
      monitoring: [],
      outreach: [],
      geographicAreas: []
    };
    const m = mergePartialExtractions([a, b]);
    expect(m.summary.watershedName).toBe('W');
    expect(m.bmps.some(x => x.name === 'Ok')).toBe(true);
  });

  it('returns single partial unchanged', () => {
    const one: ExtractedReport = {
      summary: { ...emptySummary(), watershedName: 'Only' },
      goals: [],
      bmps: [],
      implementation: [],
      monitoring: [],
      outreach: [],
      geographicAreas: []
    };
    expect(mergePartialExtractions([one])).toEqual(one);
  });
});
