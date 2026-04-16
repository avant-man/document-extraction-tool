import type { ExtractedReport } from '../types/extraction';

export const MOCK_REPORT: ExtractedReport = {
  summary: {
    watershedName: 'Leaf River Watershed',
    planYear: 2023,
    totalGoals: 2,
    totalBMPs: 3,
    completionRate: 50,
    completionRateBasis: 'benchmarks',
    implementationCompletionRate: 100,
    totalEstimatedCost: 2500000,
    geographicScope: 'North Mississippi',
  },
  goals: [
    {
      id: 'g1',
      title: 'Reduce Sediment Loading',
      description: 'Reduce total suspended sediment in Leaf River watershed',
      pollutants: ['Sediment', 'TSS'],
      targetReduction: 30,
      benchmarks: [
        {
          description: 'Install riparian buffers',
          target: 500,
          current: 380,
          unit: 'acres',
          status: 'in-progress',
        },
        {
          description: 'Reduce erosion by 30%',
          target: 30,
          current: 22,
          unit: '%',
          status: 'not-started',
        },
      ],
    },
    {
      id: 'g2',
      title: 'Improve Water Quality Monitoring',
      description: 'Establish 5 new monitoring stations',
      pollutants: ['Nutrients'],
      targetReduction: 15,
      benchmarks: [
        {
          description: 'Monitoring stations installed',
          target: 5,
          current: 5,
          unit: 'stations',
          status: 'met',
        },
      ],
    },
  ],
  bmps: [
    {
      name: 'Riparian Buffer Strips',
      category: 'Vegetative',
      targetAcres: 500,
      implementedAcres: 380,
      cost: 120000,
      priority: 'high',
    },
    {
      name: 'Cover Crops',
      category: 'Vegetative',
      targetAcres: 1200,
      implementedAcres: 1200,
      cost: 85000,
      priority: 'medium',
    },
    {
      name: 'Constructed Wetlands',
      category: 'Structural',
      targetAcres: 150,
      implementedAcres: 45,
      cost: 400000,
      priority: 'high',
    },
  ],
  implementation: [
    {
      activity: 'Install riparian buffers on Smith Farm',
      year: 2023,
      responsible: 'NRCS, SWCD',
      cost: 45000,
      status: 'in-progress',
    },
  ],
  monitoring: [
    {
      parameter: 'TSS',
      location: 'Leaf River Station 1',
      frequency: 'monthly',
      target: '< 10 mg/L',
      unit: 'mg/L',
    },
  ],
  outreach: [
    {
      activity: 'Farmer workshop on cover crops',
      targetAudience: 'Local farmers',
      timeline: 'Fall 2023',
      responsible: 'Extension',
    },
  ],
  geographicAreas: [
    {
      name: 'Leaf River Watershed',
      county: 'Leake',
      watershed: 'Leaf River',
      acres: 125000,
    },
    {
      name: 'Upper Tributary',
      county: 'Scott',
      watershed: 'Leaf River',
      acres: 45000,
    },
  ],
};
