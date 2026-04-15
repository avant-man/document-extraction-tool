import type { ExtractedReport } from '../../types/extraction';

interface Props {
  report: ExtractedReport;
}

export function SummaryTab({ report }: Props) {
  const { totalGoals, totalBMPs, completionRate } = report.summary;

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard value={String(totalGoals)} label="Total Goals" />
        <StatCard value={String(totalBMPs)} label="Total BMPs" />
        <StatCard value={`${completionRate}%`} label="Completion Rate" />
      </div>

      <div id="goals-chart" className="h-48 flex items-center justify-center bg-gray-50 rounded-xl mt-6">
        <p className="text-gray-400 text-sm">Charts loading...</p>
      </div>
      <div id="benchmark-chart" className="h-48 flex items-center justify-center bg-gray-50 rounded-xl mt-4">
        <p className="text-gray-400 text-sm">Charts loading...</p>
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 text-center border border-gray-100">
      <p className="text-4xl font-bold text-blue-600">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
