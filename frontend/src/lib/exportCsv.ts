import Papa from 'papaparse';
import type { ExtractedReport } from '../types/extraction';
import { triggerDownload } from './download';

export function exportCsv(report: ExtractedReport, filename: string) {
  const sections: string[] = [];

  sections.push('=== SUMMARY ===');
  sections.push(
    Papa.unparse([
      {
        watershedName: report.summary.watershedName,
        planYear: report.summary.planYear,
        totalGoals: report.summary.totalGoals,
        totalBMPs: report.summary.totalBMPs,
        completionRate: report.summary.completionRate,
        completionRateBasis: report.summary.completionRateBasis,
        implementationCompletionRate: report.summary.implementationCompletionRate ?? '',
        reportedProgressPercent: report.summary.reportedProgressPercent ?? '',
        reportedProgressSource: report.summary.reportedProgressSource ?? '',
        totalEstimatedCost: report.summary.totalEstimatedCost,
        geographicScope: report.summary.geographicScope,
      },
    ])
  );

  sections.push('\n=== GOALS ===');
  sections.push(
    Papa.unparse(
      report.goals.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        pollutants: g.pollutants?.join('; ') ?? '',
        targetReduction: g.targetReduction,
      }))
    )
  );

  sections.push('\n=== BMPs ===');
  sections.push(
    Papa.unparse(
      report.bmps.map(b => ({
        name: b.name,
        category: b.category,
        targetAcres: b.targetAcres ?? '',
        implementedAcres: b.implementedAcres ?? '',
        cost: b.cost ?? '',
        priority: b.priority,
      }))
    )
  );

  sections.push('\n=== IMPLEMENTATION ===');
  sections.push(
    Papa.unparse(
      report.implementation.map(i => ({
        activity: i.activity,
        year: i.year,
        responsible: i.responsible,
        cost: i.cost ?? '',
        status: i.status,
      }))
    )
  );

  sections.push('\n=== MONITORING ===');
  sections.push(
    Papa.unparse(
      report.monitoring.map(m => ({
        parameter: m.parameter,
        location: m.location,
        frequency: m.frequency,
        target: m.target,
        unit: m.unit,
      }))
    )
  );

  sections.push('\n=== OUTREACH ===');
  sections.push(
    Papa.unparse(
      report.outreach.map(o => ({
        activity: o.activity,
        targetAudience: o.targetAudience,
        timeline: o.timeline,
        responsible: o.responsible,
      }))
    )
  );

  sections.push('\n=== GEOGRAPHIC AREAS ===');
  sections.push(
    Papa.unparse(
      report.geographicAreas.map(a => ({
        name: a.name,
        county: a.county,
        watershed: a.watershed,
        acres: a.acres ?? '',
      }))
    )
  );

  const blob = new Blob([sections.join('\n')], { type: 'text/csv' });
  triggerDownload(blob, `extraction-${filename}.csv`);
}
