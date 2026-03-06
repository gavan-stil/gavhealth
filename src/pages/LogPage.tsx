import { useState } from 'react';
import LogCards from '@/components/log/LogCards';
import ActivityFeed from '@/components/log/ActivityFeed';

type Tab = 'log' | 'activity';

export default function LogPage() {
  const [activeTab, setActiveTab] = useState<Tab>('log');

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: 'var(--radius-pill) var(--radius-pill) 0 0',
    background: activeTab === tab ? 'var(--bg-elevated)' : 'transparent',
    border: 'none',
    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
    font: '600 13px/1 Inter, sans-serif',
    cursor: 'pointer',
  });

  return (
    <div>
      <div style={{
        display: 'flex', gap: 'var(--space-xs)',
        padding: 'var(--space-md) var(--space-lg) 0',
        borderBottom: '1px solid var(--border-default)',
      }}>
        <button onClick={() => setActiveTab('log')} style={tabStyle('log')}>
          Log
        </button>
        <button onClick={() => setActiveTab('activity')} style={tabStyle('activity')}>
          Activity
        </button>
      </div>

      {activeTab === 'log' && <LogCards />}
      {activeTab === 'activity' && <ActivityFeed />}
    </div>
  );
}
