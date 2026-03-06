import { useState, useEffect } from 'react';
import { BarChart2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const CALORIE_TARGET = 2358;

interface FoodEntry {
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Totals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

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

function MacroBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="label-text" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="small-number" style={{ color: 'var(--text-secondary)' }}>{Math.round(value)}g</span>
      </div>
      <div style={{
        height: 6,
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-pill)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 'var(--radius-pill)',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

export default function NutritionCard({ open, onToggle }: Props) {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToday = () => {
    setLoading(true);
    setError(null);
    const today = new Date().toISOString().split('T')[0];
    apiFetch<FoodEntry[]>(`/api/food?date=${today}`)
      .then(entries => {
        const t = entries.reduce(
          (acc, e) => ({
            kcal: acc.kcal + e.calories_kcal,
            protein_g: acc.protein_g + e.protein_g,
            carbs_g: acc.carbs_g + e.carbs_g,
            fat_g: acc.fat_g + e.fat_g,
          }),
          { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        );
        setTotals(t);
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchToday(); }, []);

  const caloriePct = totals ? Math.min(100, Math.round((totals.kcal / CALORIE_TARGET) * 100)) : 0;

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
          <BarChart2 size={16} color="var(--gold)" />
          <span className="section-head" style={{ color: 'var(--text-primary)' }}>Today's Nutrition</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {!loading && totals && (
            <span className="small-number" style={{ color: 'var(--gold)' }}>
              {Math.round(totals.kcal)} kcal
            </span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div style={{ padding: 'var(--space-md) var(--space-lg) var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

          {loading ? (
            <div style={{ height: 80, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', opacity: 0.5 }} />
          ) : error ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <span className="label-text" style={{ color: 'var(--signal-poor)' }}>Failed to load</span>
              <button
                onClick={fetchToday}
                style={{ background: 'none', border: 'none', color: 'var(--ochre)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Retry
              </button>
            </div>
          ) : totals && totals.kcal === 0 ? (
            <span className="label-text" style={{ color: 'var(--text-muted)' }}>
              No food logged yet — use Food Log above
            </span>
          ) : totals ? (
            <>
              {/* Calorie total */}
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span className="stat-number" style={{ color: 'var(--ochre)' }}>
                    {Math.round(totals.kcal).toLocaleString()}
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>kcal</span>
                  <span className="label-text" style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                    of {CALORIE_TARGET.toLocaleString()} target
                  </span>
                </div>
                {/* Calorie progress bar */}
                <div style={{
                  marginTop: 6,
                  height: 8,
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-pill)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${caloriePct}%`,
                    background: `linear-gradient(90deg, var(--signal-good), var(--ochre))`,
                    borderRadius: 'var(--radius-pill)',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>

              {/* Macro bars */}
              <MacroBar label="PROTEIN" value={totals.protein_g} max={150} color="var(--ochre)" />
              <MacroBar label="CARBS" value={totals.carbs_g} max={250} color="var(--gold)" />
              <MacroBar label="FAT" value={totals.fat_g} max={80} color="var(--rust)" />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
