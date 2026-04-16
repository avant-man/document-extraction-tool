import type { OutreachActivity } from '../../types/extraction';

interface Props {
  activities: OutreachActivity[];
}

export function OutreachTab({ activities }: Props) {
  return (
    <div>
      {activities.map((a, i) => (
        <div key={`${a.activity}-${i}`} className="bg-white rounded-xl shadow-sm p-4 mb-3 border border-gray-100">
          <p className="font-medium text-gray-800 break-words">{a.activity}</p>
          <div className="text-sm text-gray-600 mt-2 space-y-1">
            <p className="break-words"><span className="text-gray-500">Audience:</span> {a.targetAudience}</p>
            <p className="break-words"><span className="text-gray-500">Timeline:</span> {a.timeline}</p>
            <p className="break-words"><span className="text-gray-500">Responsible:</span> {a.responsible}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
