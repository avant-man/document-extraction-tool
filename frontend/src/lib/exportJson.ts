import type { ExtractedReport } from '../types/extraction';
import { triggerDownload } from './download';

export function exportJson(report: ExtractedReport, filename: string) {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  triggerDownload(blob, `extraction-${filename}.json`);
}
