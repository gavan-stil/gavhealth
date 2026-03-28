import { useState } from 'react';
import LogCards from '@/components/log/LogCards';
import ActivityFeed from '@/components/log/ActivityFeed';

type Tab = 'log' | 'activity';

export default function LogPage() {
  const [activeTab, setActiveTab] = useState<Tab>('log');

  return (
    <div>
      <div className="goe-tab-bar">
        <button
          className={`goe-tab-btn${activeTab === 'log' ? ' active' : ''}`}
          onClick={() => setActiveTab('log')}
        >
          Log
        </button>
        <button
          className={`goe-tab-btn${activeTab === 'activity' ? ' active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Activity
        </button>
      </div>

      {activeTab === 'log' && (
        <div key="log" className="goe-tab-content">
          <LogCards />
        </div>
      )}
      {activeTab === 'activity' && (
        <div key="activity" className="goe-tab-content">
          <ActivityFeed />
        </div>
      )}
    </div>
  );
}
