import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import type { WaterEntry, FoodEntry } from '@/hooks/useDashboardV2';

interface Props {
  waterData: WaterEntry[] | null;
  foodData: FoodEntry[] | null;
  loading: boolean;
}

const toLocalDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

function formatLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getDate()}`;
}

export default function WaterNutritionChart({ waterData, foodData, loading }: Props) {
  const chartData = useMemo(() => {
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString('en-CA'));
    }
    return days.map(date => {
      const waterMl = waterData
        ? waterData.filter(w => toLocalDate(w.logged_at) === date).reduce((sum, w) => sum + w.ml, 0)
        : 0;
      const kcal = foodData
        ? foodData.filter(f => f.log_date === date).reduce((sum, f) => sum + f.calories_kcal, 0)
        : 0;
      return { date, label: formatLabel(date), water_ml: waterMl || null, kcal: kcal || null };
    });
  }, [waterData, foodData]);

  const hasData = chartData.some(d => d.water_ml || d.kcal);

  return (
    <div className="goe-card" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-lg)',
    }}>
      <span className="label-text" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 'var(--space-md)' }}>
        WATER & CALORIES (14 DAYS)
      </span>

      {loading ? (
        <div style={{ height: 160, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', opacity: 0.5 }} />
      ) : !hasData ? (
        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="label-text" style={{ color: 'var(--text-muted)' }}>No data yet</span>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 400 }}>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={chartData} barSize={12}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="water"
                  orientation="left"
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}L`}
                />
                <YAxis
                  yAxisId="kcal"
                  orientation="right"
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) =>
                    name === 'Water' ? [`${value}ml`, 'Water'] : [`${Math.round(value)} kcal`, 'Calories']
                  }
                />
                <Bar
                  yAxisId="water"
                  dataKey="water_ml"
                  name="Water"
                  fill="var(--dawn)"
                  opacity={0.8}
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  yAxisId="kcal"
                  type="monotone"
                  dataKey="kcal"
                  name="Calories"
                  stroke="var(--ochre)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--ochre)', strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {hasData && (
        <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--dawn)' }} />
            <span className="label-text" style={{ color: 'var(--text-muted)' }}>Water</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 2, background: 'var(--ochre)', borderRadius: 1 }} />
            <span className="label-text" style={{ color: 'var(--text-muted)' }}>Calories</span>
          </div>
        </div>
      )}
    </div>
  );
}
