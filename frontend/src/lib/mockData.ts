import type { ExtractedReport } from '../types/extraction';

export const MOCK_REPORT: ExtractedReport = {
  summary: { totalGoals: 10, totalBMPs: 24, completionRate: 78 },
  goals: [
    {
      id: 'g1',
      title: 'Reduce Sediment Loading',
      description: 'Reduce total suspended sediment in Leaf River watershed',
      category: 'water quality',
      status: 'in_progress',
      benchmarks: [
        { description: 'Install riparian buffers', target: '500 acres', achieved: '380 acres', unit: 'acres', status: 'in_progress' },
        { description: 'Reduce erosion by 30%', target: '30%', achieved: '22%', unit: '%', status: 'not_met' }
      ]
    },
    {
      id: 'g2',
      title: 'Improve Water Quality Monitoring',
      description: 'Establish 5 new monitoring stations',
      category: 'monitoring',
      status: 'completed',
      benchmarks: [
        { description: 'Monitoring stations installed', target: '5', achieved: '5', unit: 'stations', status: 'met' }
      ]
    }
  ],
  bmps: [
    { id: 'b1', name: 'Riparian Buffer Strips', category: 'erosion control', description: 'Vegetated strips along waterways', targetAcres: 500, achievedAcres: 380, status: 'in_progress' },
    { id: 'b2', name: 'Cover Crops', category: 'agriculture', description: 'Winter cover crop implementation', targetAcres: 1200, achievedAcres: 1200, status: 'completed' }
  ],
  implementation: [
    { id: 'i1', description: 'Install riparian buffers on Smith Farm', bmpType: 'Riparian Buffer', location: 'Leake County', targetQuantity: 50, achievedQuantity: 38, unit: 'acres', year: 2023 }
  ],
  monitoring: [
    { id: 'm1', name: 'Leaf River Station 1', description: 'Monthly water quality sampling', location: 'Leake County', frequency: 'monthly', targetValue: 10, currentValue: 8.5, unit: 'mg/L TSS', trend: 'improving' }
  ],
  outreach: [
    { id: 'o1', description: 'Farmer workshop on cover crops', targetAudience: 'Local farmers', participationCount: 45, completionDate: '2023-09', status: 'completed' }
  ],
  geographicAreas: [
    { id: 'ga1', name: 'Leaf River Watershed', county: 'Leake County', watershed: 'Leaf River', acres: 125000, description: 'Primary watershed area' }
  ]
};
