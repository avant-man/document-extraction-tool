/** Mirrors API / backend `ExtractedReport` (POST /api/extract). */

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
    completionRateBasis: 'benchmarks' | 'implementation' | 'none';
    implementationCompletionRate?: number;
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

export interface ExtractionWarning {
  code: string;
  message: string;
}

/** POST /api/extract JSON body: report fields plus optional server warnings (OCR, low text). */
export type ExtractionApiResponse = ExtractedReport & {
  extractionWarnings?: ExtractionWarning[];
};

/** GET /api/extract/jobs/:jobId while running or completed. */
export type ExtractionJobPollResponse = {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: string;
  progress: {
    ocrChunk: number | null;
    ocrChunksTotal: number | null;
    claudeBatch: number | null;
    claudeBatchesTotal: number | null;
  };
  result: ExtractionApiResponse | null;
  error?: string | null;
};
