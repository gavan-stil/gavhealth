import { useState } from 'react';
import { Thermometer, Check, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type SaunaState = 'empty' | 'saving' | 'confirmed' | 'error';

export default function SaunaCard({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [state, setState] = useState<SaunaState>('empty');
  const [duration, setDuration] = useState('');
  const [temperature, setTemperature] = useState('');
  const [hasDevotion, setHasDevotion] = useState(false);
  const [hasBreathing, setHasBreathing] = useState(false);

  const handleSubmit = async () => {
    setState('saving');
    try {
      await apiFetch('/api/log/sauna', {
        method: 'POST',
        body: JSON.stringify({
          session_datetime: new Date().toLocaleString('sv', { timeZone: 'Australia/Brisbane' }).replace(' ', 'T') + '+10:00',
          duration_mins: Number(duration),
          ...(temperature ? { temperature_c: Number(temperature) } : {}),
          did_devotions: hasDevotion,
          did_breathing: hasBreathing,
        }),
      });
      setState('confirmed');
      setTimeout(() => {
        setState('empty');
        setDuration('');
        setTemperature('');
        setHasDevotion(false);
        setHasBreathing(false);
      }, 2000);
    } catch {
      setState('error');
    }
  };

  return (
    <div className="goe-card" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
          padding: 'var(--space-md) var(--space-lg)',
          background: 'transparent', border: 'none', cursor: 'pointer',
        }}
      >
        <Thermometer size={18} color="var(--ember)" />
        <span style={{ font: '700 16px/1.2 Inter, sans-serif', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
          Sauna
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 var(--space-lg) var(--space-lg)' }}>
          {state === 'confirmed' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--signal-good)' }}>
              <Check size={18} />
              <span style={{ font: '600 14px/1 Inter, sans-serif' }}>Logged!</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div style={{
                display: 'flex', gap: 'var(--space-md)',
                opacity: state === 'saving' ? 0.5 : 1,
                pointerEvents: state === 'saving' ? 'none' : 'auto',
              }}>
                <div style={{ flex: 1 }}>
                  <label style={{ font: '600 10px/1 Inter, sans-serif', letterSpacing: '1.2px', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    placeholder="20"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
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
                    Temp (°C)
                  </label>
                  <input
                    type="number"
                    placeholder="80"
                    value={temperature}
                    onChange={e => setTemperature(e.target.value)}
                    style={{
                      width: '100%', background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                      padding: 'var(--space-sm) var(--space-md)',
                      color: 'var(--text-primary)',
                      font: '600 14px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px',
                    }}
                  />
                </div>
              </div>

              {/* Toggles row */}
              <div style={{
                display: 'flex', gap: 'var(--space-lg)',
                opacity: state === 'saving' ? 0.5 : 1,
                pointerEvents: state === 'saving' ? 'none' : 'auto',
              }}>
                <div
                  onClick={() => setHasDevotion(!hasDevotion)}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer' }}
                >
                  <div style={{
                    width: 20, height: 20, flexShrink: 0,
                    border: `1px solid ${hasDevotion ? 'var(--ember)' : 'var(--border-default)'}`,
                    background: hasDevotion ? 'var(--ember)' : 'transparent',
                    borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {hasDevotion && <Check size={14} color="white" />}
                  </div>
                  <span style={{ font: '400 13px/1 Inter, sans-serif', color: 'var(--text-secondary)' }}>Devotions</span>
                </div>
                <div
                  onClick={() => setHasBreathing(!hasBreathing)}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer' }}
                >
                  <div style={{
                    width: 20, height: 20, flexShrink: 0,
                    border: `1px solid ${hasBreathing ? 'var(--ember)' : 'var(--border-default)'}`,
                    background: hasBreathing ? 'var(--ember)' : 'transparent',
                    borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {hasBreathing && <Check size={14} color="white" />}
                  </div>
                  <span style={{ font: '400 13px/1 Inter, sans-serif', color: 'var(--text-secondary)' }}>Breathing</span>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={state === 'saving' || !duration}
                style={{
                  padding: 'var(--space-sm) var(--space-lg)',
                  background: 'var(--ember)', color: 'var(--bg-base)',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  font: '600 14px/1 Inter, sans-serif', cursor: 'pointer',
                  opacity: (state === 'saving' || !duration) ? 0.4 : 1,
                  ...(state === 'saving' ? { animation: 'pulse 1.5s infinite' } : {}),
                }}
              >
                {state === 'saving' ? 'Saving…' : 'Log Sauna'}
              </button>

              {state === 'error' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--ember)' }}>
                  <AlertCircle size={14} />
                  <span style={{ font: '400 13px/1 Inter, sans-serif' }}>
                    Could not save sauna session
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
