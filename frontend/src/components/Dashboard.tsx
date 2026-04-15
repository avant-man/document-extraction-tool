import { useState } from 'react';
import type { ExtractedReport } from '../types/extraction';
import { SummaryTab } from './tabs/SummaryTab';

const TABS = ['Summary', 'Goals', 'BMPs', 'Implementation', 'Monitoring', 'Outreach', 'Charts'] as const;
type Tab = typeof TABS[number];

interface Props {
  report: ExtractedReport;
}

export function Dashboard({ report }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Summary');

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'Summary' && <SummaryTab report={report} />}
        {activeTab === 'Goals' && null}
        {activeTab === 'BMPs' && null}
        {activeTab === 'Implementation' && null}
        {activeTab === 'Monitoring' && null}
        {activeTab === 'Outreach' && null}
        {activeTab === 'Charts' && (
          <div className="p-8 text-center text-gray-400">Charts coming in Spec 05</div>
        )}
      </div>
    </div>
  );
}
