import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Dumbbell, Link2Off } from 'lucide-react';
import { EnergyIcon } from './MoodEnergyCard';
import { apiFetch } from '@/lib/api';
import StrengthCard from './StrengthCard';
import ActivityDetailSheet from './ActivityDetailSheet';

type EffortLevel = 'basic' | 'mid' | 'lets_go';

interface FeedItem {
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
  effort: EffortLevel;
  effort_manually_set: boolean;
}

interface StrengthSession {
  id: number;
  session_date: string;
  session_datetime: string | null;
  category: string;
  duration_mins: number;
  exercises: string[];
  activity_log_id: number | null;
}

type MergedItem =
  | { kind: 'activity'; item: FeedItem }
  | { kind: 'orphan'; session: StrengthSession };

/* ── Orphan detail types (for exercise fetch) ───────────────────────────── */
type RawSession = {
  id: number; session_date: string; exercises: string[];
  total_sets: number; total_reps: number; total_load_kg: number;
};
type RawExercise = { id: number; name: string; uses_bodyweight: boolean };
type HistoryEntry = { session_date: string; sets: number; total_reps: number; top_weight_kg: number };
type ExRow = { name: string; sets: number; totalReps: number; topWeightKg: number; usesBodyweight: boolean; isPb: boolean };
type OrphanDetail = { bodyAreas: string[]; totalSets: number; totalReps: number; totalLoadKg: number; rows: ExRow[] };

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

