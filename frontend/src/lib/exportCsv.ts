import Papa from 'papaparse';
import type { ExtractedReport } from '../types/extraction';
import { triggerDownload } from './download';

export function exportCsv(report: ExtractedReport, filename: string) {
  const sections: string[] = [];

  // Goals section
  sections.push('=== GOALS ===');
  sections.push(Papa.unparse(report.goals.map(g => ({
    id: g.id, title: g.title, category: g.category, status: g.status, description: g.description
  }))));

  // BMPs section
  sections.push('\n=== BMPs ===');
  sections.push(Papa.unparse(report.bmps.map(b => ({
    id: b.id, name: b.name, category: b.category, status: b.status,
    targetAcres: b.targetAcres ?? '', achievedAcres: b.achievedAcres ?? ''
  }))));

  // Implementation section
  sections.push('\n=== IMPLEMENTATION ===');
  sections.push(Papa.unparse(report.implementation.map(i => ({
    id: i.id, description: i.description, bmpType: i.bmpType,
    location: i.location ?? '', targetQuantity: i.targetQuantity,
    achievedQuantity: i.achievedQuantity, unit: i.unit, year: i.year ?? ''
  }))));

  // Monitoring section
  sections.push('\n=== MONITORING ===');
  sections.push(Papa.unparse(report.monitoring.map(m => ({
    id: m.id, name: m.name, location: m.location, frequency: m.frequency,
    targetValue: m.targetValue ?? '', currentValue: m.currentValue ?? '',
    unit: m.unit, trend: m.trend ?? ''
  }))));

  // Outreach section
  sections.push('\n=== OUTREACH ===');
  sections.push(Papa.unparse(report.outreach.map(o => ({
    id: o.id, description: o.description, targetAudience: o.targetAudience,
    participationCount: o.participationCount ?? '', completionDate: o.completionDate ?? '',
    status: o.status
  }))));

  const blob = new Blob([sections.join('\n')], { type: 'text/csv' });
  triggerDownload(blob, `extraction-${filename}.csv`);
}
