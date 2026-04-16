import type { ExtractedReport } from '../../types/extraction';
import GoalsBarChart from '../charts/GoalsBarChart';
import BenchmarkPieChart from '../charts/BenchmarkPieChart';

interface Props {
  report: ExtractedReport;
}

function completionLabel(basis: ExtractedReport['summary']['completionRateBasis']): string {
  if (basis === 'benchmarks') return 'Benchmark milestones met';
  if (basis === 'implementation') return 'Implementation activities marked complete';
  return 'No benchmark or implementation data';
}

export function SummaryTab({ report }: Props) {
  const s = report.summary;
  const {
    totalGoals,
    totalBMPs,
    completionRate,
    completionRateBasis,
    implementationCompletionRate,
    reportedProgressPercent,
    reportedProgressSource,
    watershedName,
    planYear,
    totalEstimatedCost,
    geographicScope
  } = s;

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500 leading-relaxed">
        Derived from extracted benchmark statuses; many watershed plans do not state a single completion
        percentage (see milestones and tables in the PDF).
      </p>

      <section className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 sm:p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Plan overview</h3>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-gray-500">Watershed</dt>
            <dd className="mt-0.5 font-medium text-gray-900 break-words">{watershedName || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Plan year</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{planYear ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Estimated total cost</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              {typeof totalEstimatedCost === 'number'
                ? `$${totalEstimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Geographic scope</dt>
            <dd className="mt-0.5 text-gray-900 break-words">{geographicScope || '—'}</dd>
          </div>
        </dl>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard value={String(totalGoals)} label="Total Goals" />
        <StatCard value={String(totalBMPs)} label="Total BMPs" />
        <div>
          <StatCard value={`${completionRate}%`} label="Completion Rate" />
          <p className="text-xs text-gray-500 text-center mt-2 px-1">{completionLabel(completionRateBasis)}</p>
          {typeof implementationCompletionRate === 'number' && completionRateBasis === 'benchmarks' ? (
            <p className="text-xs text-gray-600 text-center mt-1 px-1">
              Activities complete: {implementationCompletionRate}%
            </p>
          ) : null}
          {typeof reportedProgressPercent === 'number' ? (
            <p className="text-xs text-amber-800 text-center mt-2 px-1 bg-amber-50 rounded py-1 border border-amber-100">
              Document-reported: {reportedProgressPercent}%
              {reportedProgressSource ? ` — ${reportedProgressSource}` : ''}
            </p>
          ) : null}
        </div>
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