function formatPace(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

/* ── Orphan exercise helpers ─────────────────────────────────────────────── */
function parseEx(raw: string): { name: string; catStr: string } {
  const idx = raw.lastIndexOf(' - ');
  return idx === -1 ? { name: raw, catStr: '' } : { name: raw.slice(0, idx), catStr: raw.slice(idx + 3) };
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

type FeedFilter = 'all' | 'run' | 'ride' | 'weights' | 'sauna';

export default function ActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const [strengthSheetActivityId, setStrengthSheetActivityId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FeedFilter>('all');

  // Strength session state
  const [strengthSessions, setStrengthSessions] = useState<StrengthSession[]>([]);
  const [linkingSessionId, setLinkingSessionId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingActivityId, setDeletingActivityId] = useState<number | null>(null);
  const [orphanLinkingId, setOrphanLinkingId] = useState<number | null>(null); // orphan showing activity picker

  const fetchStrengthSessions = useCallback(async () => {
    try {
      const data = await apiFetch<StrengthSession[]>('/api/strength/sessions?days=30');
      setStrengthSessions(data);
    } catch {
      // silently ignore — non-critical
    }
  }, []);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<FeedItem[]>('/api/activities/feed?days=30');
      setItems(data);
    } catch {
      setError('Could not load activity feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    fetchStrengthSessions();
  }, [fetchFeed, fetchStrengthSessions]);

  // Build lookup: activityId → linked session
  const linkedByActivityId: Record<number, StrengthSession> = {};
  for (const s of strengthSessions) {
    if (s.activity_log_id !== null) {
      linkedByActivityId[s.activity_log_id] = s;
    }
  }
  const unlinkedSessions = strengthSessions.filter(s => s.activity_log_id === null);

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
        i.id === id ? { ...i, effort: prev ?? i.effort, effort_manually_set: false } : i
      ));
    }
  };

  const handleLink = async (sessionId: number, activityId: number) => {
    setLinkingSessionId(sessionId);
    try {
      await apiFetch(`/api/strength/sessions/${sessionId}/link`, {
        method: 'PATCH',
        body: JSON.stringify({ activity_id: activityId }),
      });
      await fetchStrengthSessions();
      setOrphanLinkingId(null);
      setSelectedItem(null);
    } catch {
      // ignore
    } finally {
      setLinkingSessionId(null);
    }
  };

  const handleUnlink = async (sessionId: number) => {
    try {
      await apiFetch(`/api/strength/sessions/${sessionId}/unlink`, { method: 'PATCH' });
      await fetchStrengthSessions();
      setSelectedItem(null);
    } catch {
      // silently ignore
    }
  };

  const handleDeleteActivity = async (activityId: number) => {
    if (!window.confirm('Delete this workout? This cannot be undone.')) return;
    setDeletingActivityId(activityId);
    setItems((prev) => prev.filter((i) => i.id !== activityId));
    try {
      await apiFetch(`/api/activity-logs/${activityId}`, { method: 'DELETE' });
    } catch {
      await fetchFeed();
    } finally {
      setDeletingActivityId(null);
    }
  };

  const handleDelete = async (sessionId: number) => {
    if (!window.confirm('Delete this strength session?')) return;
    setDeletingId(sessionId);
    // Optimistically remove immediately
    setStrengthSessions((prev) => prev.filter((s) => s.id !== sessionId));
    try {
      await apiFetch(`/api/strength/sessions/${sessionId}`, { method: 'DELETE' });
    } catch {
      // On failure, re-fetch to restore state
      await fetchStrengthSessions();
    } finally {
      setDeletingId(null);
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

  const filteredItems = filter === 'all' ? items
    : filter === 'weights' ? items.filter(i => isWorkout(i.type))
    : items.filter(i => i.type === filter);

  // Orphans show for 'all' and 'weights' filters
  const showOrphans = filter === 'all' || filter === 'weights';

  // Workout activities that don't have a linked session (for orphan → link picker)
  const unlinkedWorkouts = items.filter(i => isWorkout(i.type) && !linkedByActivityId[i.id]);

  // Merge and sort by date descending
  const mergedFeed: MergedItem[] = [
    ...filteredItems.map(item => ({ kind: 'activity' as const, item })),
    ...(showOrphans ? unlinkedSessions.map(session => ({ kind: 'orphan' as const, session })) : []),
  ].sort((a, b) => {
    const dateA = a.kind === 'activity' ? a.item.date : a.session.session_date;
    const dateB = b.kind === 'activity' ? b.item.date : b.session.session_date;
    return dateB.localeCompare(dateA);
  });

  const PILLS: { label: string; value: FeedFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Run', value: 'run' },
    { label: 'Ride', value: 'ride' },
    { label: 'Weights', value: 'weights' },
    { label: 'Sauna', value: 'sauna' },
  ];

  return (
    <>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)',
        padding: 'var(--space-lg)',
      }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--space-xs)' }}>
          {PILLS.map(pill => {
            const active = filter === pill.value;
            return (
              <button
                key={pill.value}
                onClick={() => setFilter(pill.value)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border-default)',
                  background: active ? 'var(--ochre)' : 'transparent',
                  color: active ? 'var(--bg-base)' : 'var(--text-muted)',
                  font: '600 11px/1.4 Inter, sans-serif',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {mergedFeed.map(entry => {
          if (entry.kind === 'orphan') {
            const session = entry.session;
            return (
              <OrphanCard
                key={`orphan-${session.id}`}
                session={session}
                orphanLinkingId={orphanLinkingId}
                setOrphanLinkingId={setOrphanLinkingId}
                unlinkedWorkouts={unlinkedWorkouts}
                deletingId={deletingId}
                linkingSessionId={linkingSessionId}
                onDelete={handleDelete}
                onLink={handleLink}
              />
            );
          }

          // --- Activity card ---
          const item = entry.item;
          return (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <div style={{
                padding: 'var(--space-md) var(--space-lg)',
                display: 'flex', flexDirection: 'column', gap: '6px',
              }}>
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

                <div style={{
                  font: '600 13px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px',
                  color: 'var(--text-secondary)', paddingLeft: 'calc(10px + var(--space-sm))',
                }}>
                  {formatDate(item.date)}
                  {item.start_time ? ` · ${formatTime(item.start_time)}` : ''}
                  {' · '}{formatDuration(item.duration_minutes)}
                  {item.avg_bpm ? ` · ${item.avg_bpm}bpm` : ''}
                </div>

                {(item.type === 'run' || item.type === 'ride') && (item.distance_km || item.avg_pace_secs) && (
                  <div style={{
                    font: '600 13px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px',
                    color: 'var(--text-secondary)', paddingLeft: 'calc(10px + var(--space-sm))',
                  }}>
                    {item.distance_km ? `${item.distance_km.toFixed(2)}km` : ''}
                    {item.distance_km && item.avg_pace_secs ? ' · ' : ''}
                    {item.avg_pace_secs ? formatPace(item.avg_pace_secs) : ''}
                  </div>
                )}

                {isWorkout(item.type) && linkedByActivityId[item.id] && (
                  <div style={{
                    paddingLeft: 'calc(10px + var(--space-sm))',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Dumbbell size={11} color="var(--rust)" />
                    <span style={{
                      font: '600 11px/1 Inter, sans-serif', color: 'var(--rust)',
                      textTransform: 'capitalize',
                    }}>
                      {linkedByActivityId[item.id].category} · {linkedByActivityId[item.id].exercises.length} exercises
                    </span>
                  </div>
                )}
              </div>
              {isWorkout(item.type) && (
                <div style={{ padding: '0 var(--space-lg) var(--space-md)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteActivity(item.id); }}
                    disabled={deletingActivityId === item.id}
                    style={{
                      font: '500 10px/1 Inter, sans-serif', letterSpacing: '0.3px',
                      padding: '5px 10px', borderRadius: 6,
                      border: '1px solid var(--signal-bad)', background: 'transparent',
                      color: 'var(--signal-bad)',
                      cursor: deletingActivityId === item.id ? 'wait' : 'pointer',
                      opacity: deletingActivityId === item.id ? 0.5 : 1,
                    }}
                  >
                    {deletingActivityId === item.id ? 'Deleting…' : 'Delete workout'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Activity detail sheet — portal to body so position:fixed works inside scroll container */}
      {selectedItem !== null && createPortal(
        <ActivityDetailSheet
          item={selectedItem}
          linkedSession={linkedByActivityId[selectedItem.id] ?? null}
          unlinkedSessions={unlinkedSessions}
          onClose={() => setSelectedItem(null)}
          onEffortChange={updateEffort}
          onLink={handleLink}
          onUnlink={handleUnlink}
          onLogStrength={() => {
            const actId = selectedItem.id;
            setSelectedItem(null);
            setStrengthSheetActivityId(actId);
          }}
          linkingSessionId={linkingSessionId}
          deletingId={deletingId}
          onDelete={handleDelete}
        />,
        document.body
      )}

      {/* Strength sheet overlay — portal to body so position:fixed works inside scroll container */}
      {strengthSheetActivityId !== null && createPortal(
        <>
          <div
            onClick={() => setStrengthSheetActivityId(null)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 110,
            }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            zIndex: 111,
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
              onConfirmed={() => {
                setStrengthSheetActivityId(null);
                fetchStrengthSessions();
              }}
            />
          </div>
        </>,
        document.body
      )}
    </>
  );
}

/* ── OrphanCard ─────────────────────────────────────────────────────────── */
function OrphanCard({
  session, orphanLinkingId, setOrphanLinkingId,
  unlinkedWorkouts, deletingId, linkingSessionId, onDelete, onLink,
}: {
  session: StrengthSession;
  orphanLinkingId: number | null;
  setOrphanLinkingId: (id: number | null) => void;
  unlinkedWorkouts: FeedItem[];
  deletingId: number | null;
  linkingSessionId: number | null;
  onDelete: (id: number) => void;
  onLink: (sessionId: number, activityId: number) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [detail, setDetail] = useState<OrphanDetail | null>(null);

  useEffect(() => {
    if (!isExpanded || detail !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const logDate = session.session_date.slice(0, 10);
        const d = new Date(logDate + 'T00:00:00');
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
        allEx.forEach(e => exMap.set(e.name.toLowerCase(), e));

        const withEx = rawSessions.filter(s => s.exercises.length > 0);
        const raw = withEx.find(s => s.id === session.id) ?? withEx[0];
        if (!raw) return;

        const sessionDate = raw.session_date.slice(0, 10);
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
          rows.push({ name, sets: entry.sets, totalReps: entry.total_reps, topWeightKg: entry.top_weight_kg, usesBodyweight: ex.uses_bodyweight, isPb });
        });

        if (!cancelled) {
          setDetail({ bodyAreas: deriveBodyAreas(raw.exercises), totalSets: raw.total_sets, totalReps: raw.total_reps, totalLoadKg: raw.total_load_kg, rows });
        }
      } catch (err) {
        console.error('[OrphanCard] fetch error:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-default)',
      borderLeft: '3px solid var(--rust)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setIsExpanded(prev => !prev)}
        style={{ padding: 'var(--space-md) var(--space-lg)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: '#b47050' }} />
          <span style={{ font: '700 16px/1.2 Inter, sans-serif', letterSpacing: '-0.5px', color: 'var(--text-primary)', flex: 1, textTransform: 'capitalize' }}>
            Strength
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--rust)', color: 'var(--rust)', font: '600 11px/1 Inter, sans-serif' }}>
            <Link2Off size={10} />
            unlinked
          </span>
        </div>
        <div style={{ font: '600 13px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px', color: 'var(--text-secondary)', paddingLeft: 'calc(10px + var(--space-sm))' }}>
          {formatDate(session.session_date)}
          {session.session_datetime ? ` · ${formatTime(session.session_datetime)}` : ''}
          {' · '}{session.exercises.length} exercises
          {' · '}{formatDuration(session.duration_mins)}
        </div>
        <div style={{ paddingLeft: 'calc(10px + var(--space-sm))', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Dumbbell size={11} color="var(--rust)" />
          <span style={{ font: '600 11px/1 Inter, sans-serif', color: 'var(--rust)', textTransform: 'capitalize' }}>
            {session.category}
          </span>
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-lg) var(--space-md)', borderTop: '1px solid var(--border-default)' }}>
          {detail && (
            <>
              {/* Area chips */}
              {detail.bodyAreas.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {detail.bodyAreas.map(a => (
                    <span key={a} style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'rgba(180,112,80,0.15)', border: '1px solid rgba(180,112,80,0.25)', font: '600 10px/1 Inter, sans-serif', color: 'var(--rust)' }}>
                      {a}
                    </span>
                  ))}
                </div>
              )}
              {/* Totals */}
              <div style={{ display: 'flex', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
                {[
                  { val: String(detail.totalSets), lbl: 'Sets' },
                  { val: String(detail.totalReps), lbl: 'Reps' },
                  { val: Math.round(detail.totalLoadKg).toLocaleString(), lbl: 'Volume' },
                ].map((t, i) => (
                  <div key={t.lbl} style={{ flex: 1, padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: 3, borderLeft: i > 0 ? '1px solid var(--border-default)' : undefined }}>
                    <span style={{ font: "700 15px/1 'JetBrains Mono',monospace", letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>{t.val}</span>
                    <span style={{ font: "500 9px/1 'Inter',sans-serif", letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t.lbl}</span>
                  </div>
                ))}
              </div>
              {/* Exercise table */}
              {detail.rows.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {[
                        { label: 'Exercise', style: { textAlign: 'left' as const } },
                        { label: 'Sets', style: { width: 28, textAlign: 'right' as const } },
                        { label: 'Reps', style: { width: 32, textAlign: 'right' as const } },
                        { label: 'Top', style: { width: 52, textAlign: 'right' as const } },
                      ].map(col => (
                        <th key={col.label} style={{ ...col.style, font: '600 9px/1 Inter, sans-serif', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 6, borderBottom: '1px solid var(--border-default)' }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.rows.map(row => (
                      <tr key={row.name}>
                        <td style={{ padding: '7px 0', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: row.isPb ? 'var(--ochre)' : 'transparent' }} />
                            <span style={{ font: '500 12px/1.3 Inter, sans-serif', color: row.isPb ? 'var(--ochre)' : 'var(--text-secondary)' }}>{row.name}</span>
                          </div>
                        </td>
                        <td style={{ width: 28, textAlign: 'right', verticalAlign: 'middle', font: '600 12px/1 JetBrains Mono, monospace', letterSpacing: '-0.3px', color: 'var(--text-secondary)', padding: '7px 0' }}>{row.sets}×</td>
                        <td style={{ width: 32, textAlign: 'right', verticalAlign: 'middle', font: '600 12px/1 JetBrains Mono, monospace', letterSpacing: '-0.3px', color: 'var(--text-secondary)', padding: '7px 0' }}>{row.totalReps}</td>
                        <td style={{ width: 52, textAlign: 'right', verticalAlign: 'middle', font: '600 12px/1 JetBrains Mono, monospace', letterSpacing: '-0.3px', color: 'var(--text-secondary)', padding: '7px 0' }}>{fmtWeight(row.topWeightKg, row.usesBodyweight)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
              disabled={deletingId === session.id}
              style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid var(--signal-bad)', borderRadius: 'var(--radius-md)', color: 'var(--signal-bad)', font: '600 12px/1 Inter, sans-serif', cursor: 'pointer', opacity: deletingId === session.id ? 0.5 : 1 }}
            >
              {deletingId === session.id ? 'Deleting…' : 'Delete session'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setOrphanLinkingId(orphanLinkingId === session.id ? null : session.id); }}
              style={{ flex: 1, padding: '8px', background: orphanLinkingId === session.id ? 'var(--bg-elevated)' : 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', font: '600 12px/1 Inter, sans-serif', cursor: 'pointer' }}
            >
              Link to workout
            </button>
          </div>

          {/* Activity picker for linking */}
          {orphanLinkingId === session.id && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              {unlinkedWorkouts.length === 0 ? (
                <span style={{ font: '400 12px/1.4 Inter, sans-serif', color: 'var(--text-muted)', padding: 'var(--space-xs) 0' }}>
                  No unlinked workouts in the last 30 days
                </span>
              ) : (
                unlinkedWorkouts.map(workout => (
                  <div key={workout.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-sm) var(--space-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ font: '600 13px/1 Inter, sans-serif', color: 'var(--text-primary)' }}>Workout</span>
                      <span style={{ font: '400 11px/1 JetBrains Mono, monospace', color: 'var(--text-muted)', letterSpacing: '-0.3px' }}>
                        {formatDate(workout.date)} · {formatDuration(workout.duration_minutes)}
                        {workout.avg_bpm ? ` · ${workout.avg_bpm}bpm` : ''}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onLink(session.id, workout.id); }}
                      disabled={linkingSessionId === session.id}
                      style={{ padding: '4px 12px', background: 'var(--rust)', color: 'var(--bg-base)', border: 'none', borderRadius: 'var(--radius-pill)', font: '600 11px/1 Inter, sans-serif', cursor: 'pointer', opacity: linkingSessionId === session.id ? 0.5 : 1 }}
                    >
                      {linkingSessionId === session.id ? '…' : 'Link'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const EFFORT_ENERGY_VALUE: Record<EffortLevel, number> = {
  basic: 2,
  mid: 4,
  lets_go: 5,
};

function EffortBadge({ effort, isUnreviewed }: { effort: EffortLevel; isUnreviewed: boolean }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <EnergyIcon value={EFFORT_ENERGY_VALUE[effort]} size={15} />
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
