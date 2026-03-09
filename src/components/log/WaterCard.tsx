import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface WaterEntry {
  id: number;
  logged_at: string;
  ml: number;
}

const QUICK_ADD = [250, 500, 750, 1000];
const DAILY_TARGET = 3000;

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
};

interface Props {
  open: boolean;
  onToggle: () => void;
  date: string; // YYYY-MM-DD local date
}

export default function WaterCard({ open, onToggle, date }: Props) {
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [customMl, setCustomMl] = useState('');

  const todayLocal = new Date().toLocaleDateString('en-CA');
  const isToday = date === todayLocal;

  const totalMl = entries.reduce((sum, e) => sum + e.ml, 0);
  const fillPct = Math.min(100, Math.round((totalMl / DAILY_TARGET) * 100));

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<WaterEntry[]>(`/api/water?date=${date}`);
      setEntries(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleAdd = async (ml: number) => {
    setAdding(ml);
    try {
      // For past dates, log at noon of that day (Brisbane UTC+10 = 02:00 UTC)
      const body: { ml: number; logged_at?: string } = { ml };
      if (!isToday) {
        body.logged_at = `${date}T02:00:00+00:00`;
      }
      const entry = await apiFetch<WaterEntry>('/api/log/water', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setEntries(prev => [entry, ...prev]);
    } catch {
      // no-op, silent
    } finally {
      setAdding(null);
    }
  };

  const handleCustomAdd = async () => {
    const ml = parseInt(customMl, 10);
    if (!ml || ml <= 0 || ml > 5000) return;
    setAdding(-1);
    try {
      const body: { ml: number; logged_at?: string } = { ml };
      if (!isToday) {
        body.logged_at = `${date}T02:00:00+00:00`;
      }
      const entry = await apiFetch<WaterEntry>('/api/log/water', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setEntries(prev => [entry, ...prev]);
      setCustomMl('');
    } catch {
      // no-op
    } finally {
      setAdding(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await apiFetch(`/api/water/${id}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {
      // no-op
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-md) var(--space-lg)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2C8 2 3 7.5 3 10.5C3 13.0 5.24 15 8 15C10.76 15 13 13.0 13 10.5C13 7.5 8 2 8 2Z"
              fill="var(--dawn)" opacity="0.8" />
          </svg>
          <span className="section-head" style={{ color: 'var(--text-primary)' }}>Water Intake</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span className="small-number" style={{ color: 'var(--dawn)' }}>
            {loading ? '…' : `${totalMl} ml`}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div style={{ padding: 'var(--space-md) var(--space-lg) var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

          {/* Quick-add pills */}
          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            {QUICK_ADD.map(ml => (
              <button
                key={ml}
                onClick={() => handleAdd(ml)}
                disabled={adding !== null}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border-default)',
                  background: adding === ml ? 'rgba(127,170,188,0.15)' : 'transparent',
                  color: 'var(--dawn)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  cursor: adding !== null ? 'not-allowed' : 'pointer',
                  opacity: adding !== null && adding !== ml ? 0.5 : 1,
                }}
              >
                {ml}ml
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            <input
              type="number"
              placeholder="Custom ml"
              value={customMl}
              onChange={e => setCustomMl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustomAdd()}
              style={{
                flex: 1,
                padding: '6px var(--space-sm)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleCustomAdd}
              disabled={adding !== null || !customMl}
              style={{
                padding: '6px var(--space-md)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                background: 'transparent',
                color: 'var(--dawn)',
                fontSize: 13,
                fontFamily: 'inherit',
                fontWeight: 600,
                cursor: adding !== null || !customMl ? 'not-allowed' : 'pointer',
                opacity: adding !== null || !customMl ? 0.5 : 1,
              }}
            >
              + Add
            </button>
          </div>

          {/* Vessel + total */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
            <div style={{ position: 'relative', width: 52, height: 88, flexShrink: 0 }}>
              <div style={{
                position: 'absolute', inset: 0,
                border: '2px solid var(--dawn)',
                borderRadius: 6,
                background: 'var(--bg-base)',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${fillPct}%`,
                  background: 'linear-gradient(180deg, rgba(127,170,188,0.5) 0%, rgba(127,170,188,0.8) 100%)',
                  transition: 'height 0.5s ease',
                }} />
              </div>
            </div>

            <div>
              <span className="stat-number" style={{ color: 'var(--ochre)', display: 'block' }}>
                {loading ? '…' : totalMl.toLocaleString()}
              </span>
              <span className="label-text" style={{ color: 'var(--text-muted)' }}>
                ml of {DAILY_TARGET.toLocaleString()} target
              </span>
              {error && (
                <span
                  className="label-text"
                  style={{ color: 'var(--ochre)', cursor: 'pointer', display: 'block', marginTop: 4 }}
                  onClick={fetchEntries}
                >
                  Retry
                </span>
              )}
            </div>
          </div>

          {/* Log list */}
          {entries.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {entries.map(e => (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <span className="small-number" style={{ color: 'var(--text-muted)' }}>
                    {formatTime(e.logged_at)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span className="small-number" style={{ color: 'var(--dawn)' }}>
                      {e.ml} ml
                    </span>
                    <button
                      onClick={() => handleDelete(e.id)}
                      disabled={deletingId === e.id}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: deletingId === e.id ? 'not-allowed' : 'pointer',
                        padding: '2px 4px',
                        fontSize: 14,
                        lineHeight: 1,
                        opacity: deletingId === e.id ? 0.4 : 0.6,
                      }}
                      aria-label="Delete entry"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && entries.length === 0 && (
            <span className="label-text" style={{ color: 'var(--text-muted)' }}>
              No water logged {isToday ? 'today' : 'on this day'} — tap a quick-add above
            </span>
          )}
        </div>
      )}
    </div>
  );
}
