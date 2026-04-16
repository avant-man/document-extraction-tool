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
  targetAcres: number | null;
  implementedAcres: number | null;
  cost: number | null;
  priority: 'high' | 'medium' | 'low';
}

export interface ImplementationActivity {
  activity: string;
  year: number;
  responsible: string;
  cost: number | null;
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
    /** How completionRate was computed: goal benchmarks, or implementation activity status counts */
    completionRateBasis: 'benchmarks' | 'implementation' | 'none';
    /** Share of implementation activities with status complete (only when benchmarks and implementation both exist) */
    implementationCompletionRate?: number;
    /** Only if the document explicitly states overall project/BMP progress as a percent */
    reportedProgressPercent?: number | null;
    reportedProgressSource?: string | null;
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
