import type { MonitoringMetric } from '../../types/extraction';

interface Props {
  metrics: MonitoringMetric[];
}

export function MonitoringTab({ metrics }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[48rem]">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="pb-2 pr-3 min-w-0 max-w-[14%] break-words">Parameter</th>
            <th className="pb-2 pr-3 min-w-0 max-w-[18%] break-words">Location</th>
            <th className="pb-2 pr-3 min-w-0 max-w-[18%] break-words">Frequency</th>
            <th className="pb-2 pr-3 min-w-0 break-words">Target</th>
            <th className="pb-2 pr-3 min-w-0 max-w-[10%] break-words">Unit</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, i) => (
            <tr key={`${m.parameter}-${i}`} className="border-b border-gray-100 align-top">
              <td className="py-2 pr-3 min-w-0 break-words">{m.parameter}</td>
              <td className="py-2 pr-3 min-w-0 break-words">{m.location}</td>
              <td className="py-2 pr-3 min-w-0 break-words">{m.frequency}</td>
              <td className="py-2 pr-3 min-w-0 break-words">{m.target}</td>
              <td className="py-2 pr-3 min-w-0 break-words">{m.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
