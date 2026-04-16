import { useState } from 'react';
import type { ImplementationActivity } from '../../types/extraction';

function statusPill(status: ImplementationActivity['status']) {
  const classes =
    status === 'complete'
      ? 'bg-green-100 text-green-800'
      : status === 'in-progress'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-gray-100 text-gray-700';
  const label = status === 'in-progress' ? 'in progress' : status;
  return <span className={`text-xs rounded px-2 py-0.5 ${classes}`}>{label}</span>;
}

interface Props {
  activities: ImplementationActivity[];
}

export function ImplementationTab({ activities }: Props) {
  const [filter, setFilter] = useState('');

  const filtered = activities.filter(a =>
    [a.activity, a.responsible, String(a.year ?? '')]
      .join(' ')
      .toLowerCase()
      .includes(filter.toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        placeholder="Filter activities..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="mb-4 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-8">No activities match your search</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[44rem]">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="pb-2 pr-3 min-w-0 max-w-[40%] break-words">Activity</th>
                <th className="pb-2 pr-3 whitespace-nowrap">Year</th>
                <th className="pb-2 pr-3 min-w-0 max-w-[28%] break-words">Responsible</th>
                <th className="pb-2 pr-3 whitespace-nowrap">Cost</th>
                <th className="pb-2 pr-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={`${a.activity}-${i}`} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-3 min-w-0 break-words">{a.activity}</td>
                  <td className="py-2 pr-3">{a.year ?? '—'}</td>
                  <td className="py-2 pr-3 min-w-0 break-words">{a.responsible}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {a.cost != null ? `$${a.cost.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-2 pr-3">{statusPill(a.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
