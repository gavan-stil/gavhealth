import { useState } from 'react';
import { Dumbbell, Check, X, Plus, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type LoadType = 'kg' | 'bw' | 'bw+';
type WorkoutSet = { load_type: LoadType; kg: number; reps: number };
type WorkoutExercise = { name: string; superset: boolean; sets: WorkoutSet[] };

type StrengthState = 'empty' | 'parsing' | 'parsed' | 'confirmed' | 'saving' | 'error';
type CardMode = 'builder' | 'braindump';
type SplitName = 'push' | 'pull' | 'legs' | 'abs';

const SPLITS: SplitName[] = ['push', 'pull', 'legs', 'abs'];
const DEFAULT_SET: WorkoutSet = { load_type: 'kg', kg: 20, reps: 8 };

// Brain dump API returns flat sets — group by exercise_name
interface RawSet {
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  is_bodyweight: boolean;
  rpe: number | null;
}

interface StrengthParseResponse {
  session_label: string | null;
  session_datetime: string;
  sets: RawSet[];
}

function groupSetsToExercises(rawSets: RawSet[]): WorkoutExercise[] {
  const map = new Map<string, WorkoutExercise>();
  for (const s of rawSets) {
    if (!map.has(s.exercise_name)) {
      map.set(s.exercise_name, { name: s.exercise_name, superset: false, sets: [] });
    }
    const loadType: LoadType = s.is_bodyweight ? 'bw' : 'kg';
    map.get(s.exercise_name)!.sets.push({
      load_type: loadType,
      kg: s.weight_kg ?? 0,
      reps: s.reps,
    });
  }
  return Array.from(map.values());
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function buildStartTime(timeInput: string) {
  return `${today()}T${timeInput}:00`;
}

function Stepper({ value, onChange, step, min }: { value: number; onChange: (v: number) => void; step: number; min: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        style={{
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer',
          font: '600 14px/1 Inter', padding: 0,
        }}
      >−</button>
      <span style={{
        minWidth: 36, textAlign: 'center',
        font: '600 14px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px',
        color: 'var(--text-primary)',
      }}>
        {value}
      </span>
      <button
        onClick={() => onChange(value + step)}
        style={{
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer',
          font: '600 14px/1 Inter', padding: 0,
        }}
      >+</button>
    </div>
  );
}

function LoadTypePill({ value, onChange }: { value: LoadType; onChange: (v: LoadType) => void }) {
  const opts: LoadType[] = ['kg', 'bw', 'bw+'];
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {opts.map(o => (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{
            padding: '2px 8px',
            font: '600 10px/1 Inter, sans-serif', letterSpacing: '0.5px',
            textTransform: 'uppercase' as const,
            borderRadius: 'var(--radius-pill)', cursor: 'pointer',
            border: `1px solid ${value === o ? 'var(--rust)' : 'var(--border-default)'}`,
            background: value === o ? 'var(--rust)' : 'transparent',
            color: value === o ? 'var(--bg-base)' : 'var(--text-muted)',
          }}
        >
          {o === 'bw+' ? 'BW+' : o.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function ExerciseCard({
  exercise, exerciseIndex, onUpdate, onRemove,
}: {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  onUpdate: (idx: number, ex: WorkoutExercise) => void;
  onRemove: (idx: number) => void;
}) {
  const updateSet = (setIdx: number, patch: Partial<WorkoutSet>) => {
    const newSets = exercise.sets.map((s, i) => i === setIdx ? { ...s, ...patch } : s);
    onUpdate(exerciseIndex, { ...exercise, sets: newSets });
  };

  const removeSet = (setIdx: number) => {
    if (exercise.sets.length <= 1) return;
    onUpdate(exerciseIndex, { ...exercise, sets: exercise.sets.filter((_, i) => i !== setIdx) });
  };

  const addSet = () => {
    const last = exercise.sets[exercise.sets.length - 1] ?? DEFAULT_SET;
    onUpdate(exerciseIndex, { ...exercise, sets: [...exercise.sets, { ...last }] });
  };

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: `1px solid var(--border-default)`,
      borderLeft: exercise.superset ? '3px solid var(--ember)' : '1px solid var(--border-default)',
      borderRadius: 'var(--radius-sm)',
      padding: 'var(--space-md)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <input
          value={exercise.name}
          onChange={e => onUpdate(exerciseIndex, { ...exercise, name: e.target.value })}
          placeholder="Exercise name"
          style={{
            flex: 1, background: 'transparent', border: 'none',
            font: '600 14px/1.5 Inter, sans-serif', color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          onClick={() => onUpdate(exerciseIndex, { ...exercise, superset: !exercise.superset })}
          style={{
            padding: '2px 8px', borderRadius: 'var(--radius-pill)',
            font: '700 10px/1 Inter, sans-serif', letterSpacing: '0.5px', cursor: 'pointer',
            border: `1px solid ${exercise.superset ? 'var(--gold)' : 'var(--border-default)'}`,
            background: exercise.superset ? 'var(--gold)' : 'transparent',
            color: exercise.superset ? 'var(--bg-base)' : 'var(--text-muted)',
          }}
        >
          SS
        </button>
        <button
          onClick={() => onRemove(exerciseIndex)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 2,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {exercise.sets.map((set, si) => (
        <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <span style={{ font: '600 10px/1 JetBrains Mono, monospace', color: 'var(--text-muted)', width: 16 }}>
            {si + 1}
          </span>
          <LoadTypePill value={set.load_type} onChange={lt => updateSet(si, { load_type: lt })} />
          {set.load_type !== 'bw' ? (
            <>
              <Stepper value={set.kg} onChange={kg => updateSet(si, { kg })} step={2.5} min={0} />
              <span style={{ font: '400 12px/1 Inter', color: 'var(--text-muted)' }}>
                {set.load_type === 'bw+' ? 'extra kg' : 'kg'}
              </span>
            </>
          ) : (
            <span style={{ font: '400 12px/1 Inter', color: 'var(--text-muted)', padding: '0 var(--space-sm)' }}>
              bodyweight
            </span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>×</span>
          <Stepper value={set.reps} onChange={reps => updateSet(si, { reps })} step={1} min={1} />
          <button
            onClick={() => removeSet(si)}
            disabled={exercise.sets.length <= 1}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 2, marginLeft: 'auto',
              opacity: exercise.sets.length <= 1 ? 0.3 : 1,
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}

      <button
        onClick={addSet}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          font: '600 12px/1 Inter, sans-serif', color: 'var(--text-muted)',
          padding: 'var(--space-xs) 0', textAlign: 'left',
        }}
      >
        + Add Set
      </button>
    </div>
  );
}

export default function StrengthCard({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [mode, setMode] = useState<CardMode>('builder');
  const [state, setState] = useState<StrengthState>('empty');
  const [selectedSplit, setSelectedSplit] = useState<SplitName>('push');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [noLastSession, setNoLastSession] = useState(false);
  const [matchMessage, setMatchMessage] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [duration, setDuration] = useState(45);
  const [brainDumpInput, setBrainDumpInput] = useState('');
  const [parsedLabel, setParsedLabel] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const loadLastSession = async () => {
    try {
      const data = await apiFetch<{ date: string; exercises: WorkoutExercise[] } | null>(
        `/api/log/strength/last/${selectedSplit}`
      );
      if (data && data.exercises && data.exercises.length > 0) {
        setExercises(data.exercises.map(e => ({
          ...e,
          sets: e.sets.map(s => ({ ...s })),
        })));
        setLastDate(data.date);
        setNoLastSession(false);
      } else {
        setExercises([]);
        setLastDate(null);
        setNoLastSession(true);
      }
    } catch {
      setExercises([]);
      setNoLastSession(true);
    }
  };

  const updateExercise = (idx: number, ex: WorkoutExercise) => {
    setExercises(prev => prev.map((e, i) => i === idx ? ex : e));
  };

  const removeExercise = (idx: number) => {
    setExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const addExercise = () => {
    setExercises(prev => [...prev, { name: '', superset: false, sets: [{ ...DEFAULT_SET }] }]);
  };

  const handleSaveSession = async () => {
    setState('saving');
    setMatchMessage(null);
    try {
      const result = await apiFetch<{ id: number; matched_activity_id: number | null }>('/api/log/strength/save', {
        method: 'POST',
        body: JSON.stringify({
          workout_split: selectedSplit,
          exercises,
          start_time: buildStartTime(startTime),
          duration_minutes: duration,
          notes: null,
        }),
      });
      setMatchMessage(result.matched_activity_id
        ? 'Matched to Withings session ✓'
        : 'Saved — no Withings match found'
      );
      setState('confirmed');
      setTimeout(() => {
        setState('empty');
        setExercises([]);
        setLastDate(null);
        setMatchMessage(null);
      }, 3000);
    } catch {
      setErrorMsg('Could not save session');
      setState('error');
    }
  };

  const handleBrainDumpParse = async () => {
    setState('parsing');
    try {
      const result = await apiFetch<StrengthParseResponse>('/api/log/strength', {
        method: 'POST',
        body: JSON.stringify({ description: brainDumpInput }),
      });
      setExercises(groupSetsToExercises(result.sets));
      setParsedLabel(result.session_label);
      setState('parsed');
    } catch {
      setErrorMsg('Could not parse workout');
      setState('error');
    }
  };

  const handleBrainDumpConfirm = async () => {
    setState('saving');
    try {
      await apiFetch('/api/log/strength/save', {
        method: 'POST',
        body: JSON.stringify({
          workout_split: selectedSplit,
          exercises,
          start_time: buildStartTime(startTime),
          duration_minutes: duration,
          notes: null,
        }),
      });
      setState('confirmed');
      setTimeout(() => {
        setState('empty');
        setBrainDumpInput('');
        setExercises([]);
        setParsedLabel(null);
      }, 2000);
    } catch {
      setErrorMsg('Could not save session');
      setState('error');
    }
  };

  const handleBrainDumpEdit = () => {
    setState('empty');
    setExercises([]);
    setParsedLabel(null);
  };

  const resetForm = () => {
    setExercises([]);
    setLastDate(null);
    setNoLastSession(false);
    setBrainDumpInput('');
    setParsedLabel(null);
    setDuration(45);
    setMatchMessage(null);
    setErrorMsg('');
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
        <Dumbbell size={18} color="var(--rust)" />
        <span style={{ font: '700 16px/1.2 Inter, sans-serif', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
          Strength
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 var(--space-lg) var(--space-lg)' }}>
          {state === 'confirmed' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--signal-good)' }}>
                <Check size={18} />
                <span style={{ font: '600 14px/1 Inter, sans-serif' }}>Logged!</span>
              </div>
              {matchMessage && (
                <span style={{ font: '400 12px/1 Inter, sans-serif', color: 'var(--text-muted)', paddingLeft: 26 }}>
                  {matchMessage}
                </span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-pill)', padding: 2 }}>
                {(['builder', 'braindump'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setState('empty'); resetForm(); }}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 'var(--radius-pill)',
                      font: '600 12px/1 Inter, sans-serif', cursor: 'pointer',
                      border: 'none',
                      background: mode === m ? 'var(--rust)' : 'transparent',
                      color: mode === m ? 'var(--bg-base)' : 'var(--text-muted)',
                    }}
                  >
                    {m === 'builder' ? 'Builder' : 'Brain Dump'}
                  </button>
                ))}
              </div>

              {mode === 'builder' ? (
                <>
                  {/* Split selector */}
                  <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    {SPLITS.map(s => (
                      <button
                        key={s}
                        onClick={() => { setSelectedSplit(s); setExercises([]); setLastDate(null); setNoLastSession(false); }}
                        style={{
                          flex: 1, padding: '6px 0', borderRadius: 'var(--radius-pill)',
                          font: '600 12px/1 Inter, sans-serif', cursor: 'pointer',
                          textTransform: 'capitalize' as const,
                          border: `1px solid ${selectedSplit === s ? 'var(--rust)' : 'var(--border-default)'}`,
                          background: selectedSplit === s ? 'var(--rust)' : 'transparent',
                          color: selectedSplit === s ? 'var(--bg-base)' : 'var(--text-muted)',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {/* Load last session */}
                  <button
                    onClick={loadLastSession}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-sm) var(--space-md)',
                      font: '400 13px/1.5 Inter, sans-serif', color: 'var(--ochre)',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {lastDate
                      ? `Load last ${selectedSplit} · ${lastDate}`
                      : `Load last ${selectedSplit} session`}
                  </button>
                  {noLastSession && (
                    <span style={{ font: '400 12px/1 Inter', color: 'var(--text-muted)' }}>
                      No previous {selectedSplit} session found
                    </span>
                  )}

                  {/* Exercise cards */}
                  {exercises.map((ex, i) => (
                    <ExerciseCard
                      key={i}
                      exercise={ex}
                      exerciseIndex={i}
                      onUpdate={updateExercise}
                      onRemove={removeExercise}
                    />
                  ))}

                  {/* Add exercise */}
                  <button
                    onClick={addExercise}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
                      background: 'transparent',
                      border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-sm) var(--space-md)',
                      font: '600 13px/1 Inter, sans-serif', color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} /> Add Exercise
                  </button>

                  {/* Start time + Duration */}
                  <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ font: '600 10px/1 Inter, sans-serif', letterSpacing: '1.2px', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                        style={{
                          width: '100%', background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                          padding: 'var(--space-sm) var(--space-md)',
                          color: 'var(--text-primary)',
                          font: '600 14px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ font: '600 10px/1 Inter, sans-serif', letterSpacing: '1.2px', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                        Duration (min)
                      </label>
                      <Stepper value={duration} onChange={setDuration} step={5} min={5} />
                    </div>
                  </div>

                  {/* Save */}
                  <button
                    onClick={handleSaveSession}
                    disabled={exercises.length === 0 || state === 'saving'}
                    style={{
                      padding: 'var(--space-sm) var(--space-lg)',
                      background: 'var(--rust)', color: 'var(--bg-base)',
                      border: 'none', borderRadius: 'var(--radius-md)',
                      font: '600 14px/1 Inter, sans-serif', cursor: 'pointer',
                      opacity: (exercises.length === 0 || state === 'saving') ? 0.4 : 1,
                      ...(state === 'saving' ? { animation: 'pulse 1.5s infinite' } : {}),
                    }}
                  >
                    {state === 'saving' ? 'Saving…' : 'Save Session'}
                  </button>

                  {state === 'error' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--ember)' }}>
                      <AlertCircle size={14} />
                      <span style={{ font: '400 13px/1 Inter, sans-serif' }}>{errorMsg}</span>
                    </div>
                  )}
                </>
              ) : (
                /* Brain Dump mode */
                (['parsed','saving','error'].includes(state)) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', opacity: state === 'saving' ? 0.5 : 1, pointerEvents: state === 'saving' ? 'none' : 'auto' }}>
                    {/* Session label from AI parse */}
                    {parsedLabel && (
                      <span style={{ font: '600 10px/1 Inter, sans-serif', letterSpacing: '1.2px', textTransform: 'uppercase' as const, color: 'var(--text-muted)' }}>
                        {parsedLabel}
                      </span>
                    )}
                    {exercises.map((ex, i) => (
                      <div key={i} style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                        padding: 'var(--space-md)',
                      }}>
                        <div style={{ font: '600 14px/1.5 Inter, sans-serif', color: 'var(--text-primary)', marginBottom: 'var(--space-xs)' }}>
                          {ex.name}
                        </div>
                        {ex.sets.map((set, si) => (
                          <div key={si} style={{ font: '600 14px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px', color: 'var(--text-secondary)' }}>
                            {set.load_type === 'bw' ? `BW × ${set.reps}` : `${set.kg}kg × ${set.reps}`}
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Split selector for brain dump confirm */}
                    <div>
                      <label style={{ font: '600 10px/1 Inter, sans-serif', letterSpacing: '1.2px', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                        Split
                      </label>
                      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                        {SPLITS.map(s => (
                          <button
                            key={s}
                            onClick={() => setSelectedSplit(s)}
                            style={{
                              flex: 1, padding: '6px 0', borderRadius: 'var(--radius-pill)',
                              font: '600 12px/1 Inter, sans-serif', cursor: 'pointer',
                              textTransform: 'capitalize' as const,
                              border: `1px solid ${selectedSplit === s ? 'var(--rust)' : 'var(--border-default)'}`,
                              background: selectedSplit === s ? 'var(--rust)' : 'transparent',
                              color: selectedSplit === s ? 'var(--bg-base)' : 'var(--text-muted)',
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                      <button
                        onClick={handleBrainDumpConfirm}
                        disabled={state === 'saving'}
                        style={{
                          flex: 1, padding: 'var(--space-sm) var(--space-lg)',
                          background: 'var(--rust)', color: 'var(--bg-base)',
                          border: 'none', borderRadius: 'var(--radius-md)',
                          font: '600 14px/1 Inter, sans-serif', cursor: 'pointer',
                          opacity: state === 'saving' ? 0.4 : 1,
                        }}
                      >
                        {state === 'saving' ? 'Saving…' : 'Confirm'}
                      </button>
                      <button
                        onClick={handleBrainDumpEdit}
                        style={{
                          padding: 'var(--space-sm) var(--space-lg)',
                          background: 'transparent', color: 'var(--text-secondary)',
                          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                          font: '600 14px/1 Inter, sans-serif', cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    </div>

                    {state === 'error' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--ember)' }}>
                        <AlertCircle size={14} />
                        <span style={{ font: '400 13px/1 Inter, sans-serif' }}>{errorMsg}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <textarea
                      placeholder="e.g. bench press 80kg x8 x3, squat 100kg x5 x4"
                      value={brainDumpInput}
                      onChange={e => setBrainDumpInput(e.target.value)}
                      disabled={state === 'parsing'}
                      rows={3}
                      style={{
                        width: '100%', resize: 'none',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                        padding: 'var(--space-sm) var(--space-md)',
                        color: 'var(--text-primary)',
                        font: '400 14px/1.5 Inter, sans-serif',
                        opacity: state === 'parsing' ? 0.5 : 1,
                      }}
                    />
                    <button
                      onClick={handleBrainDumpParse}
                      disabled={state === 'parsing' || !brainDumpInput.trim()}
                      style={{
                        padding: 'var(--space-sm) var(--space-lg)',
                        background: 'var(--rust)', color: 'var(--bg-base)',
                        border: 'none', borderRadius: 'var(--radius-md)',
                        font: '600 14px/1 Inter, sans-serif', cursor: 'pointer',
                        opacity: (state === 'parsing' || !brainDumpInput.trim()) ? 0.4 : 1,
                        ...(state === 'parsing' ? { animation: 'pulse 1.5s infinite' } : {}),
                      }}
                    >
                      {state === 'parsing' ? 'Parsing…' : 'Parse'}
                    </button>
                    {(['error','empty','parsing'] as string[]).includes(state) && state === 'error' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--ember)' }}>
                        <AlertCircle size={14} />
                        <span style={{ font: '400 13px/1 Inter, sans-serif' }}>{errorMsg}</span>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
