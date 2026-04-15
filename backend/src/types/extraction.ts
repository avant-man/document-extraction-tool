export interface GeographicArea {
  name: string;
  county: string;
  watershed: string;
  acres?: number;
}

export interface Benchmark {
  description: string;
  target: number;
  unit: string;
  current: number;
  status: 'met' | 'in-progress' | 'not-started';
}

export interface BMP {
  name: string;
  category: string;
  targetAcres: number;
  implementedAcres: number;
  cost: number;
  priority: 'high' | 'medium' | 'low';
}

export interface ImplementationActivity {
  activity: string;
  year: number;
  responsible: string;
  cost: number;
  status: 'planned' | 'in-progress' | 'complete';
}

export interface MonitoringMetric {
  parameter: string;
  location: string;
  frequency: string;
  target: string;
  unit: string;
}

export interface OutreachActivity {
  activity: string;
  targetAudience: string;
  timeline: string;
  responsible: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  benchmarks: Benchmark[];
  pollutants: string[];
  targetReduction: number;
}

export interface ExtractedReport {
  summary: {
    watershedName: string;
    planYear: number;
    totalGoals: number;
    totalBMPs: number;
    completionRate: number;
    totalEstimatedCost: number;
    geographicScope: string;
  };
  goals: Goal[];
  bmps: BMP[];
  implementation: ImplementationActivity[];
  monitoring: MonitoringMetric[];
  outreach: OutreachActivity[];
  geographicAreas: GeographicArea[];
}

export interface AnnotatedDocument {
  text: string;
  regexNumerics: Map<string, number>;
}
