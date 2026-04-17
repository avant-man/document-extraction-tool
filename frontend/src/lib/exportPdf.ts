import { jsPDF } from 'jspdf';
import type { BMP, ExtractedReport } from '../types/extraction';
import { triggerDownload } from './download';

const MARGIN = 14;
const BODY_PT = 10;
const LINE_H = 5.5;
const PAGE_BREAK_Y = 275;

export function exportPdf(report: ExtractedReport, filename: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const newPage = () => {
    doc.addPage();
    y = 20;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_BREAK_Y) newPage();
  };

  const lineCount = (lines: string | string[]) =>
    Array.isArray(lines) ? lines.length : 1;

  const addTitle = (text: string) => {
    ensureSpace(12);
    doc.setFontSize(18).setTextColor(13, 148, 136);
    doc.text(text, MARGIN, y);
    y += 10;
  };

  const addSectionHeader = (text: string) => {
    ensureSpace(16);
    doc.setFontSize(13).setTextColor(30, 64, 175);
    doc.text(text, MARGIN, y);
    y += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 6;
  };

  /** Stacked label then value — avoids horizontal overlap with long labels. */
  const addLabeledBlock = (label: string, value: string) => {
    doc.setFontSize(BODY_PT).setTextColor(60, 60, 60);
    const labelText = label.endsWith(':') ? label : `${label}:`;
    doc.setFont('helvetica', 'bold');
    const labelLines = doc.splitTextToSize(labelText, pageWidth - MARGIN * 2);
    ensureSpace(lineCount(labelLines) * LINE_H + LINE_H * 2);
    doc.setFont('helvetica', 'bold');
    doc.text(labelLines, MARGIN, y);
    y += lineCount(labelLines) * LINE_H + 1;

    doc.setFont('helvetica', 'normal');
    const valueLines = doc.splitTextToSize(value || '—', pageWidth - MARGIN - 4);
    ensureSpace(lineCount(valueLines) * LINE_H + 2);
    doc.text(valueLines, MARGIN + 4, y);
    y += lineCount(valueLines) * LINE_H + 3;
  };

  const addParagraph = (text: string, opts?: { bold?: boolean }) => {
    doc.setFontSize(BODY_PT).setTextColor(60, 60, 60);
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, pageWidth - MARGIN * 2);
    ensureSpace(lineCount(lines) * LINE_H + 2);
    doc.text(lines, MARGIN, y);
    y += lineCount(lines) * LINE_H + 2;
  };

  const dash = (s: string | number | null | undefined) =>
    s === null || s === undefined || s === '' ? '—' : String(s);

  /** BMP title (wrapped) + one detail row with fixed columns. */
  const addBmpEntry = (b: BMP, index: number) => {
    const title = `${index + 1}. ${b.name}`;
    doc.setFontSize(BODY_PT).setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(title, pageWidth - MARGIN * 2);
    ensureSpace(lineCount(titleLines) * LINE_H + LINE_H * 4);
    doc.text(titleLines, MARGIN, y);
    y += lineCount(titleLines) * LINE_H + 2;

    const innerW = pageWidth - MARGIN * 2;
    const wCat = innerW * 0.34;
    const wPri = innerW * 0.12;
    const wTgt = innerW * 0.2;
    const wImp = innerW * 0.2;
    const wCost = innerW * 0.14;

    const xCat = MARGIN;
    const xPri = xCat + wCat;
    const xTgt = xPri + wPri;
    const xImp = xTgt + wTgt;
    const xCost = xImp + wImp;

    const cat = dash(b.category);
    const pri = dash(b.priority);
    const tgt =
      b.targetAcres != null ? `${b.targetAcres} ac` : '—';
    const imp =
      b.implementedAcres != null ? `${b.implementedAcres} ac` : '—';
    const cost =
      b.cost != null ? `$${b.cost.toLocaleString()}` : '—';

    doc.setFont('helvetica', 'normal');
    const linesCat = doc.splitTextToSize(cat, wCat - 1);
    const linesPri = doc.splitTextToSize(pri, wPri - 1);
    const linesTgt = doc.splitTextToSize(tgt, wTgt - 1);
    const linesImp = doc.splitTextToSize(imp, wImp - 1);
    const linesCost = doc.splitTextToSize(cost, wCost - 1);

    const maxLines = Math.max(
      linesCat.length,
      linesPri.length,
      linesTgt.length,
      linesImp.length,
      linesCost.length,
      1
    );
    ensureSpace(maxLines * LINE_H + 4);

    const rowY = y;
    doc.text(linesCat, xCat, rowY);
    doc.text(linesPri, xPri, rowY);
    doc.text(linesTgt, xTgt, rowY);
    doc.text(linesImp, xImp, rowY);
    doc.text(linesCost, xCost, rowY);

    y += maxLines * LINE_H + 4;
  };

  // Cover
  addTitle('Watershed Plan — Extraction Report');
  doc.setFontSize(11).setTextColor(100);
  doc.setFont('helvetica', 'normal');
  ensureSpace(24);
  doc.text(`Watershed: ${report.summary.watershedName}`, MARGIN, y);
  y += 6;
  doc.text(`Plan year: ${report.summary.planYear}`, MARGIN, y);
  y += 6;
  doc.text(`Geographic scope: ${report.summary.geographicScope}`, MARGIN, y);
  y += 6;
  doc.text(`Source file: ${filename}`, MARGIN, y);
  y += 6;
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, MARGIN, y);
  y += 10;

  // Summary
  addSectionHeader('Summary');
  addLabeledBlock('Total estimated cost', `$${report.summary.totalEstimatedCost.toLocaleString()}`);
  addLabeledBlock('Total goals', String(report.summary.totalGoals));
  addLabeledBlock('Total BMPs', String(report.summary.totalBMPs));
  addLabeledBlock(
    'Completion rate',
    `${report.summary.completionRate}% (${report.summary.completionRateBasis})`
  );
  if (typeof report.summary.implementationCompletionRate === 'number') {
    addLabeledBlock(
      'Implementation activities complete',
      `${report.summary.implementationCompletionRate}%`
    );
  }
  if (typeof report.summary.reportedProgressPercent === 'number') {
    addLabeledBlock(
      'Document-reported progress',
      `${report.summary.reportedProgressPercent}%${report.summary.reportedProgressSource ? ` — ${report.summary.reportedProgressSource}` : ''}`
    );
  }
  y += 4;

  // Goals
  addSectionHeader('Goals');
  report.goals.forEach((g, i) => {
    ensureSpace(28);
    addParagraph(`Goal ${i + 1}: ${g.title}`, { bold: true });
    addLabeledBlock('Goal ID', g.id);
    const ctx = [
      g.pollutants?.length ? `Pollutants: ${g.pollutants.join(', ')}` : '',
      g.targetReduction != null ? `Target reduction: ${g.targetReduction}%` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    addLabeledBlock('Context', ctx || '—');
    if (g.description) addLabeledBlock('Description', g.description);

    if (g.benchmarks.length > 0) {
      addParagraph('Benchmarks:', { bold: true });
      g.benchmarks.forEach((bm, j) => {
        ensureSpace(22);
        addParagraph(`  ${j + 1}. ${bm.description}`, { bold: true });
        addLabeledBlock('    Target / current', `${bm.current} / ${bm.target} ${bm.unit}`);
        addLabeledBlock('    Status', bm.status);
      });
    }
    y += 2;
  });
  y += 4;

  // BMPs
  addSectionHeader('Best Management Practices');
  report.bmps.forEach((b, i) => addBmpEntry(b, i));
  y += 4;

  // Implementation
  if (report.implementation.length > 0) {
    addSectionHeader('Implementation activities');
    report.implementation.forEach((row, i) => {
      ensureSpace(30);
      addParagraph(`${i + 1}. ${row.activity}`, { bold: true });
      addLabeledBlock('    Year', String(row.year));
      addLabeledBlock('    Responsible', row.responsible);
      addLabeledBlock('    Cost', row.cost != null ? `$${row.cost.toLocaleString()}` : '—');
      addLabeledBlock('    Status', row.status);
      y += 2;
    });
    y += 4;
  }

  // Monitoring
  if (report.monitoring.length > 0) {
    addSectionHeader('Monitoring');
    report.monitoring.forEach((m, i) => {
      ensureSpace(32);
      addParagraph(`${i + 1}. ${m.parameter}`, { bold: true });
      addLabeledBlock('    Location', m.location);
      addLabeledBlock('    Frequency', m.frequency);
      addLabeledBlock('    Target', m.target);
      addLabeledBlock('    Unit', m.unit);
      y += 2;
    });
    y += 4;
  }

  // Outreach
  if (report.outreach.length > 0) {
    addSectionHeader('Outreach');
    report.outreach.forEach((o, i) => {
      ensureSpace(32);
      addParagraph(`${i + 1}. ${o.activity}`, { bold: true });
      addLabeledBlock('    Target audience', o.targetAudience);
      addLabeledBlock('    Timeline', o.timeline);
      addLabeledBlock('    Responsible', o.responsible);
      y += 2;
    });
    y += 4;
  }

  // Geographic areas
  if (report.geographicAreas.length > 0) {
    addSectionHeader('Geographic areas');
    report.geographicAreas.forEach(a => {
      const detail = [a.county, a.watershed, a.acres != null ? `${a.acres.toLocaleString()} acres` : '']
        .filter(Boolean)
        .join(', ');
      addLabeledBlock(a.name, detail || '—');
    });
  }

  const pdfBlob = doc.output('blob');
  triggerDownload(pdfBlob, `extraction-${filename}.pdf`);
}
