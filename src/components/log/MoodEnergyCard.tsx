import { useState, useEffect, useCallback } from 'react';
import { Smile, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const MOOD_EMOJI = ['😞', '😕', '😐', '🙂', '😄'];
const ENERGY_EMOJI = ['🪫', '😴', '⚡', '🔥', '💥'];

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
};

interface Props {
  open: boolean;
  onToggle: () => void;
}

type SaveState = 'idle' | 'saving' | 'confirmed';

export default function MoodEnergyCard({ open, onToggle }: Props) {
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Load today's existing log on mount
  useEffect(() => {
    apiFetch<Array<{ mood: number; energy: number }>>('/api/mood?days=1')
      .then(data => {
        if (data.length > 0) {
          setMood(data[0].mood);
          setEnergy(data[0].energy);
          setSaveState('confirmed');
        }
      })
      .catch(() => {});
  }, []);

  const canSave = mood !== null && energy !== null && saveState !== 'saving';

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaveState('saving');
    try {
      await apiFetch('/api/log/mood', {
        method: 'POST',
        body: JSON.stringify({ mood, energy }),
      });
      setSaveState('confirmed');
    } catch {
      setSaveState('idle');
    }
  }, [mood, energy, canSave]);

  const headerLabel = saveState === 'confirmed' && mood !== null && energy !== null
    ? `${MOOD_EMOJI[mood - 1]} ${ENERGY_EMOJI[energy - 1]}`
    : '';

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
          <Smile size={16} color="var(--ochre)" />
          <span className="section-head" style={{ color: 'var(--text-primary)' }}>Mood & Energy</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {headerLabel && (
            <span style={{ fontSize: 16 }}>{headerLabel}</span>
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
                Logged today — Mood {mood}/5 · Energy {energy}/5
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
              {/* 2-col emoji grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                {/* Mood column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                  <span className="label-text" style={{ color: 'var(--text-muted)' }}>MOOD</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {MOOD_EMOJI.map((emoji, i) => {
                      const val = i + 1;
                      const active = mood === val;
                      return (
                        <button
                          key={val}
                          onClick={() => setMood(val)}
                          style={{
                            width: 40,
                            height: 40,
                            fontSize: 20,
                            border: `1px solid ${active ? 'var(--ochre)' : 'var(--border-default)'}`,
                            borderRadius: 'var(--radius-sm)',
                            background: 'transparent',
                            cursor: 'pointer',
                            transform: active ? 'scale(1.15)' : 'none',
                            opacity: active ? 1 : 0.45,
                            transition: 'all 0.15s',
                            padding: 0,
                          }}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Energy column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                  <span className="label-text" style={{ color: 'var(--text-muted)' }}>ENERGY</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {ENERGY_EMOJI.map((emoji, i) => {
                      const val = i + 1;
                      const active = energy === val;
                      return (
                        <button
                          key={val}
                          onClick={() => setEnergy(val)}
                          style={{
                            width: 40,
                            height: 40,
                            fontSize: 20,
                            border: `1px solid ${active ? 'var(--ochre)' : 'var(--border-default)'}`,
                            borderRadius: 'var(--radius-sm)',
                            background: 'transparent',
                            cursor: 'pointer',
                            transform: active ? 'scale(1.15)' : 'none',
                            opacity: active ? 1 : 0.45,
                            transition: 'all 0.15s',
                            padding: 0,
                          }}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
