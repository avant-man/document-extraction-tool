import type { MonitoringMetric } from '../../types/extraction';

function renderTrend(trend: MonitoringMetric['trend']) {
  if (trend === 'improving') return <span className="text-green-600 font-bold">↑</span>;
  if (trend === 'degrading') return <span className="text-red-600 font-bold">↓</span>;
  if (trend === 'stable')    return <span className="text-gray-500">→</span>;
  return <span className="text-gray-400">—</span>;
}

interface Props {
  metrics: MonitoringMetric[];
}

export function MonitoringTab({ metrics }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="pb-2">Name</th>
            <th className="pb-2">Location</th>
            <th className="pb-2">Frequency</th>
            <th className="pb-2">Target</th>
            <th className="pb-2">Current</th>
            <th className="pb-2">Unit</th>
            <th className="pb-2">Trend</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map(m => (
            <tr key={m.id} className="border-b border-gray-100">
              <td className="py-2 pr-4">{m.name}</td>
              <td className="py-2 pr-4">{m.location}</td>
              <td className="py-2 pr-4">{m.frequency}</td>
              <td className="py-2 pr-4">{m.targetValue ?? '—'}</td>
              <td className="py-2 pr-4">{m.currentValue ?? '—'}</td>
              <td className="py-2 pr-4">{m.unit}</td>
              <td className="py-2 pr-4">{renderTrend(m.trend)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
