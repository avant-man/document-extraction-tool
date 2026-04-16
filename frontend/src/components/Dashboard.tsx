import { useState } from 'react';
import type { ExtractedReport } from '../types/extraction';
import { SummaryTab } from './tabs/SummaryTab';
import { GoalsTab } from './tabs/GoalsTab';
import { BMPsTab } from './tabs/BMPsTab';
import { ImplementationTab } from './tabs/ImplementationTab';
import { MonitoringTab } from './tabs/MonitoringTab';
import { OutreachTab } from './tabs/OutreachTab';
import { ChartsTab } from './tabs/ChartsTab';
import { GeographicTab } from './tabs/GeographicTab';
import { ExportPanel } from './ExportPanel';

const TABS = ['Summary', 'Goals', 'BMPs', 'Implementation', 'Monitoring', 'Outreach', 'Geographic', 'Charts'] as const;
type Tab = typeof TABS[number];

interface Props {
  report: ExtractedReport;
  filename: string;
}

export function Dashboard({ report, filename }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Summary');

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div role="tablist" className="flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
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
        {activeTab === 'Goals' && <GoalsTab goals={report.goals} />}
        {activeTab === 'BMPs' && <BMPsTab bmps={report.bmps} />}
        {activeTab === 'Implementation' && <ImplementationTab activities={report.implementation} />}
        {activeTab === 'Monitoring' && <MonitoringTab metrics={report.monitoring} />}
        {activeTab === 'Outreach' && <OutreachTab activities={report.outreach} />}
        {activeTab === 'Geographic' && <GeographicTab areas={report.geographicAreas} />}
        {activeTab === 'Charts' && <ChartsTab report={report} />}
      </div>
      <ExportPanel report={report} filename={filename} />
    </div>
  );
}
