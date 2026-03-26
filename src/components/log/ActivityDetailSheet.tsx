import { useState, useEffect, type ReactNode } from 'react';
import { X, Dumbbell, Pencil } from 'lucide-react';
import { EnergyIcon } from './MoodEnergyCard';
import { apiFetch } from '@/lib/api';
import ActivityEditSheet from '@/components/ActivityEditSheet';
import ExerciseEditSheet from '@/components/exercises/ExerciseEditSheet';
import type { Exercise as FullExercise } from '@/types/trends';

type EffortLevel = 'basic' | 'mid' | 'lets_go';

export interface FeedItemForSheet {
  id: number;
  type: string;
  date: string;
  start_time: string | null;
  duration_minutes: number;
  avg_bpm: number | null;
  min_hr: number | null;
  max_hr: number | null;
  distance_km: number | null;
  avg_pace_secs: number | null;
  calories_burned: number | null;
  effort: EffortLevel;
  effort_manually_set: boolean;
}

export interface StrengthSessionForSheet {
  id: number;
  session_date: string;
  category: string;
  session_label?: string | null;
  duration_mins: number | null;
  exercises: string[];
  activity_log_id: number | null;
}

/* ── API shapes ─────────────────────────────────────────────────────────── */
type RawSession = {
  id: number;
  session_date: string;
  exercises: string[];
  total_sets: number;
  total_reps: number;
  total_load_kg: number;
};

type RawExercise = { id: number; name: string; category: string; uses_bodyweight: boolean; muscles?: { muscle_group: string; macro_group: string; is_primary: boolean }[] };

type HistoryEntry = {
  session_date: string;
  sets: number;
  total_reps: number;
  top_weight_kg: number;
};

type ExRow = {
  name: string;
  exerciseId: number;
  sets: number;
  totalReps: number;
  topWeightKg: number;
  usesBodyweight: boolean;
  isPb: boolean;
};

type SessionDetail = {
  split: string;
  bodyAreas: string[];
  totalSets: number;
  totalReps: number;
  totalLoadKg: number;
  rows: ExRow[];
};

/* ── Pure helpers ───────────────────────────────────────────────────────── */
function parseEx(raw: string): { name: string; catStr: string } {
  const idx = raw.lastIndexOf(' - ');
  return idx === -1
    ? { name: raw, catStr: '' }
    : { name: raw.slice(0, idx), catStr: raw.slice(idx + 3) };
}

const PUSH_CATS = new Set(['chest', 'shoulders', 'arms', 'triceps']);
const PULL_CATS = new Set(['back', 'biceps']);
const LEG_CATS = new Set(['legs', 'glutes', 'quads', 'hamstrings', 'calves']);

function deriveSplit(exercises: string[]): string {
  let push = 0, pull = 0, legs = 0;
  exercises.forEach(e => {
    const c = parseEx(e).catStr.toLowerCase();
    if (PUSH_CATS.has(c)) push++;
    else if (PULL_CATS.has(c)) pull++;
    else if (LEG_CATS.has(c)) legs++;
  });
  if (push >= pull && push >= legs && push > 0) return 'Push';
  if (pull > 0 && pull >= legs) return 'Pull';
  if (legs > 0) return 'Legs';
  return 'Session';
}

const AREA_MAP: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  arms: 'Arms', biceps: 'Arms', triceps: 'Arms',
  legs: 'Legs', glutes: 'Legs', quads: 'Legs', hamstrings: 'Legs', calves: 'Legs',
  core: 'Core', abs: 'Core', other: 'Other',
};

function deriveBodyAreas(exercises: string[]): string[] {
  const seen = new Set<string>();
  exercises.forEach(e => {
    const a = AREA_MAP[parseEx(e).catStr.toLowerCase()];
    if (a) seen.add(a);
  });
  return Array.from(seen);
}

function fmtWeight(kg: number, bw: boolean): string {
  if (bw) return kg > 0 ? `BW +${kg}kg` : 'BW';
  return kg > 0 ? `${kg}kg` : '–';
}

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

const EFFORT_LABEL: Record<EffortLevel, string> = {
  basic: 'Basic', mid: 'Mid', lets_go: "Let's Go",
};

