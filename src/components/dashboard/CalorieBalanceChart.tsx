import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts';
import type { RawActivityEntry, FoodEntry } from '@/hooks/useDashboardV2';

interface Props {
  activityData: RawActivityEntry[] | null;
  foodData: FoodEntry[] | null;
  loading: boolean;
}

/** Convert Withings kJ→kcal when value exceeds 8000 (matches backend logic). */
function toKcal(raw: number): number {
  return raw > 8000 ? Math.round(raw / 4.184) : raw;
}

function fmtDate(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return `${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getDate()}`;
}

export default function CalorieBalanceChart({ activityData, foodData, loading }: Props) {
  const chartData = useMemo(() => {
    // Build last 14 days array
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString('en-CA'));
    }

    // calories burned per day from daily_summary rows (kJ→kcal converted)
    const burnedByDate: Record<string, number> = {};
    if (activityData) {
      for (const a of activityData) {
        if (
          a.activity_type === 'daily_summary' &&
          a.calories_burned !== null
        ) {
          const kcal = toKcal(a.calories_burned);
          if (kcal <= 5000) burnedByDate[a.activity_date] = kcal;
        }
      }
    }

    // calories consumed per day from food logs
    const consumedByDate: Record<string, number> = {};
    if (foodData) {
      for (const f of foodData) {
        consumedByDate[f.log_date] = (consumedByDate[f.log_date] ?? 0) + f.calories_kcal;
      }
    }

    return days.map(date => ({
      label: fmtDate(date),
      burned: burnedByDate[date] ?? null,
      consumed: consumedByDate[date] ?? null,
    }));
  }, [activityData, foodData]);

  const hasData = chartData.some(d => d.burned !== null || d.consumed !== null);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-lg)',
    }}>
      <span className="label-text" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 'var(--space-md)' }}>
        CALORIES: BURNED vs CONSUMED (14 DAYS)
      </span>

      {loading ? (
        <div style={{ height: 160, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', opacity: 0.5 }} />
      ) : !hasData ? (
        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="label-text" style={{ color: 'var(--text-muted)' }}>No calorie data yet</span>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 300 }}>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={chartData} barGap={2}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--text-primary)',
                  }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  formatter={(value: number | undefined, name: string | undefined) => [value != null ? `${Math.round(value)} kcal` : '—', name ?? '']}
                />
                <ReferenceLine y={0} stroke="var(--border-default)" />
                <Bar dataKey="burned" name="Burned" fill="var(--clay)" radius={[2, 2, 0, 0]} maxBarSize={18} />
                <Bar dataKey="consumed" name="Consumed" fill="var(--ochre)" radius={[2, 2, 0, 0]} maxBarSize={18} />
                <Line
                  type="monotone"
                  dataKey="burned"
                  stroke="var(--clay)"
                  strokeWidth={0}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!loading && hasData && (
        <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, background: 'var(--clay)', borderRadius: 2 }} />
            <span className="label-text" style={{ color: 'var(--text-muted)' }}>Burned (Withings)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, background: 'var(--ochre)', borderRadius: 2 }} />
            <span className="label-text" style={{ color: 'var(--text-muted)' }}>Consumed (logged)</span>
          </div>
        </div>
      )}
    </div>
  );
}
