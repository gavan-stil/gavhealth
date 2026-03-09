import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Dumbbell, Link2Off } from 'lucide-react';
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
  effort: EffortLevel;
  effort_manually_set: boolean;
}

interface StrengthSession {
  id: number;
  log_date: string;
  workout_split: string;
  duration_minutes: number;
  exercise_count: number;
  matched_activity_id: number | null;
}

type MergedItem =
  | { kind: 'activity'; item: FeedItem }
  | { kind: 'orphan'; session: StrengthSession };

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

type FeedFilter = 'all' | 'run' | 'ride' | 'weights' | 'sauna';

export default function ActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const [expandedOrphanId, setExpandedOrphanId] = useState<number | null>(null);
  const [strengthSheetActivityId, setStrengthSheetActivityId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FeedFilter>('all');

  // Strength session state
  const [strengthSessions, setStrengthSessions] = useState<StrengthSession[]>([]);
  const [linkingSessionId, setLinkingSessionId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [orphanLinkingId, setOrphanLinkingId] = useState<number | null>(null); // orphan showing activity picker

  const fetchStrengthSessions = useCallback(async () => {
    try {
      const data = await apiFetch<StrengthSession[]>('/api/log/strength/sessions?days=30');
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
    if (s.matched_activity_id !== null) {
      linkedByActivityId[s.matched_activity_id] = s;
    }
  }
  const unlinkedSessions = strengthSessions.filter(s => s.matched_activity_id === null);

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
      await apiFetch(`/api/log/strength/${sessionId}/relink`, {
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
      await apiFetch(`/api/log/strength/${sessionId}/unlink`, { method: 'PATCH' });
      await fetchStrengthSessions();
      setSelectedItem(null);
    } catch {
      // silently ignore
    }
  };

  const handleDelete = async (sessionId: number) => {
    if (!window.confirm('Delete this strength session?')) return;
    setDeletingId(sessionId);
    try {
      await apiFetch(`/api/log/strength/${sessionId}`, { method: 'DELETE' });
      await fetchStrengthSessions();
      setExpandedOrphanId(null);
    } catch {
      // silently ignore
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
    const dateA = a.kind === 'activity' ? a.item.date : a.session.log_date;
    const dateB = b.kind === 'activity' ? b.item.date : b.session.log_date;
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
            const isExpanded = expandedOrphanId === session.id;
            return (
              <div
                key={`orphan-${session.id}`}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  borderLeft: '3px solid var(--rust)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                }}
              >
                {/* Orphan header row */}
                <div
                  onClick={() => setExpandedOrphanId(prev => prev === session.id ? null : session.id)}
                  style={{
                    padding: 'var(--space-md) var(--space-lg)',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: '#b47050',
                    }} />
                    <span style={{
                      font: '700 16px/1.2 Inter, sans-serif', letterSpacing: '-0.5px',
                      color: 'var(--text-primary)', flex: 1, textTransform: 'capitalize',
                    }}>
                      Strength
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid var(--rust)',
                      color: 'var(--rust)',
                      font: '600 11px/1 Inter, sans-serif',
                    }}>
                      <Link2Off size={10} />
                      unlinked
                    </span>
                  </div>
                  <div style={{
                    font: '600 13px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px',
                    color: 'var(--text-secondary)', paddingLeft: 'calc(10px + var(--space-sm))',
                  }}>
                    {formatDate(session.log_date)}
                    {' · '}{session.exercise_count} exercises
                    {' · '}{formatDuration(session.duration_minutes)}
                  </div>
                  <div style={{
                    paddingLeft: 'calc(10px + var(--space-sm))',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Dumbbell size={11} color="var(--rust)" />
                    <span style={{
                      font: '600 11px/1 Inter, sans-serif', color: 'var(--rust)',
                      textTransform: 'capitalize',
                    }}>
                      {session.workout_split}
                    </span>
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)',
                    padding: 'var(--space-sm) var(--space-lg) var(--space-md)',
                    borderTop: '1px solid var(--border-default)',
                  }}>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                      {/* Delete */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                        disabled={deletingId === session.id}
                        style={{
                          flex: 1, padding: '8px',
                          background: 'transparent',
                          border: '1px solid var(--signal-bad)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--signal-bad)',
                          font: '600 12px/1 Inter, sans-serif',
                          cursor: 'pointer',
                          opacity: deletingId === session.id ? 0.5 : 1,
                        }}
                      >
                        {deletingId === session.id ? 'Deleting…' : 'Delete session'}
                      </button>
                      {/* Link to workout */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrphanLinkingId(prev => prev === session.id ? null : session.id);
                        }}
                        style={{
                          flex: 1, padding: '8px',
                          background: orphanLinkingId === session.id ? 'var(--bg-elevated)' : 'transparent',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-secondary)',
                          font: '600 12px/1 Inter, sans-serif',
                          cursor: 'pointer',
                        }}
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
                            <div
                              key={workout.id}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ font: '600 13px/1 Inter, sans-serif', color: 'var(--text-primary)' }}>
                                  Workout
                                </span>
                                <span style={{ font: '400 11px/1 JetBrains Mono, monospace', color: 'var(--text-muted)', letterSpacing: '-0.3px' }}>
                                  {formatDate(workout.date)} · {formatDuration(workout.duration_minutes)}
                                  {workout.avg_bpm ? ` · ${workout.avg_bpm}bpm` : ''}
                                </span>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleLink(session.id, workout.id); }}
                                disabled={linkingSessionId === session.id}
                                style={{
                                  padding: '4px 12px',
                                  background: 'var(--rust)', color: 'var(--bg-base)',
                                  border: 'none', borderRadius: 'var(--radius-pill)',
                                  font: '600 11px/1 Inter, sans-serif',
                                  cursor: 'pointer',
                                  opacity: linkingSessionId === session.id ? 0.5 : 1,
                                }}
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
                      {linkedByActivityId[item.id].workout_split} · {linkedByActivityId[item.id].exercise_count} exercises
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity detail sheet */}
      {selectedItem !== null && (
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
        />
      )}

      {/* Strength sheet overlay */}
      {strengthSheetActivityId !== null && (
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
