import { useState } from 'react';
import type { Goal, Benchmark } from '../../types/extraction';

function benchmarkStatusPill(status: Benchmark['status']) {
  const colorClass =
    status === 'met'
      ? 'bg-green-100 text-green-700'
      : status === 'not-started'
      ? 'bg-gray-100 text-gray-600'
      : 'bg-yellow-100 text-yellow-700';
  const label = status === 'in-progress' ? 'in progress' : status.replace('-', ' ');
  return (
    <span className={`text-xs rounded px-2 py-0.5 whitespace-nowrap ${colorClass}`}>
      {label}
    </span>
  );
}

interface Props {
  goals: Goal[];
}

export function GoalsTab({ goals }: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    const next = new Set(openIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpenIds(next);
  }

  return (
    <div className="divide-y divide-gray-100">
      {goals.map((goal) => (
        <div key={goal.id}>
          <div
            role="button"
            tabIndex={0}
            aria-expanded={openIds.has(goal.id)}
            className="cursor-pointer hover:bg-gray-50 border-b border-gray-100 p-4 flex items-start sm:items-center gap-3 flex-wrap"
            onClick={() => toggle(goal.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(goal.id); } }}
          >
            <span className="font-medium text-gray-800 flex-1 min-w-0 break-words">{goal.title}</span>
            {goal.pollutants?.length ? (
              <span className="bg-gray-100 text-gray-700 text-xs rounded px-2 py-0.5 max-w-full sm:max-w-md break-words">
                {goal.pollutants.join(', ')}
              </span>
            ) : null}
            {goal.targetReduction != null ? (
              <span className="text-xs text-gray-500">Target Δ {goal.targetReduction}%</span>
            ) : null}
            <span className="text-gray-400">
              {openIds.has(goal.id) ? '▾' : '▸'}
            </span>
          </div>
          {openIds.has(goal.id) && (
            <div className="px-4 pb-4 bg-gray-50">
              <p className="text-sm text-gray-600 mb-3 break-words">{goal.description}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[32rem]">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="pb-1 pr-2 min-w-0 max-w-[40%] break-words">Description</th>
                      <th className="pb-1 pr-2 whitespace-nowrap">Target</th>
                      <th className="pb-1 pr-2 whitespace-nowrap">Current</th>
                      <th className="pb-1 pr-2 min-w-0 break-words">Unit</th>
                      <th className="pb-1 whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goal.benchmarks.map((b, i) => (
                      <tr key={i} className="border-b border-gray-100 align-top">
                        <td className="py-1 pr-2 min-w-0 break-words">{b.description}</td>
                        <td className="py-1 pr-2">{b.target}</td>
                        <td className="py-1 pr-2">{b.current}</td>
                        <td className="py-1 pr-2 min-w-0 break-words">{b.unit}</td>
                        <td className="py-1">{benchmarkStatusPill(b.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
