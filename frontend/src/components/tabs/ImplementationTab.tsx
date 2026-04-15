import { useState } from 'react';
import type { ImplementationActivity } from '../../types/extraction';

interface Props {
  activities: ImplementationActivity[];
}

export function ImplementationTab({ activities }: Props) {
  const [filter, setFilter] = useState('');

  const filtered = activities.filter(a =>
    [a.description, a.bmpType, a.location ?? '']
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
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="pb-2">Description</th>
              <th className="pb-2">BMP Type</th>
              <th className="pb-2">Location</th>
              <th className="pb-2">Target</th>
              <th className="pb-2">Achieved</th>
              <th className="pb-2">Unit</th>
              <th className="pb-2">Year</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} className="border-b border-gray-100">
                <td className="py-2 pr-4">{a.description}</td>
                <td className="py-2 pr-4">{a.bmpType}</td>
                <td className="py-2 pr-4">{a.location ?? '—'}</td>
                <td className="py-2 pr-4">{a.targetQuantity}</td>
                <td className="py-2 pr-4">{a.achievedQuantity}</td>
                <td className="py-2 pr-4">{a.unit}</td>
                <td className="py-2 pr-4">{a.year ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
