import type { ExtractedReport } from '../../types/extraction';
import GoalsBarChart from '../charts/GoalsBarChart';
import BenchmarkPieChart from '../charts/BenchmarkPieChart';

interface Props {
  report: ExtractedReport;
}

export function SummaryTab({ report }: Props) {
  const { totalGoals, totalBMPs, completionRate } = report.summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard value={String(totalGoals)} label="Total Goals" />
        <StatCard value={String(totalBMPs)} label="Total BMPs" />
        <StatCard value={`${completionRate}%`} label="Completion Rate" />
      </div>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Goal Achievement by Category</h3>
        <GoalsBarChart goals={report.goals} height={250} />
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Benchmark Status Distribution</h3>
        <BenchmarkPieChart goals={report.goals} height={250} />
      </section>
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