const EFFORT_ICON: Record<EffortLevel, ReactNode> = {
  basic: <EnergyIcon value={2} size={14} />,
  mid: <EnergyIcon value={4} size={14} />,
  lets_go: <EnergyIcon value={5} size={14} />,
};

const TYPE_LABELS: Record<string, string> = {
  run: 'Run', workout: 'Workout', strength: 'Strength',
  ride: 'Ride', sauna: 'Sauna', daily_summary: 'Day Summary',
};

const TYPE_COLOURS: Record<string, string> = {
  run: '#b8a878', workout: '#b47050', strength: '#b47050',
  ride: '#c4789a', sauna: '#c45a4a', daily_summary: '#9a9080',
};

/* ── Props ──────────────────────────────────────────────────────────────── */
interface Props {
  item: FeedItemForSheet;
  linkedSession: StrengthSessionForSheet | null;
  unlinkedSessions: StrengthSessionForSheet[];
  onClose: () => void;
  onEffortChange: (id: number, effort: EffortLevel) => void;
  onLink: (sessionId: number, activityId: number) => void;
  onUnlink: (sessionId: number) => void;
  onLogStrength: () => void;
  linkingSessionId: number | null;
  deletingId: number | null;
  onDelete: (sessionId: number) => void;
}

/* ── Component ──────────────────────────────────────────────────────────── */
export default function ActivityDetailSheet({
  item, linkedSession, unlinkedSessions, onClose,
  onEffortChange, onLink, onUnlink, onLogStrength,
  linkingSessionId, deletingId, onDelete,
}: Props) {
  const [localEffort, setLocalEffort] = useState<EffortLevel>(item.effort);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingExercise, setEditingExercise] = useState<FullExercise | null>(null);
  const [exerciseLookup, setExerciseLookup] = useState<Map<number, RawExercise>>(new Map());

  const isWorkout = item.type === 'workout' || item.type === 'strength';
  const typeColor = TYPE_COLOURS[item.type] || 'var(--text-muted)';

  const handleEffort = (level: EffortLevel) => {
    setLocalEffort(level);
    onEffortChange(item.id, level);
  };

  /* Fetch strength session exercises when there's a linked session */
  useEffect(() => {
    if (!isWorkout || !linkedSession) return;
    let cancelled = false;

    (async () => {
      setLoadingDetail(true);
      try {
        // Use item.date (the Withings activity date), not linkedSession.log_date
        // (which may be the date the session was entered, not when the workout happened).
        // Widen to ±1 day to handle any timezone edge cases in the backend date filter.
        const workoutDate = item.date;
        const d = new Date(workoutDate + 'T00:00:00');
        const prev = new Date(d); prev.setDate(d.getDate() - 1);
        const next = new Date(d); next.setDate(d.getDate() + 1);
        const startDate = prev.toLocaleDateString('en-CA');
        const endDate = next.toLocaleDateString('en-CA');

        const [rawSessions, allEx] = await Promise.all([
          apiFetch<RawSession[]>(`/api/strength/sessions?start_date=${startDate}&end_date=${endDate}&limit=20`),
          apiFetch<RawExercise[]>('/api/exercises'),
        ]);
        if (cancelled) return;

        const exMap = new Map<string, RawExercise>();
        const exById = new Map<number, RawExercise>();
        allEx.forEach(e => { exMap.set(e.name.toLowerCase(), e); exById.set(e.id, e); });
        setExerciseLookup(exById);

        const withEx = rawSessions.filter(s => s.exercises.length > 0);
        const raw = withEx.find(s => s.id === linkedSession.id);
        if (!raw) return;

        // Use the session's own date for history matching (not workoutDate or log_date)
        const sessionDate = raw.session_date.slice(0, 10);

        /* Collect exercise IDs for history fetch */
        const ids = new Set<number>();
        raw.exercises.forEach(r => {
          const ex = exMap.get(r.toLowerCase());
          if (ex) ids.add(ex.id);
        });

        const histMap = new Map<number, HistoryEntry[]>();
        await Promise.all(
          Array.from(ids).map(async id => {
            const h = await apiFetch<HistoryEntry[]>(`/api/strength/exercise/${id}/history?days=90`);
            histMap.set(id, h);
          })
        );
        if (cancelled) return;

        const rows: ExRow[] = [];
        raw.exercises.forEach(r => {
          const ex = exMap.get(r.toLowerCase());
          if (!ex) return;
          const { name } = parseEx(r);
          const hist = histMap.get(ex.id) ?? [];
          const entry = hist.find(h => h.session_date.slice(0, 10) === sessionDate);
          if (!entry) return;
          const allTimeMax = hist.reduce((m, h) => Math.max(m, h.top_weight_kg), 0);
          const isPb = !ex.uses_bodyweight && entry.top_weight_kg > 0 && entry.top_weight_kg >= allTimeMax;
          rows.push({
            name,
            exerciseId: ex.id,
            sets: entry.sets,
            totalReps: entry.total_reps,
            topWeightKg: entry.top_weight_kg,
            usesBodyweight: ex.uses_bodyweight,
            isPb,
          });
        });

        if (!cancelled) {
          const rawLabel = linkedSession.session_label;
          const splitDisplay = rawLabel
            ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
            : deriveSplit(raw.exercises);
          setDetail({
            split: splitDisplay,
            bodyAreas: deriveBodyAreas(raw.exercises),
            totalSets: raw.total_sets,
            totalReps: raw.total_reps,
            totalLoadKg: raw.total_load_kg,
            rows,
          });
        }
      } catch (err) {
        console.error('[ActivityDetailSheet] fetch error:', err);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 110,
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 111,
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        maxHeight: '85vh', overflowY: 'auto',
        padding: '12px 16px 80px',
      }}>
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.15)',
          margin: '0 auto 16px',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: typeColor,
          }} />
          <span style={{
            font: '700 18px/1.2 Inter, sans-serif', letterSpacing: '-0.5px',
            color: 'var(--text-primary)', flex: 1,
          }}>
            {TYPE_LABELS[item.type] || item.type}
          </span>
          {/* Edit button — for editable activity types */}
          {(item.type === 'run' || item.type === 'ride' || item.type === 'workout' || item.type === 'strength') && (
            <button
              onClick={() => setShowEdit(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4, display: 'flex',
              }}
              title="Edit details"
            >
              <Pencil size={15} />
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4, display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Date / time / duration row */}
        <div style={{
          display: 'flex', gap: 16, flexWrap: 'wrap',
          marginBottom: 14,
          font: '600 13px/1 JetBrains Mono, monospace',
          letterSpacing: '-0.3px', color: 'var(--text-secondary)',
        }}>
          <span>{formatDate(item.date)}</span>
          {item.start_time && <span>{formatTime(item.start_time)}</span>}
          <span>{formatDuration(item.duration_minutes)}</span>
        </div>

        {/* Distance / pace block — runs and rides only */}
        {(item.type === 'run' || item.type === 'ride') && (item.distance_km || item.avg_pace_secs) && (
          <div style={{
            display: 'flex',
            marginBottom: 20,
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            overflow: 'hidden',
          }}>
            {[
              ...(item.distance_km != null ? [{ val: `${item.distance_km.toFixed(2)}`, lbl: 'km' }] : []),
              ...(item.avg_pace_secs != null ? [{
                val: `${Math.floor(item.avg_pace_secs / 60)}:${String(Math.round(item.avg_pace_secs % 60)).padStart(2, '0')}`,
                lbl: 'min/km',
              }] : []),
            ].map((stat, i) => (
              <div key={stat.lbl} style={{
                flex: 1, padding: '10px 14px',
                borderLeft: i > 0 ? '1px solid var(--border-default)' : 'none',
                display: 'flex', flexDirection: 'column', gap: 3,
              }}>
                <span style={{
                  font: '700 15px/1 JetBrains Mono, monospace',
                  letterSpacing: '-0.5px', color: 'var(--text-primary)',
                }}>{stat.val}</span>
                <span style={{
                  font: '600 9px/1 Inter, sans-serif',
                  letterSpacing: '1px', textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}>{stat.lbl}</span>
              </div>
            ))}
          </div>
        )}

        {/* HR block — only shown when at least avg HR is available */}
        {(item.avg_bpm || item.min_hr || item.max_hr) && (
          <div style={{
            display: 'flex',
            marginBottom: 20,
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            overflow: 'hidden',
          }}>
            {[
              { val: item.avg_bpm != null ? `${item.avg_bpm}` : '—', lbl: 'Avg BPM' },
              { val: item.min_hr  != null ? `${item.min_hr}`  : '—', lbl: 'Low' },
              { val: item.max_hr  != null ? `${item.max_hr}`  : '—', lbl: 'High' },
            ].map((stat, i) => (
              <div key={stat.lbl} style={{
                flex: 1, padding: '10px 14px',
                borderLeft: i > 0 ? '1px solid var(--border-default)' : 'none',
                display: 'flex', flexDirection: 'column', gap: 3,
              }}>
                <span style={{
                  font: '700 15px/1 JetBrains Mono, monospace',
                  letterSpacing: '-0.5px', color: 'var(--text-primary)',
                }}>{stat.val}</span>
                <span style={{
                  font: '600 9px/1 Inter, sans-serif',
                  letterSpacing: '1px', textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}>{stat.lbl}</span>
              </div>
            ))}
          </div>
        )}

        {/* Calories */}
        {item.calories_burned != null && (
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 6,
            marginBottom: 20,
            paddingLeft: 2,
          }}>
            <span style={{
              font: '700 15px/1 JetBrains Mono, monospace',
              letterSpacing: '-0.5px', color: 'var(--text-primary)',
            }}>{item.calories_burned}</span>
            <span style={{
              font: '600 9px/1 Inter, sans-serif',
              letterSpacing: '1px', textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}>cal</span>
          </div>
        )}

        {/* Effort picker */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            font: '600 10px/1 Inter, sans-serif', letterSpacing: '1.2px',
            textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8,
          }}>
            Effort
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['basic', 'mid', 'lets_go'] as const).map(level => (
              <button
                key={level}
                onClick={() => handleEffort(level)}
                style={{
                  flex: 1, padding: '8px 0',
                  borderRadius: 'var(--radius-pill)',
                  border: `1px solid ${localEffort === level ? 'var(--ochre)' : 'var(--border-default)'}`,
                  background: localEffort === level ? 'var(--ochre)' : 'transparent',
                  color: localEffort === level ? 'var(--bg-base)' : 'var(--text-muted)',
                  font: '600 12px/1 Inter, sans-serif',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                {EFFORT_ICON[level]}
                {EFFORT_LABEL[level]}
              </button>
            ))}
          </div>
        </div>

        {/* Workout / Strength section */}
        {isWorkout && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              font: '600 10px/1 Inter, sans-serif', letterSpacing: '1.2px',
              textTransform: 'uppercase', color: 'var(--text-muted)',
            }}>
              Strength Session
            </div>

            {linkedSession ? (
              <>
                {loadingDetail && !detail && (
                  <div style={{
                    padding: 14,
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    font: '400 12px/1.5 Inter, sans-serif',
                    color: 'var(--text-muted)',
                  }}>
                    Loading session…
                  </div>
                )}

                {detail && (
                  <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    borderLeft: '3px solid var(--rust)',
                    overflow: 'hidden',
                  }}>
                    {/* Session header: split */}
                    <div style={{
                      padding: '12px 14px 8px',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <Dumbbell size={12} color="var(--rust)" />
                      <span style={{
                        font: '700 13px/1 Inter, sans-serif',
                        color: 'var(--rust)', textTransform: 'capitalize',
                      }}>
                        {detail.split}
                      </span>
                    </div>

                    {/* Body area chips */}
                    {detail.bodyAreas.length > 0 && (
                      <div style={{ padding: '0 14px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {detail.bodyAreas.map(a => (
                          <span key={a} style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-pill)',
                            background: 'rgba(180,112,80,0.15)',
                            border: '1px solid rgba(180,112,80,0.25)',
                            font: '600 10px/1 Inter, sans-serif',
                            color: 'var(--rust)',
                          }}>
                            {a}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Totals: sets / reps / load */}
                    <div style={{
                      display: 'flex',
                      borderTop: '1px solid var(--border-default)',
                    }}>
                      {[
                        { val: String(detail.totalSets), lbl: 'Sets' },
                        { val: String(detail.totalReps), lbl: 'Reps' },
                        { val: Math.round(detail.totalLoadKg).toLocaleString(), lbl: 'Volume' },
                      ].map((t, i) => (
                        <div key={t.lbl} style={{
                          flex: 1, padding: '10px 14px',
                          borderLeft: i > 0 ? '1px solid var(--border-default)' : 'none',
                          display: 'flex', flexDirection: 'column', gap: 3,
                        }}>
                          <span style={{
                            font: '700 15px/1 JetBrains Mono, monospace',
                            letterSpacing: '-0.5px', color: 'var(--text-primary)',
                          }}>{t.val}</span>
                          <span style={{
                            font: '600 9px/1 Inter, sans-serif',
                            letterSpacing: '1px', textTransform: 'uppercase',
                            color: 'var(--text-muted)',
                          }}>{t.lbl}</span>
                        </div>
                      ))}
                    </div>

                    {/* Exercise table */}
                    {detail.rows.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border-default)', padding: '0 14px 12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                          <thead>
                            <tr>
                              {[
                                { label: 'Exercise', style: { textAlign: 'left' as const, flex: 1 } },
                                { label: 'Sets', style: { width: 28, textAlign: 'right' as const } },
                                { label: 'Reps', style: { width: 32, textAlign: 'right' as const } },
                                { label: 'Top', style: { width: 52, textAlign: 'right' as const } },
                              ].map(col => (
                                <th key={col.label} style={{
                                  ...col.style,
                                  font: '600 9px/1 Inter, sans-serif',
                                  letterSpacing: '0.5px', textTransform: 'uppercase',
                                  color: 'var(--text-muted)',
                                  paddingBottom: 6,
                                  borderBottom: '1px solid var(--border-default)',
                                }}>
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {detail.rows.map((row) => (
                              <tr key={row.name}>
                                <td style={{ padding: '7px 0', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{
                                      width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                                      background: row.isPb ? 'var(--ochre)' : 'transparent',
                                    }} />
                                    <span style={{
                                      font: '500 12px/1.3 Inter, sans-serif',
                                      color: row.isPb ? 'var(--ochre)' : 'var(--text-secondary)',
                                    }}>
                                      {row.name}
                                    </span>
                                    <button
                                      onClick={() => {
                                        const raw = exerciseLookup.get(row.exerciseId);
                                        if (raw) {
                                          setEditingExercise({
                                            id: raw.id,
                                            name: raw.name,
                                            category: raw.category,
                                            muscles: raw.muscles ?? [],
                                          });
                                        }
                                      }}
                                      style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}
                                    >
                                      <Pencil size={11} />
                                    </button>
                                  </div>
                                </td>
                                <td style={{
                                  width: 28, textAlign: 'right', verticalAlign: 'middle',
                                  font: '600 12px/1 JetBrains Mono, monospace',
                                  letterSpacing: '-0.3px', color: 'var(--text-secondary)',
                                  padding: '7px 0',
                                }}>
                                  {row.sets}×
                                </td>
                                <td style={{
                                  width: 32, textAlign: 'right', verticalAlign: 'middle',
                                  font: '600 12px/1 JetBrains Mono, monospace',
                                  letterSpacing: '-0.3px', color: 'var(--text-secondary)',
                                  padding: '7px 0',
                                }}>
                                  {row.totalReps}
                                </td>
                                <td style={{
                                  width: 52, textAlign: 'right', verticalAlign: 'middle',
                                  font: '600 12px/1 JetBrains Mono, monospace',
                                  letterSpacing: '-0.3px', color: 'var(--text-secondary)',
                                  padding: '7px 0',
                                }}>
                                  {fmtWeight(row.topWeightKg, row.usesBodyweight)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions: unlink + re-log */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { onUnlink(linkedSession.id); onClose(); }}
                    style={{
                      flex: 1, padding: '10px',
                      background: 'transparent',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-muted)',
                      font: '600 12px/1 Inter, sans-serif',
                      cursor: 'pointer',
                    }}
                  >
                    Unlink
                  </button>
                  <button
                    onClick={onLogStrength}
                    style={{
                      flex: 1, padding: '10px',
                      background: 'transparent',
                      border: '1px solid var(--rust)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--rust)',
                      font: '600 12px/1 Inter, sans-serif',
                      cursor: 'pointer',
                    }}
                  >
                    Re-log
                  </button>
                </div>
              </>
            ) : (
              /* No linked session — offer to log or link */
              <>
                <button
                  onClick={onLogStrength}
                  style={{
                    width: '100%', padding: '12px',
                    background: 'transparent',
                    border: '1px solid var(--rust)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--rust)',
                    font: '600 13px/1 Inter, sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  Log strength session
                </button>

                {unlinkedSessions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{
                      font: '600 10px/1 Inter, sans-serif', letterSpacing: '1.2px',
                      textTransform: 'uppercase', color: 'var(--text-muted)',
                    }}>
                      Link existing
                    </div>
                    {unlinkedSessions.map(session => (
                      <div
                        key={session.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{
                            font: '600 13px/1 Inter, sans-serif',
                            color: 'var(--text-primary)', textTransform: 'capitalize',
                          }}>
                            {session.category}
                          </span>
                          <span style={{
                            font: '400 11px/1 JetBrains Mono, monospace',
                            color: 'var(--text-muted)', letterSpacing: '-0.3px',
                          }}>
                            {session.session_date} · {session.exercises.length} ex · {formatDuration(session.duration_mins ?? 0)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button
                            onClick={() => onDelete(session.id)}
                            disabled={deletingId === session.id}
                            style={{
                              padding: '4px 8px',
                              background: 'transparent', color: 'var(--signal-bad)',
                              border: '1px solid var(--signal-bad)', borderRadius: 'var(--radius-pill)',
                              font: '700 12px/1 Inter, sans-serif', cursor: 'pointer',
                              opacity: deletingId === session.id ? 0.5 : 1,
                            }}
                          >
                            ×
                          </button>
                          <button
                            onClick={() => onLink(session.id, item.id)}
                            disabled={linkingSessionId === session.id}
                            style={{
                              padding: '5px 14px',
                              background: 'var(--rust)', color: 'var(--bg-base)',
                              border: 'none', borderRadius: 'var(--radius-pill)',
                              font: '600 12px/1 Inter, sans-serif', cursor: 'pointer',
                              opacity: linkingSessionId === session.id ? 0.5 : 1,
                            }}
                          >
                            {linkingSessionId === session.id ? '…' : 'Link'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit sheet for activity_logs */}
      {showEdit && (
        <ActivityEditSheet
          type={isWorkout ? 'workout' : 'activity'}
          id={item.id}
          label={TYPE_LABELS[item.type] || item.type}
          init={isWorkout ? {
            workout_split: (() => {
              const lbl = linkedSession?.session_label;
              return (lbl === 'push' || lbl === 'pull' || lbl === 'legs' || lbl === 'abs') ? lbl : null;
            })(),
            duration_mins: item.duration_minutes ?? undefined,
            avg_hr: item.avg_bpm ?? undefined,
            min_hr: item.min_hr ?? undefined,
            max_hr: item.max_hr ?? undefined,
            started_at: item.start_time ?? undefined,
            activity_date: item.date,
          } : {
            duration_mins: item.duration_minutes ?? undefined,
            avg_hr: item.avg_bpm ?? undefined,
            min_hr: item.min_hr ?? undefined,
            max_hr: item.max_hr ?? undefined,
            distance_km: item.distance_km ?? undefined,
            avg_pace_secs: item.avg_pace_secs ?? undefined,
          }}
          onSave={() => { setShowEdit(false); onClose(); }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Exercise muscle tag editor */}
      {editingExercise && (
        <ExerciseEditSheet
          exercise={editingExercise}
          onSave={(updated) => {
            // Update the lookup so the pencil shows fresh data next tap
            setExerciseLookup(prev => {
              const next = new Map(prev);
              next.set(updated.id, { id: updated.id, name: updated.name, category: updated.category, uses_bodyweight: updated.muscles ? prev.get(updated.id)?.uses_bodyweight ?? false : false, muscles: updated.muscles });
              return next;
            });
            setEditingExercise(null);
          }}
          onClose={() => setEditingExercise(null)}
        />
      )}
    </>
  );
}
