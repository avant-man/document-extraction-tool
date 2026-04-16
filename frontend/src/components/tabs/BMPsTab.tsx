import { useState } from 'react';
import type { BMP } from '../../types/extraction';

function priorityPill(priority: BMP['priority']) {
  const classes =
    priority === 'high'
      ? 'bg-red-100 text-red-800'
      : priority === 'medium'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-gray-100 text-gray-700';
  return <span className={`text-xs rounded px-2 py-0.5 ${classes}`}>{priority}</span>;
}

interface Props {
  bmps: BMP[];
}

export function BMPsTab({ bmps }: Props) {
  const [sortKey, setSortKey] = useState<'targetAcres' | 'implementedAcres' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(key: 'targetAcres' | 'implementedAcres') {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = [...bmps].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey] ?? -1;
    const bv = b[sortKey] ?? -1;
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[40rem]">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="pb-2 pr-3 min-w-0 max-w-[28%] break-words">Name</th>
            <th className="pb-2 pr-3 min-w-0 break-words">Category</th>
            <th
              className="pb-2 cursor-pointer select-none hover:text-blue-600"
              onClick={() => handleSort('targetAcres')}
            >
              Target Acres {sortKey === 'targetAcres' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th
              className="pb-2 cursor-pointer select-none hover:text-blue-600"
              onClick={() => handleSort('implementedAcres')}
            >
              Implemented Acres {sortKey === 'implementedAcres' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th className="pb-2">Cost</th>
            <th className="pb-2">Priority</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((bmp) => (
            <tr key={bmp.name} className="border-b border-gray-100 align-top">
              <td className="py-2 pr-3 min-w-0 break-words">{bmp.name}</td>
              <td className="py-2 pr-3 min-w-0 break-words">{bmp.category}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{bmp.targetAcres ?? '—'}</td>
              <td className="py-2 pr-3 min-w-0">
                {bmp.implementedAcres !== null &&
                bmp.targetAcres !== null &&
                bmp.targetAcres > 0 ? (
                  <div>
                    <div className="w-full bg-gray-200 rounded h-1.5 mb-1">
                      <div
                        className="bg-blue-500 h-1.5 rounded"
                        style={{
                          width: `${Math.min(
                            100,
                            ((bmp.implementedAcres ?? 0) / bmp.targetAcres) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <span>{bmp.implementedAcres}</span>
                  </div>
                ) : (
                  bmp.implementedAcres ?? '—'
                )}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                {bmp.cost != null ? `$${bmp.cost.toLocaleString()}` : '—'}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">{priorityPill(bmp.priority)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
