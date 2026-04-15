export interface ExtractedReport {
  summary: { totalGoals: number; totalBMPs: number; completionRate: number; };
  goals: Goal[];
  bmps: BMP[];
  implementation: ImplementationActivity[];
  monitoring: MonitoringMetric[];
  outreach: OutreachActivity[];
  geographicAreas: GeographicArea[];
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'not_started' | 'in_progress' | 'completed';
  benchmarks: Benchmark[];
}

export interface Benchmark {
  description: string;
  target: string;
  achieved: string;
  unit: string;
  status: 'met' | 'not_met' | 'in_progress';
}

export interface BMP {
  id: string;
  name: string;
  category: string;
  description: string;
  targetAcres?: number;
  achievedAcres?: number;
  status: string;
}

export interface ImplementationActivity {
  id: string;
  description: string;
  bmpType: string;
  location?: string;
  targetQuantity: number;
  achievedQuantity: number;
  unit: string;
  year?: number;
}

export interface MonitoringMetric {
  id: string;
  name: string;
  description: string;
  location: string;
  frequency: string;
  targetValue?: number;
  currentValue?: number;
  unit: string;
  trend?: 'improving' | 'degrading' | 'stable';
}

export interface OutreachActivity {
  id: string;
  description: string;
  targetAudience: string;
  participationCount?: number;
  completionDate?: string;
  status: string;
}

export interface GeographicArea {
  id: string;
  name: string;
  county?: string;
  watershed?: string;
  acres?: number;
  description: string;
}
