import { useState } from 'react';
import { UtensilsCrossed, Check, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type FoodState = 'empty' | 'parsing' | 'parsed' | 'confirming' | 'confirmed' | 'error';

type ParsedItem = { name: string; protein_g: number; carbs_g: number; fat_g: number; calories_kcal: number };
type ParsedFood = {
  description_raw: string;
  meal_label: string;
  log_date: string;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  calories_kcal: number;
  confidence: string;
  items: ParsedItem[];
};

export default function FoodCard({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [state, setState] = useState<FoodState>('empty');
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedFood | null>(null);

  const handleParse = async () => {
    setState('parsing');
    try {
      const res = await apiFetch<ParsedFood>('/api/log/food', {
        method: 'POST',
        body: JSON.stringify({ description: input }),
      });
      setParsed(res);
      setState('parsed');
    } catch {
      setState('error');
    }
  };

  const handleConfirm = async () => {
    if (!parsed) return;
    setState('confirming');
    try {
      await apiFetch('/api/log/food/confirm', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      setState('confirmed');
      setTimeout(() => {
        setState('empty');
        setInput('');
        setParsed(null);
      }, 2000);
    } catch {
      setState('error');
    }
  };

  const handleEdit = () => {
    setState('empty');
    setParsed(null);
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
        <UtensilsCrossed size={18} color="var(--gold)" />
        <span style={{ font: '700 16px/1.2 Inter, sans-serif', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
          Food
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 var(--space-lg) var(--space-lg)' }}>
          {state === 'confirmed' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--signal-good)' }}>
              <Check size={18} />
              <span style={{ font: '600 14px/1 Inter, sans-serif' }}>Logged!</span>
            </div>
          ) : (state === 'parsed' || state === 'confirming') && parsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', opacity: state === 'confirming' ? 0.5 : 1, pointerEvents: state === 'confirming' ? 'none' : 'auto' }}>
              {/* Meal label */}
              {parsed.meal_label && (
                <span style={{ font: '600 10px/1 Inter, sans-serif', letterSpacing: '1.2px', textTransform: 'uppercase' as const, color: 'var(--text-muted)' }}>
                  {parsed.meal_label}
                </span>
              )}

              {/* Item breakdown */}
              {parsed.items.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: 'var(--space-sm) 0',
                  borderBottom: i < parsed.items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <span style={{ font: '400 14px/1.5 Inter, sans-serif', color: 'var(--text-primary)', flex: 1, marginRight: 'var(--space-sm)' }}>
                    {item.name}
                  </span>
                  <span style={{ font: '600 13px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {item.calories_kcal} cal
                  </span>
                </div>
              ))}

              {/* Total calories */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)', paddingTop: 'var(--space-sm)' }}>
                <span style={{ font: '800 28px/1 JetBrains Mono, monospace', letterSpacing: '-1.5px', color: 'var(--ochre)' }}>
                  {parsed.calories_kcal}
                </span>
                <span style={{ font: '600 10px/1 Inter, sans-serif', letterSpacing: '1.2px', textTransform: 'uppercase' as const, color: 'var(--text-muted)' }}>
                  cal total
                </span>
              </div>

              {/* Macro row: P / C / F */}
              <div style={{ display: 'flex', gap: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span style={{ font: '700 16px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>{parsed.protein_g}g</span>
                  <span style={{ font: '600 10px/1 Inter, sans-serif', letterSpacing: '1px', textTransform: 'uppercase' as const, color: 'var(--text-muted)' }}>protein</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span style={{ font: '700 16px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>{parsed.carbs_g}g</span>
                  <span style={{ font: '600 10px/1 Inter, sans-serif', letterSpacing: '1px', textTransform: 'uppercase' as const, color: 'var(--text-muted)' }}>carbs</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span style={{ font: '700 16px/1 JetBrains Mono, monospace', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>{parsed.fat_g}g</span>
                  <span style={{ font: '600 10px/1 Inter, sans-serif', letterSpacing: '1px', textTransform: 'uppercase' as const, color: 'var(--text-muted)' }}>fat</span>
                </div>
              </div>

              {/* Confirm / Edit buttons */}
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button
                  onClick={handleConfirm}
                  style={{
                    flex: 1, padding: 'var(--space-sm) var(--space-lg)',
                    background: 'var(--ochre)', color: 'var(--bg-base)',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    font: '600 14px/1 Inter, sans-serif', cursor: 'pointer',
                  }}
                >
                  {state === 'confirming' ? 'Saving…' : 'Confirm'}
                </button>
                <button
                  onClick={handleEdit}
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
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <textarea
                placeholder="e.g. chicken breast 200g, rice 150g"
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={state === 'parsing' || state === 'confirming'}
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
                onClick={handleParse}
                disabled={state === 'parsing' || !input.trim()}
                style={{
                  padding: 'var(--space-sm) var(--space-lg)',
                  background: 'var(--ochre)', color: 'var(--bg-base)',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  font: '600 14px/1 Inter, sans-serif', cursor: 'pointer',
                  opacity: (state === 'parsing' || !input.trim()) ? 0.4 : 1,
                  ...(state === 'parsing' ? { animation: 'pulse 1.5s infinite' } : {}),
                }}
              >
                {state === 'parsing' ? 'Parsing…' : 'Parse'}
              </button>
              {state === 'error' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--ember)' }}>
                  <AlertCircle size={14} />
                  <span style={{ font: '400 13px/1 Inter, sans-serif' }}>
                    Could not parse food entry
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
