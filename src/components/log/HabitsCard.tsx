import { useState, useEffect } from 'react';
import { CheckSquare, Check, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type HabitsState = 'empty' | 'saving' | 'confirmed' | 'error';

interface HabitsResponse {
  id: number;
  habit_date: string;
  did_breathing: boolean;
  did_devotions: boolean;
  notes: string | null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function HabitsHistory({ refreshTrigger }: { refreshTrigger: number }) {
  const [history, setHistory] = useState<HabitsResponse[] | null>(null);

  useEffect(() => {
    apiFetch<HabitsResponse[]>('/api/habits?days=14')
      .then(data => setHistory(data))
      .catch(() => setHistory(null));
  }, [refreshTrigger]);

  if (!history || history.length === 0) return null;

  return (
    <div style={{
      borderTop: '1px solid var(--border-default)',
      paddingTop: 'var(--space-md)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)',
    }}>
      <span style={{
        font: '600 10px/1 Inter, sans-serif', letterSpacing: '1.2px',
        textTransform: 'uppercase', color: 'var(--text-muted)',
        marginBottom: 'var(--space-xs)',
      }}>
        Recent
      </span>
      {history.map(row => (
        <div key={row.habit_date} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
        }}>
          <span style={{
            font: '600 12px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px',
            color: 'var(--text-secondary)', minWidth: 90,
          }}>
            {formatShortDate(row.habit_date)}
          </span>
          <span style={{
            font: '600 12px/1 Inter, sans-serif',
            color: row.did_devotions ? 'var(--ochre)' : 'var(--border-default)',
          }}>
            {row.did_devotions ? '✓' : '·'} Dev
          </span>
          <span style={{
            font: '600 12px/1 Inter, sans-serif',
            color: row.did_breathing ? 'var(--ochre)' : 'var(--border-default)',
          }}>
            {row.did_breathing ? '✓' : '·'} Breathe
          </span>
        </div>
      ))}
    </div>
  );
}

export default function HabitsCard({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [state, setState] = useState<HabitsState>('empty');
  const [didBreathing, setDidBreathing] = useState(false);
  const [didDevotions, setDidDevotions] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSubmit = async () => {
    setState('saving');
    try {
      await apiFetch<HabitsResponse>('/api/log/habits', {
        method: 'POST',
        body: JSON.stringify({
          habit_date: today(),
          did_breathing: didBreathing,
          did_devotions: didDevotions,
        }),
      });
      setState('confirmed');
      setTimeout(() => {
        setState('empty');
        setDidBreathing(false);
        setDidDevotions(false);
        setRefreshTrigger(n => n + 1);
      }, 2000);
    } catch {
      setState('error');
    }
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
          padding: 'var(--space-md) var(--space-lg)',
          background: 'transparent', border: 'none', cursor: 'pointer',
        }}
      >
        <CheckSquare size={18} color="var(--ochre)" />
        <span style={{ font: '700 16px/1.2 Inter, sans-serif', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
          Habits
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 var(--space-lg) var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {state === 'confirmed' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--signal-good)' }}>
              <Check size={18} />
              <span style={{ font: '600 14px/1 Inter, sans-serif' }}>Logged!</span>
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex', gap: 'var(--space-lg)',
                opacity: state === 'saving' ? 0.5 : 1,
                pointerEvents: state === 'saving' ? 'none' : 'auto',
              }}>
                <div
                  onClick={() => setDidDevotions(!didDevotions)}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer' }}
                >
                  <div style={{
                    width: 24, height: 24, flexShrink: 0,
                    border: `1px solid ${didDevotions ? 'var(--ochre)' : 'var(--border-default)'}`,
                    background: didDevotions ? 'var(--ochre)' : 'transparent',
                    borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {didDevotions && <Check size={16} color="white" />}
                  </div>
                  <span style={{ font: '400 14px/1.5 Inter, sans-serif', color: 'var(--text-secondary)' }}>
                    Devotions
                  </span>
                </div>
                <div
                  onClick={() => setDidBreathing(!didBreathing)}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer' }}
                >
                  <div style={{
                    width: 24, height: 24, flexShrink: 0,
                    border: `1px solid ${didBreathing ? 'var(--ochre)' : 'var(--border-default)'}`,
                    background: didBreathing ? 'var(--ochre)' : 'transparent',
                    borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {didBreathing && <Check size={16} color="white" />}
                  </div>
                  <span style={{ font: '400 14px/1.5 Inter, sans-serif', color: 'var(--text-secondary)' }}>
                    Breathing
                  </span>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={state === 'saving'}
                style={{
                  padding: 'var(--space-sm) var(--space-lg)',
                  background: 'var(--ochre)', color: 'var(--bg-base)',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  font: '600 14px/1 Inter, sans-serif', cursor: 'pointer',
                  opacity: state === 'saving' ? 0.4 : 1,
                  ...(state === 'saving' ? { animation: 'pulse 1.5s infinite' } : {}),
                }}
              >
                {state === 'saving' ? 'Saving…' : 'Log Habits'}
              </button>

              {state === 'error' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--ember)' }}>
                  <AlertCircle size={14} />
                  <span style={{ font: '400 13px/1 Inter, sans-serif' }}>
                    Could not save habits
                  </span>
                </div>
              )}
            </>
          )}

          <HabitsHistory refreshTrigger={refreshTrigger} />
        </div>
      )}
    </div>
  );
}
