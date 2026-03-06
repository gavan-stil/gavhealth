import { useState, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import StrengthCard from './StrengthCard';

type EffortLevel = 'basic' | 'mid' | 'lets_go';

interface FeedItem {
  id: number;
  type: string;
  date: string;
  start_time: string | null;
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

function formatTime(isoStr: string) {
  const d = new Date(isoStr);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')}${ampm}`;
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
  const [strengthSheetActivityId, setStrengthSheetActivityId] = useState<number | null>(null);

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
    setItems(curr => curr.map(i =>
      i.id === id ? { ...i, effort, effort_manually_set: true } : i
    ));
    try {
      await apiFetch(`/api/activities/${id}/effort`, {
        method: 'PATCH',
        body: JSON.stringify({ effort }),
      });
    } catch {
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

  const isWorkout = (type: string) => type === 'workout' || type === 'strength';

  return (
    <>
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

              {/* Row 2: date + time + duration + bpm */}
              <div style={{
                font: '600 13px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px',
                color: 'var(--text-secondary)', paddingLeft: 'calc(10px + var(--space-sm))',
              }}>
                {formatDate(item.date)}
                {item.start_time ? ` · ${formatTime(item.start_time)}` : ''}
                {' · '}{formatDuration(item.duration_minutes)}
                {item.avg_bpm ? ` · ${item.avg_bpm}bpm` : ''}
              </div>
            </div>

            {/* Expanded panel: effort buttons + log strength session for workouts */}
            {expandedId === item.id && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)',
                padding: 'var(--space-sm) var(--space-lg) var(--space-md)',
                borderTop: '1px solid var(--border-default)',
              }}>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
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
                {isWorkout(item.type) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setStrengthSheetActivityId(item.id); }}
                    style={{
                      width: '100%', padding: '8px',
                      background: 'transparent',
                      border: '1px solid var(--rust)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--rust)',
                      font: '600 12px/1 Inter, sans-serif',
                      cursor: 'pointer',
                    }}
                  >
                    Log strength session
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Strength sheet overlay */}
      {strengthSheetActivityId !== null && (
        <>
          <div
            onClick={() => setStrengthSheetActivityId(null)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 90,
            }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            zIndex: 91,
            background: 'var(--bg-base)',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            maxHeight: '88vh', overflowY: 'auto',
            padding: 'var(--space-lg)',
          }}>
            <div style={{
              width: 40, height: 4, borderRadius: 2,
              background: 'var(--border-default)',
              margin: '0 auto var(--space-md)',
            }} />
            <StrengthCard
              open={true}
              onToggle={() => setStrengthSheetActivityId(null)}
              activityId={strengthSheetActivityId}
              onConfirmed={() => setStrengthSheetActivityId(null)}
            />
          </div>
        </>
      )}
    </>
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
