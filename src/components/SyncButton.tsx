import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function SyncButton({ onSuccess }: { onSuccess: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await apiFetch<{ status: string; error?: string; total?: number }>('/api/withings/sync', { method: 'POST' });
      if (result.status === 'error') {
        setSyncError(result.error ?? 'Sync failed');
        setTimeout(() => setSyncError(null), 6000);
      } else {
        onSuccess();
      }
    } catch {
      setSyncError('Sync failed — check Withings connection');
      setTimeout(() => setSyncError(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        onClick={handleSync}
        disabled={syncing}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'transparent',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-pill)',
          padding: '4px 10px',
          color: syncing ? 'var(--text-muted)' : 'var(--text-secondary)',
          font: '600 11px/1 Inter, sans-serif',
          cursor: syncing ? 'default' : 'pointer',
          opacity: syncing ? 0.5 : 1,
        }}
      >
        <RefreshCw
          size={11}
          style={syncing ? { animation: 'spin 1s linear infinite' } : undefined}
        />
        Sync
      </button>
      {syncError && (
        <span style={{
          font: '400 10px/1.3 Inter, sans-serif',
          color: 'var(--ember)',
          textAlign: 'right',
          maxWidth: 180,
        }}>
          {syncError}
        </span>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
