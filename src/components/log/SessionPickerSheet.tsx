import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type LoadType = 'kg' | 'bw' | 'bw+';
type WorkoutSet = { load_type: LoadType; kg: number; reps: number; completed?: boolean };
type WorkoutExercise = { name: string; superset: boolean; sets: WorkoutSet[] };

interface RecentSessionExercise {
  name: string;
  sets: number;
  avg_reps: number;
  top_weight_kg: number | null;
  is_pb: boolean;
}

interface RecentSession {
  id: number;
  date: string;
  start_time: string | null;
  exercise_count: number;
  total_sets: number;
  avg_reps_per_set: number;
  total_volume_kg: number;
  is_pb: boolean;
  most_loaded: boolean;
  exercises: RecentSessionExercise[];
  raw_exercises: WorkoutExercise[];
}

interface SessionPickerSheetProps {
  split: string;
  open: boolean;
  onClose: () => void;
  onLoad: (exercises: WorkoutExercise[]) => void;
}

const SPLIT_AREAS: Record<string, string[]> = {
  push: ['Chest', 'Shoulders', 'Triceps'],
  pull: ['Back', 'Biceps'],
  legs: ['Quads', 'Hamstrings', 'Glutes'],
  abs:  ['Core'],
};

function formatDate(dateStr: string, startTime: string | null): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.toLocaleDateString('en-AU', { weekday: 'short' });
  const date = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  if (startTime) return `${day} ${date}, ${startTime}`;
  return `${day} ${date}`;
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 10, height: 10 }}>
      <path d="M 12 2 C 12 2 6 10 6 14.5 A 6 6 0 0 0 18 14.5 C 18 10 12 2 12 2 Z"
        fill="none" stroke="#e8c47a" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 12 22 C 12 22 9 17 9 15 A 3 3 0 0 1 15 15 C 15 17 12 22 12 22"
        fill="none" stroke="#e8c47a" strokeWidth="1.2"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" style={{
      width: 14, height: 14, flexShrink: 0,
      transition: 'transform 0.2s',
      transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
      color: 'var(--text-muted)',
    }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SessionCard({
  session,
  expanded,
  onToggle,
  onLoad,
  split,
}: {
  session: RecentSession;
  expanded: boolean;
  onToggle: () => void;
  onLoad: () => void;
  split: string;
}) {
  const areas = SPLIT_AREAS[split] ?? [];
  const borderColor = session.is_pb
    ? 'rgba(232,196,122,0.30)'
    : session.most_loaded
    ? 'rgba(143,168,200,0.22)'
    : 'var(--border-default)';

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: `1px solid ${borderColor}`,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      {/* Collapsed header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 14px 10px',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Date row + badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ font: '500 13px/1.2 Inter, sans-serif', color: 'var(--text-primary)' }}>
              {formatDate(session.date, session.start_time)}
            </span>
            {session.is_pb && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                font: '600 10px/1 Inter, sans-serif',
                padding: '2px 7px',
                borderRadius: 100,
                color: 'var(--ochre-light)',
                background: 'rgba(212,160,74,0.12)',
                border: '1px solid rgba(232,196,122,0.25)',
              }}>
                <FlameIcon /> PB
              </span>
            )}
            {session.most_loaded && !session.is_pb && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                font: '600 10px/1 Inter, sans-serif',
                padding: '2px 7px',
                borderRadius: 100,
                color: '#8fa8c8',
                background: 'rgba(143,168,200,0.10)',
                border: '1px solid rgba(143,168,200,0.20)',
              }}>
                ↺ Most loaded
              </span>
            )}
          </div>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ font: '400 11px/1.3 Inter, sans-serif', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {session.exercise_count} <em style={{ fontStyle: 'normal', color: 'var(--text-muted)', fontSize: 10 }}>exercises</em>
            </span>
            <span style={{ font: '400 11px/1.3 Inter, sans-serif', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {session.total_sets} <em style={{ fontStyle: 'normal', color: 'var(--text-muted)', fontSize: 10 }}>sets</em>
            </span>
            <span style={{ font: '400 11px/1.3 Inter, sans-serif', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {session.total_volume_kg.toLocaleString()} <em style={{ fontStyle: 'normal', color: 'var(--text-muted)', fontSize: 10 }}>kg volume</em>
            </span>
          </div>
        </div>
        <ChevronIcon open={expanded} />
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border-default)',
          padding: '10px 14px 12px',
        }}>
          {/* Area chips */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {areas.map(a => (
              <span key={a} style={{
                font: '500 9px/1 Inter, sans-serif',
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: 100,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--text-secondary)',
              }}>{a}</span>
            ))}
          </div>

          {/* Totals row */}
          <div style={{
            display: 'flex',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 12,
          }}>
            {[
              { val: session.total_sets, lbl: 'Sets' },
              { val: Math.round(session.avg_reps_per_set * session.total_sets), lbl: 'Reps' },
              { val: session.total_volume_kg.toLocaleString(), lbl: 'Volume' },
            ].map((cell, i) => (
              <div key={i} style={{
                flex: 1, padding: '9px 10px',
                display: 'flex', flexDirection: 'column', gap: 3,
                borderLeft: i > 0 ? '1px solid var(--border-default)' : undefined,
              }}>
                <span style={{ font: "700 15px/1 'JetBrains Mono', monospace", letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
                  {cell.val}
                </span>
                <span style={{ font: '500 9px/1 Inter, sans-serif', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {cell.lbl}
                </span>
              </div>
            ))}
          </div>

          {/* Exercise table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ font: '600 9px/1 Inter, sans-serif', letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 0 6px', textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>Exercise</th>
                <th style={{ font: '600 9px/1 Inter, sans-serif', letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 0 6px', textAlign: 'right', width: 28, borderBottom: '1px solid var(--border-default)' }}>Sets</th>
                <th style={{ font: '600 9px/1 Inter, sans-serif', letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 0 6px', textAlign: 'right', width: 32, borderBottom: '1px solid var(--border-default)' }}>Reps</th>
                <th style={{ font: '600 9px/1 Inter, sans-serif', letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 0 6px', textAlign: 'right', width: 52, borderBottom: '1px solid var(--border-default)' }}>Top</th>
              </tr>
            </thead>
            <tbody>
              {session.exercises.map((ex, i) => (
                <tr key={i}>
                  <td style={{ padding: '7px 0', borderBottom: i < session.exercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined, verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                        background: ex.is_pb ? 'var(--ochre)' : 'transparent',
                      }} />
                      <span style={{
                        font: '400 12px/1.3 Inter, sans-serif',
                        color: ex.is_pb ? 'var(--ochre)' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        maxWidth: 155,
                      }}>
                        {ex.name}
                      </span>
                    </div>
                  </td>
                  <td style={{ font: "500 11px/1 'JetBrains Mono', monospace", color: 'var(--text-muted)', textAlign: 'right', padding: '7px 0 7px 4px', width: 28, borderBottom: i < session.exercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                    {ex.sets}×
                  </td>
                  <td style={{ font: "500 11px/1 'JetBrains Mono', monospace", color: 'var(--text-secondary)', textAlign: 'right', width: 32, padding: '7px 0', borderBottom: i < session.exercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                    {Math.round(ex.avg_reps * ex.sets)}
                  </td>
                  <td style={{ font: "500 11px/1 'JetBrains Mono', monospace", color: 'var(--text-secondary)', textAlign: 'right', width: 52, padding: '7px 0', borderBottom: i < session.exercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                    {ex.top_weight_kg != null ? `${ex.top_weight_kg}kg` : 'BW'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Load button */}
          <button
            onClick={onLoad}
            style={{
              display: 'block', width: '100%', marginTop: 10,
              padding: '9px 0',
              borderRadius: 8,
              font: '600 12px/1 Inter, sans-serif',
              cursor: 'pointer',
              background: 'var(--ochre-dim)',
              border: '1px solid rgba(200,155,74,0.25)',
              color: 'var(--ochre)',
              textAlign: 'center',
            }}
          >
            Load this session
          </button>
        </div>
      )}
    </div>
  );
}

export default function SessionPickerSheet({ split, open, onClose, onLoad }: SessionPickerSheetProps) {
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSessions([]);
    setExpandedId(null);

    apiFetch<RecentSession[]>(`/api/log/strength/recent/${split}?limit=5`)
      .then(data => { if (!cancelled) setSessions(data); })
      .catch(e => { if (!cancelled) setError(e?.message ?? 'Failed to load sessions'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, split]);

  if (!open) return null;

  const capitalSplit = split.charAt(0).toUpperCase() + split.slice(1);

  // Sessions where both PB and most_loaded: treat as PB for divider logic
  const pbOrMl = sessions.filter(s => s.is_pb || s.most_loaded);
  const older  = sessions.filter(s => !s.is_pb && !s.most_loaded);
  const showDivider = pbOrMl.length > 0 && older.length > 0;

  const handleToggle = (id: number) => setExpandedId(prev => prev === id ? null : id);

  const handleLoad = (session: RecentSession) => {
    onLoad(session.raw_exercises);
    onClose();
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 210 }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 211,
        background: 'var(--bg-elevated)',
        borderRadius: '20px 20px 0 0',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        maxHeight: '85vh', overflowY: 'auto',
        padding: '0 14px 32px',
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.15)',
          margin: '12px auto 0',
        }} />

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 14, paddingBottom: 2 }}>
          <div style={{ flex: 1 }}>
            <div style={{ font: '600 15px/1.2 Inter, sans-serif', color: 'var(--text-primary)' }}>
              Recent {capitalSplit} sessions
            </div>
            <div style={{ font: '400 12px/1.3 Inter, sans-serif', color: 'var(--text-muted)', marginTop: 2, marginBottom: 12 }}>
              Tap to preview · select to load as template
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', marginTop: 2 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {loading && (
          <div style={{
            height: 64, borderRadius: 12, marginBottom: 8,
            background: 'var(--bg-card)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        )}

        {error && (
          <div style={{
            padding: '12px 14px', background: 'var(--bg-card)',
            border: '1px solid var(--border-default)', borderRadius: 12,
            color: 'var(--text-secondary)', font: '14px/1.4 Inter, sans-serif',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <span>{error}</span>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                apiFetch<RecentSession[]>(`/api/log/strength/recent/${split}?limit=5`)
                  .then(setSessions)
                  .catch(e => setError(e?.message ?? 'Failed to load sessions'))
                  .finally(() => setLoading(false));
              }}
              style={{
                alignSelf: 'flex-start', background: 'none',
                border: '1px solid var(--border-default)', borderRadius: 8,
                color: 'var(--text-secondary)', font: '12px/1 Inter, sans-serif',
                padding: '6px 12px', cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', font: '13px/1.4 Inter, sans-serif' }}>
            No {split} sessions found
          </div>
        )}

        {!loading && !error && (
          <>
            {pbOrMl.map(s => (
              <SessionCard
                key={s.id}
                session={s}
                expanded={expandedId === s.id}
                onToggle={() => handleToggle(s.id)}
                onLoad={() => handleLoad(s)}
                split={split}
              />
            ))}

            {showDivider && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 8px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
                <span style={{ font: '400 10px/1 Inter, sans-serif', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                  Older sessions
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
              </div>
            )}

            {older.map(s => (
              <SessionCard
                key={s.id}
                session={s}
                expanded={expandedId === s.id}
                onToggle={() => handleToggle(s.id)}
                onLoad={() => handleLoad(s)}
                split={split}
              />
            ))}
          </>
        )}
      </div>
    </>,
    document.body,
  );
}
