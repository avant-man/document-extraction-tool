import { describe, it, expect } from 'vitest';
import { validate } from './validator';

describe('validate', () => {
  const baseReport = () => ({
    summary: {
      watershedName: 'Test',
      planYear: 2024,
      totalGoals: 0,
      totalBMPs: 0,
      completionRate: 0,
      completionRateBasis: 'none' as const,
      totalEstimatedCost: 0,
      geographicScope: 'local'
    },
    goals: [] as any[],
    bmps: [] as any[],
    implementation: [] as any[],
    monitoring: [] as any[],
    outreach: [] as any[],
    geographicAreas: [] as any[]
  });

  it('keeps goals when title is supported by token overlap', () => {
    const sourceText =
      'Management Goals. Reduce sediment loads from agricultural lands in the study area.';
    const raw = JSON.stringify({
      ...baseReport(),
      goals: [
        {
          id: 'g1',
          title: 'Reduce sediment loads from agricultural lands',
          description: 'd',
          benchmarks: [],
          pollutants: [],
          targetReduction: 0
        }
      ]
    });
    const out = validate(raw, new Map(), sourceText);
    expect(out.goals).toHaveLength(1);
  });

  it('drops goals when title has no support in source', () => {
    const sourceText = 'only monitoring and outreach';
    const raw = JSON.stringify({
      ...baseReport(),
      goals: [
        {
          id: 'g1',
          title: 'Completely fabricated goal title xyz123',
          description: 'd',
          benchmarks: [],
          pollutants: [],
          targetReduction: 0
        }
      ]
    });
    const out = validate(raw, new Map(), sourceText);
    expect(out.goals).toHaveLength(0);
  });

  it('uses implementation status for completionRate when no benchmarks', () => {
    const raw = JSON.stringify({
      ...baseReport(),
      goals: [],
      implementation: [
        { activity: 'a', year: 2024, responsible: 'x', cost: null, status: 'complete' },
        { activity: 'b', year: 2024, responsible: 'y', cost: null, status: 'planned' }
      ]
    });
    const out = validate(raw, new Map(), 'text');
    expect(out.summary.completionRate).toBe(50);
    expect(out.summary.completionRateBasis).toBe('implementation');
  });

  it('uses benchmarks for completionRate when present', () => {
    const raw = JSON.stringify({
      ...baseReport(),
      goals: [
        {
          id: 'g1',
          title: 'Goal One Title Here',
          description: 'd',
          benchmarks: [
            {
              description: 'b1',
              target: 1,
              unit: 'u',
              current: 0,
              status: 'met'
            },
            {
              description: 'b2',
              target: 1,
              unit: 'u',
              current: 0,
              status: 'not-started'
            }
          ],
          pollutants: [],
          targetReduction: 0
        }
      ]
    });
    const out = validate(raw, new Map(), 'Goal One Title Here');
    expect(out.summary.completionRate).toBe(50);
    expect(out.summary.completionRateBasis).toBe('benchmarks');
  });

  it('preserves reportedProgressPercent and reportedProgressSource from LLM', () => {
    const raw = JSON.stringify({
      ...baseReport(),
      summary: {
        ...baseReport().summary,
        reportedProgressPercent: 42.7,
        reportedProgressSource: 'Executive summary'
      },
      goals: [],
      implementation: []
    });
    const out = validate(raw, new Map(), 'text');
    expect(out.summary.reportedProgressPercent).toBe(43);
    expect(out.summary.reportedProgressSource).toBe('Executive summary');
  });

  it('sets implementationCompletionRate when benchmarks and implementation both exist', () => {
    const raw = JSON.stringify({
      ...baseReport(),
      goals: [
        {
          id: 'g1',
          title: 'Reduce loads from agricultural lands',
          description: 'd',
          benchmarks: [
            {
              description: 'b1',
              target: 1,
              unit: 'u',
              current: 0,
              status: 'met'
            }
          ],
          pollutants: [],
          targetReduction: 0
        }
      ],
      implementation: [
        { activity: 'a', year: 2024, responsible: 'x', cost: null, status: 'complete' },
        { activity: 'b', year: 2024, responsible: 'y', cost: null, status: 'complete' },
        { activity: 'c', year: 2024, responsible: 'z', cost: null, status: 'planned' }
      ]
    });
    const out = validate(raw, new Map(), 'Reduce loads from agricultural lands');
    expect(out.summary.completionRateBasis).toBe('benchmarks');
    expect(out.summary.implementationCompletionRate).toBe(67);
  });

  it('drops invalid reportedProgressPercent', () => {
    const raw = JSON.stringify({
      ...baseReport(),
      summary: {
        ...baseReport().summary,
        reportedProgressPercent: 'nope'
      },
      goals: [],
      implementation: []
    });
    const out = validate(raw, new Map(), 'text');
    expect(out.summary.reportedProgressPercent).toBeUndefined();
  });

  it('does not throw when goals array contains null or non-string titles', () => {
    const raw = JSON.stringify({
      ...baseReport(),
      goals: [
        null,
        {
          id: 'g1',
          title: 123 as unknown as string,
          description: 'd',
          benchmarks: [],
          pollutants: [],
          targetReduction: 0
        },
        {
          id: 'g2',
          title: 'Reduce sediment loads from agricultural lands',
          description: 'd',
          benchmarks: [null, { description: 'b1', target: 1, unit: 'u', current: 0, status: 'met' }],
          pollutants: [],
          targetReduction: 0
        }
      ]
    });
    const sourceText =
      'Management Goals. Reduce sediment loads from agricultural lands in the study area.';
    const out = validate(raw, new Map(), sourceText);
    expect(out.goals).toHaveLength(1);
    expect(out.goals[0]!.title).toBe('Reduce sediment loads from agricultural lands');
    expect(out.summary.completionRateBasis).toBe('benchmarks');
  });
});
