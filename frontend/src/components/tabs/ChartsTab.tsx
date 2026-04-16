import type { ReactNode } from 'react';
import type { ExtractedReport } from '../../types/extraction';
import GoalsBarChart from '../charts/GoalsBarChart';
import BenchmarkPieChart from '../charts/BenchmarkPieChart';
import ImplementationBarChart from '../charts/ImplementationBarChart';

interface Props {
  report: ExtractedReport;
}

function chartCard(children: ReactNode) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 sm:p-5 min-h-0 flex flex-col">
      {children}
    </div>
  );
}

export function ChartsTab({ report }: Props) {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Goal Achievement by Category</h3>
        {chartCard(<GoalsBarChart goals={report.goals} height={300} />)}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-stretch">
        <section className="flex flex-col min-h-[360px]">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Benchmark Status Distribution</h3>
          <div className="flex-1 min-h-0">{chartCard(<BenchmarkPieChart goals={report.goals} height={280} />)}</div>
        </section>
        <section className="flex flex-col min-h-[360px]">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">BMP Implementation Progress</h3>
          <div className="flex-1 min-h-0">{chartCard(<ImplementationBarChart bmps={report.bmps} height={280} />)}</div>
        </section>
      </div>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Geographic Areas</h3>
        <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 sm:p-5 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-2 px-3 font-medium text-gray-600">Name</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">County</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Watershed</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Acres</th>
              </tr>
            </thead>
            <tbody>
              {report.geographicAreas.map((area, idx) => (
                <tr key={`${area.name}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-900">{area.name}</td>
                  <td className="py-2 px-3 text-gray-600">{area.county ?? '—'}</td>
                  <td className="py-2 px-3 text-gray-600">{area.watershed ?? '—'}</td>
                  <td className="py-2 px-3 text-gray-600 text-right">{area.acres?.toLocaleString() ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
