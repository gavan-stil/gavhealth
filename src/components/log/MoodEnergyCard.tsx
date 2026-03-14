import { useState, useEffect, useCallback } from 'react';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { apiFetch } from '@/lib/api';

/* ── SVG Icon Components ── */

export function MoodIcon({ value, size = 18 }: { value: number; size?: number }) {
  const colors = ['#c45a4a', '#b47050', '#b8a878', '#d4a04a', '#e8c47a'];
  const c = colors[value - 1] ?? colors[2];
  const common = { fill: 'none', stroke: c, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  const mouths: Record<number, ReactNode> = {
    1: <path d="M 7.5 17 Q 12 13 16.5 17" {...common} />,
    2: <path d="M 8 16.5 Q 12 14.5 16 16.5" {...common} />,
    3: <line x1="8" y1="15.5" x2="16" y2="15.5" {...common} />,
    4: <path d="M 8 14.5 Q 12 17 16 14.5" {...common} />,
    5: <path d="M 7.5 14 Q 12 19 16.5 14" {...common} />,
  };

  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <circle cx="12" cy="12" r="10" {...common} />
      <circle cx="8.5" cy="9.5" r="1" fill={c} stroke="none" />
      <circle cx="15.5" cy="9.5" r="1" fill={c} stroke="none" />
      {mouths[value]}
    </svg>
  );
}

export function EnergyIcon({ value, size = 18 }: { value: number; size?: number }) {
  const colors = ['#7FAABC', '#7FAABC', '#b8a878', '#e8c47a', '#c45a4a'];
  const c = colors[value - 1] ?? colors[2];
  const common = { fill: 'none', stroke: c, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  if (value === 1) {
    // Crescent moon
    return (
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <path d="M 16 4 A 9 9 0 1 0 16 20 A 7 7 0 0 1 16 4 Z" {...common} />
      </svg>
    );
  }
  if (value === 2) {
    // Half/rising sun
    return (
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <path d="M 4 16 A 8 8 0 0 1 20 16" {...common} />
        <line x1="12" y1="4" x2="12" y2="6" {...common} />
        <line x1="5" y1="7" x2="6.5" y2="8.5" {...common} />
        <line x1="19" y1="7" x2="17.5" y2="8.5" {...common} />
        <line x1="2" y1="16" x2="22" y2="16" {...common} />
      </svg>
    );
  }
  if (value === 3) {
    // Full sun with rays
    return (
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <circle cx="12" cy="12" r="5" {...common} />
        <line x1="12" y1="2" x2="12" y2="5" {...common} />
        <line x1="12" y1="19" x2="12" y2="22" {...common} />
        <line x1="2" y1="12" x2="5" y2="12" {...common} />
        <line x1="19" y1="12" x2="22" y2="12" {...common} />
        <line x1="4.93" y1="4.93" x2="6.87" y2="6.87" {...common} />
        <line x1="17.13" y1="17.13" x2="19.07" y2="19.07" {...common} />
        <line x1="4.93" y1="19.07" x2="6.87" y2="17.13" {...common} />
        <line x1="17.13" y1="6.87" x2="19.07" y2="4.93" {...common} />
      </svg>
    );
  }
  if (value === 4) {
    // Lightning bolt
    return (
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <polygon points="13,2 4,14 11,14 10,22 20,10 13,10" {...common} />
      </svg>
    );
  }
  // value === 5: Flame
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <path d="M12 2 C12 2 5 10 5 15 A7 7 0 0 0 19 15 C19 10 12 2 12 2 Z" fill={c} fillOpacity={0.3} stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 22 C12 22 9 18 9 16 A3 3 0 0 1 15 16 C15 18 12 22 12 22 Z" fill={c} fillOpacity={0.5} stroke="none" />
    </svg>
  );
}

/* ── Active background colours per value ── */
const ACTIVE_BG = [
  'rgba(196, 90, 74, 0.18)',   // val 1
  'rgba(180, 112, 80, 0.18)',  // val 2
  'rgba(184, 168, 120, 0.18)', // val 3
  'rgba(212, 160, 74, 0.18)',  // val 4
  'rgba(232, 196, 122, 0.18)', // val 5
];

const ACTIVE_BORDER = ['#c45a4a', '#b47050', '#b8a878', '#d4a04a', '#e8c47a'];

/* ── Card ── */

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
};

interface Props {
  open: boolean;
  onToggle: () => void;
  date: string;
}

type SaveState = 'idle' | 'saving' | 'confirmed';

export default function MoodEnergyCard({ open, onToggle, date }: Props) {
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Load existing log for the selected date
  useEffect(() => {
    setMood(null);
    setEnergy(null);
    setSaveState('idle');
    apiFetch<Array<{ mood: number; energy: number }>>(`/api/mood?start_date=${date}&end_date=${date}`)
      .then(data => {
        if (data.length > 0) {
          setMood(data[0].mood);
          setEnergy(data[0].energy);
          setSaveState('confirmed');
        }
      })
      .catch(() => {});
  }, [date]);

  const canSave = mood !== null && energy !== null && saveState !== 'saving';

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaveState('saving');
    try {
      await apiFetch('/api/log/mood', {
        method: 'POST',
        body: JSON.stringify({ mood, energy, logged_at: `${date}T12:00:00+10:00` }),
      });
      setSaveState('confirmed');
    } catch {
      setSaveState('idle');
    }
  }, [mood, energy, canSave, date]);

  const headerLabel = saveState === 'confirmed' && mood !== null && energy !== null
    ? `Mood ${mood} · Energy ${energy}`
    : '';

  function renderRow(
    label: string,
    selected: number | null,
    onSelect: (v: number) => void,
    renderIcon: (val: number) => ReactNode,
  ) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        <span className="label-text" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {[1, 2, 3, 4, 5].map(val => {
            const active = selected === val;
            return (
              <button
                key={val}
                onClick={() => onSelect(val)}
                style={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${active ? ACTIVE_BORDER[val - 1] : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-sm)',
                  background: active ? ACTIVE_BG[val - 1] : 'transparent',
                  cursor: 'pointer',
                  transform: active ? 'scale(1.12)' : 'none',
                  opacity: active ? 1 : 0.45,
                  transition: 'all 0.15s',
                  padding: 0,
                }}
              >
                {renderIcon(val)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

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
          <MoodIcon value={4} size={16} />
          <span className="section-head" style={{ color: 'var(--text-primary)' }}>Mood & Energy</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {headerLabel && (
            <span className="label-text" style={{ color: 'var(--text-secondary)' }}>{headerLabel}</span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div style={{ padding: 'var(--space-md) var(--space-lg) var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

          {saveState === 'confirmed' ? (
            /* Confirmed state */
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <Check size={16} color="var(--ochre)" />
              <span className="label-text" style={{ color: 'var(--text-secondary)' }}>
                Logged — Mood {mood}/5 · Energy {energy}/5
              </span>
              <button
                onClick={() => setSaveState('idle')}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Edit
              </button>
            </div>
          ) : (
            <>
              {/* 2-col icon grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                {renderRow('MOOD', mood, setMood, (v) => <MoodIcon value={v} />)}
                {renderRow('ENERGY', energy, setEnergy, (v) => <EnergyIcon value={v} />)}
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={!canSave}
                style={{
                  alignSelf: 'flex-end',
                  padding: '8px 24px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: canSave ? 'var(--ochre)' : 'var(--bg-elevated)',
                  color: canSave ? '#fff' : 'var(--text-muted)',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: canSave ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                }}
              >
                {saveState === 'saving' ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
