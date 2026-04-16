import { jsPDF } from 'jspdf';
import type { ExtractedReport } from '../types/extraction';
import { triggerDownload } from './download';

export function exportPdf(report: ExtractedReport, filename: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const addTitle = (text: string) => {
    doc.setFontSize(18).setTextColor(13, 148, 136); // teal-600
    doc.text(text, 14, y);
    y += 10;
  };

  const addSectionHeader = (text: string) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(13).setTextColor(30, 64, 175); // blue-800
    doc.text(text, 14, y);
    y += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;
  };

  const addRow = (label: string, value: string) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFontSize(10).setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    const labelLines = doc.splitTextToSize(label + ':', 52);
    doc.text(labelLines[0], 14, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value, pageWidth - 80);
    doc.text(lines, 70, y);
    y += 6 * lines.length + 2;
  };

  // Cover page
  addTitle('Watershed Plan — Extraction Report');
  doc.setFontSize(11).setTextColor(100);
  doc.text(`Source: ${filename}`, 14, y); y += 6;
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, y); y += 14;

  // Summary
  addSectionHeader('Summary');
  addRow('Total Goals', String(report.summary.totalGoals));
  addRow('Total BMPs', String(report.summary.totalBMPs));
  addRow('Completion Rate', `${report.summary.completionRate}%`);
  y += 6;

  // Goals
  addSectionHeader('Goals');
  report.goals.forEach((g, i) => {
    if (y > 260) { doc.addPage(); y = 20; }
    addRow(`${i + 1}. ${g.title}`, `[${g.category}] ${g.status}`);
    if (g.description) addRow('   Description', g.description);
  });
  y += 6;

  // BMPs
  addSectionHeader('Best Management Practices');
  report.bmps.forEach((b, i) => {
    if (y > 260) { doc.addPage(); y = 20; }
    const target = b.targetAcres != null ? `Target: ${b.targetAcres} acres` : '';
    const achieved = b.achievedAcres != null ? `Achieved: ${b.achievedAcres} acres` : '';
    addRow(`${i + 1}. ${b.name}`, [b.category, b.status, target, achieved].filter(Boolean).join(' · '));
  });

  // Geographic Areas
  if (report.geographicAreas.length > 0) {
    y += 6;
    addSectionHeader('Geographic Areas');
    report.geographicAreas.forEach(a => {
      addRow(a.name, [a.county, a.watershed, a.acres ? `${a.acres.toLocaleString()} acres` : ''].filter(Boolean).join(', '));
    });
  }

  const pdfBlob = doc.output('blob');
  triggerDownload(pdfBlob, `extraction-${filename}.pdf`);
}
