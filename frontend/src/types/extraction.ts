export interface Benchmark {
  description: string;
  target: string;
  achieved: string;
  unit: string;
  status: 'met' | 'not_met' | 'in_progress';
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'completed' | 'in_progress' | 'not_started';
  benchmarks: Benchmark[];
}

export interface BMP {
  id: string;
  name: string;
  category: string;
  description?: string;
  targetAcres: number | null;
  achievedAcres: number | null;
  status: 'completed' | 'in_progress' | 'not_started';
}

export interface GeographicArea {
  id: string;
  name: string;
  county?: string | null;
  watershed?: string | null;
  acres?: number | null;
}

export interface ImplementationActivity {
  id: string;
  description: string;
  bmpType: string;
  location: string;
  targetQuantity: number;
  achievedQuantity: number;
  unit: string;
  year: number;
}

export interface MonitoringMetric {
  id: string;
  name: string;
  description: string;
  location: string;
  frequency: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  trend: 'improving' | 'degrading' | 'stable' | null;
}

export interface OutreachActivity {
  id: string;
  description: string;
  targetAudience: string;
  participationCount: number;
  completionDate: string;
  status: 'completed' | 'in_progress' | 'planned';
}

export interface ExtractedReport {
  summary: {
    watershedName?: string;
    planYear?: number;
    totalGoals: number;
    totalBMPs: number;
    completionRate: number;
    totalEstimatedCost?: number;
    geographicScope?: string;
  };
  goals: Goal[];
  bmps: BMP[];
  implementation: ImplementationActivity[];
  monitoring: MonitoringMetric[];
  outreach: OutreachActivity[];
  geographicAreas: GeographicArea[];
}
