import { useState } from 'react';
import type { Goal, Benchmark } from '../../types/extraction';

function statusPill(status: Goal['status']) {
  const colorClass =
    status === 'completed'
      ? 'bg-green-100 text-green-700'
      : status === 'in_progress'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-xs rounded px-2 py-0.5 ${colorClass}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function benchmarkStatusPill(status: Benchmark['status']) {
  const colorClass =
    status === 'met'
      ? 'bg-green-100 text-green-700'
      : status === 'not_met'
      ? 'bg-red-100 text-red-700'
      : 'bg-yellow-100 text-yellow-700';
  return (
    <span className={`text-xs rounded px-2 py-0.5 ${colorClass}`}>
      {status.replace('_', ' ')}
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
            className="cursor-pointer hover:bg-gray-50 border-b border-gray-100 p-4 flex items-center gap-3"
            onClick={() => toggle(goal.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(goal.id); } }}
          >
            <span className="font-medium text-gray-800 flex-1">{goal.title}</span>
            <span className="bg-gray-100 text-gray-700 text-xs rounded px-2 py-0.5">
              {goal.category}
            </span>
            {statusPill(goal.status)}
            <span className="text-gray-400">
              {openIds.has(goal.id) ? '▾' : '▸'}
            </span>
          </div>
          {openIds.has(goal.id) && (
            <div className="px-4 pb-4 bg-gray-50">
              <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="pb-1">Description</th>
                    <th className="pb-1">Target</th>
                    <th className="pb-1">Achieved</th>
                    <th className="pb-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {goal.benchmarks.map((b, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1">{b.description}</td>
                      <td className="py-1">{b.target}</td>
                      <td className="py-1">{b.achieved}</td>
                      <td className="py-1">{benchmarkStatusPill(b.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
