import { useState, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type EffortLevel = 'basic' | 'mid' | 'lets_go';

interface FeedItem {
  id: number;
  type: string;
  date: string;
  duration_minutes: number;
  avg_bpm: number | null;
  effort: EffortLevel;
  effort_manually_set: boolean;
}

const TYPE_COLOURS: Record<string, string> = {
  run: '#b8a878',
  workout: '#b47050',
  strength: '#b47050',
  ride: '#c4789a',
  sauna: '#c45a4a',
  daily_summary: '#9a9080',
};

const TYPE_LABELS: Record<string, string> = {
  run: 'Run',
  workout: 'Workout',
  strength: 'Strength',
  ride: 'Ride',
  sauna: 'Sauna',
  daily_summary: 'Day Summary',
};

const EFFORT_LABEL: Record<EffortLevel, string> = {
  basic: 'Basic',
  mid: 'Mid',
  lets_go: "Let's Go",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function formatDuration(mins: number) {
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function ActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<FeedItem[]>('/api/activities/feed?days=14');
      setItems(data);
    } catch {
      setError('Could not load activity feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const updateEffort = async (id: number, effort: EffortLevel) => {
    const prev = items.find(i => i.id === id)?.effort;
    // optimistic update
    setItems(curr => curr.map(i =>
      i.id === id ? { ...i, effort, effort_manually_set: true } : i
    ));
    try {
      await apiFetch(`/api/activities/${id}/effort`, {
        method: 'PATCH',
        body: JSON.stringify({ effort }),
      });
    } catch {
      // revert on failure
      setItems(curr => curr.map(i =>
        i.id === id ? { ...i, effort: prev!, effort_manually_set: false } : i
      ));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: 72,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        margin: 'var(--space-lg)',
        padding: 'var(--space-md)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--text-muted)' }}>
          <AlertCircle size={14} />
          <span style={{ font: '400 14px/1.5 Inter, sans-serif' }}>{error}</span>
        </div>
        <button
          onClick={fetchFeed}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            font: '600 10px/1 Inter, sans-serif', letterSpacing: '1.2px',
            textTransform: 'uppercase', color: 'var(--ochre)',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)',
      padding: 'var(--space-lg)',
    }}>
      {items.map(item => (
        <div
          key={item.id}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <div
            onClick={() => setExpandedId(prev => prev === item.id ? null : item.id)}
            style={{
              padding: 'var(--space-md) var(--space-lg)',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: '6px',
            }}
          >
            {/* Row 1: type dot + label + effort badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: TYPE_COLOURS[item.type] || 'var(--text-muted)',
              }} />
              <span style={{
                font: '700 16px/1.2 Inter, sans-serif', letterSpacing: '-0.5px',
                color: 'var(--text-primary)', flex: 1,
              }}>
                {TYPE_LABELS[item.type] || item.type}
              </span>
              <EffortBadge effort={item.effort} isUnreviewed={!item.effort_manually_set} />
            </div>

            {/* Row 2: date + duration + bpm */}
            <div style={{
              font: '600 13px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px',
              color: 'var(--text-secondary)', paddingLeft: 'calc(10px + var(--space-sm))',
            }}>
              {formatDate(item.date)} · {formatDuration(item.duration_minutes)}
              {item.avg_bpm ? ` · ${item.avg_bpm}bpm` : ''}
            </div>
          </div>

          {/* Effort editor */}
          {expandedId === item.id && (
            <div style={{
              display: 'flex', gap: 'var(--space-sm)',
              padding: 'var(--space-sm) var(--space-lg) var(--space-md)',
              borderTop: '1px solid var(--border-default)',
            }}>
              {(['basic', 'mid', 'lets_go'] as const).map(level => (
                <button
                  key={level}
                  onClick={(e) => { e.stopPropagation(); updateEffort(item.id, level); }}
                  style={{
                    flex: 1, padding: '6px 0',
                    borderRadius: 'var(--radius-pill)',
                    border: `1px solid ${item.effort === level ? 'var(--ochre)' : 'var(--border-default)'}`,
                    background: item.effort === level ? 'var(--ochre)' : 'transparent',
                    color: item.effort === level ? 'var(--bg-base)' : 'var(--text-muted)',
                    font: '600 11px/1 Inter, sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  {EFFORT_LABEL[level]}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EffortBadge({ effort, isUnreviewed }: { effort: EffortLevel; isUnreviewed: boolean }) {
  const isLetsGo = effort === 'lets_go';
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span style={{
        padding: '3px 10px',
        borderRadius: 'var(--radius-pill)',
        background: isLetsGo ? 'var(--ochre)' : 'transparent',
        border: isLetsGo ? 'none' : '1px solid var(--border-default)',
        color: isLetsGo ? 'var(--bg-base)' : 'var(--text-muted)',
        font: '600 11px/1 Inter, sans-serif',
        whiteSpace: 'nowrap' as const,
      }}>
        {EFFORT_LABEL[effort]}
      </span>
      {isUnreviewed && (
        <span style={{
          position: 'absolute', top: -2, right: -2,
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--ochre)',
        }} />
      )}
    </span>
  );
}
