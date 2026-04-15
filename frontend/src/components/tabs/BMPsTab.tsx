import { useState } from 'react';
import type { BMP } from '../../types/extraction';

function bmpStatusPill(status: string) {
  const classes =
    status === 'completed'
      ? 'bg-green-100 text-green-700'
      : status === 'in_progress'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-xs rounded px-2 py-0.5 ${classes}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

interface Props {
  bmps: BMP[];
}

export function BMPsTab({ bmps }: Props) {
  const [sortKey, setSortKey] = useState<'targetAcres' | 'achievedAcres' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(key: 'targetAcres' | 'achievedAcres') {
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
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="pb-2">Name</th>
            <th className="pb-2">Category</th>
            <th
              className="pb-2 cursor-pointer select-none hover:text-blue-600"
              onClick={() => handleSort('targetAcres')}
            >
              Target Acres {sortKey === 'targetAcres' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th
              className="pb-2 cursor-pointer select-none hover:text-blue-600"
              onClick={() => handleSort('achievedAcres')}
            >
              Achieved Acres {sortKey === 'achievedAcres' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((bmp) => (
            <tr key={bmp.id} className="border-b border-gray-100">
              <td className="py-2 pr-4">{bmp.name}</td>
              <td className="py-2 pr-4">{bmp.category}</td>
              <td className="py-2 pr-4">{bmp.targetAcres ?? '—'}</td>
              <td className="py-2 pr-4">
                {bmp.achievedAcres !== undefined &&
                bmp.targetAcres &&
                bmp.targetAcres > 0 ? (
                  <div>
                    <div className="w-full bg-gray-200 rounded h-1.5 mb-1">
                      <div
                        className="bg-blue-500 h-1.5 rounded"
                        style={{
                          width: `${Math.min(
                            100,
                            ((bmp.achievedAcres ?? 0) / bmp.targetAcres) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <span>{bmp.achievedAcres}</span>
                  </div>
                ) : (
                  '—'
                )}
              </td>
              <td className="py-2 pr-4">{bmpStatusPill(bmp.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
