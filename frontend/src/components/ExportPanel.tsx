import { useState } from 'react';
import type { ExtractedReport } from '../types/extraction';
import { exportJson } from '../lib/exportJson';
import { exportCsv } from '../lib/exportCsv';
import { exportPdf } from '../lib/exportPdf';

interface ExportPanelProps {
  report: ExtractedReport;
  filename: string;
}

export function ExportPanel({ report, filename }: ExportPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handle = async (format: string, fn: () => void) => {
    setLoading(format);
    await new Promise(r => setTimeout(r, 50)); // let UI update
    try { fn(); } finally { setLoading(null); }
  };

  const base = filename.replace(/\.pdf$/i, '');

  return (
    <div className="flex items-center gap-3 py-4 border-t border-gray-200 mt-6">
      <span className="text-sm font-medium text-gray-600">Export:</span>

      {(['JSON', 'CSV', 'PDF'] as const).map(fmt => (
        <button
          key={fmt}
          disabled={loading !== null}
          onClick={() => handle(fmt, () => {
            if (fmt === 'JSON') exportJson(report, base);
            if (fmt === 'CSV') exportCsv(report, base);
            if (fmt === 'PDF') exportPdf(report, base);
          })}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300
                     hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading === fmt ? '...' : `↓ ${fmt}`}
        </button>
      ))}
    </div>
  );
}
