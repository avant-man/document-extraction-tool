import type { OutreachActivity } from '../../types/extraction';

function outreachStatusPill(status: string) {
  const classes = status === 'completed'
    ? 'bg-green-100 text-green-700'
    : 'bg-gray-100 text-gray-600';
  return <span className={`text-xs rounded px-2 py-0.5 ${classes}`}>{status.replace('_', ' ')}</span>;
}

interface Props {
  activities: OutreachActivity[];
}

export function OutreachTab({ activities }: Props) {
  return (
    <div>
      {activities.map(a => (
        <div key={a.id} className="bg-white rounded-xl shadow-sm p-4 mb-3 border border-gray-100">
          <p className="line-clamp-2 font-medium text-gray-800">{a.description}</p>
          <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-x-3 items-center">
            <span>{a.targetAudience}</span>
            <span>{a.participationCount} participants</span>
            <span>{a.completionDate}</span>
            {outreachStatusPill(a.status)}
          </div>
        </div>
      ))}
    </div>
  );
}
