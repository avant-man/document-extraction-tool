import type { GeographicArea } from '../../types/extraction';

interface Props {
  areas: GeographicArea[];
}

export function GeographicTab({ areas }: Props) {
  if (areas.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">No geographic areas were extracted from this document.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="pb-2 pr-4 min-w-0 max-w-[28%] break-words">Name</th>
            <th className="pb-2 pr-4 min-w-0 max-w-[22%] break-words">County</th>
            <th className="pb-2 pr-4 min-w-0 max-w-[28%] break-words">Watershed</th>
            <th className="pb-2 pr-4 whitespace-nowrap">Acres</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((a, i) => (
            <tr key={`${a.name}-${i}`} className="border-b border-gray-100 align-top">
              <td className="py-2 pr-4 min-w-0 break-words">{a.name}</td>
              <td className="py-2 pr-4 min-w-0 break-words">{a.county}</td>
              <td className="py-2 pr-4 min-w-0 break-words">{a.watershed}</td>
              <td className="py-2 pr-4">
                {a.acres != null ? a.acres.toLocaleString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
