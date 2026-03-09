import { useMemo } from 'react';
import {
  ComposedChart, Bar, ReferenceLine, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import type { FoodEntry } from '@/hooks/useDashboardV2';

const PROTEIN_TARGET = 180; // g
const KCAL_TARGET = 2358;

interface Props {
  foodData: FoodEntry[] | null;
  loading: boolean;
}

function formatLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getDate()}`;
}

function aggregateByDay(data: FoodEntry[]): Map<string, { protein_g: number; calories_kcal: number }> {
  const map = new Map<string, { protein_g: number; calories_kcal: number }>();
  for (const entry of data) {
    const existing = map.get(entry.log_date) ?? { protein_g: 0, calories_kcal: 0 };
    map.set(entry.log_date, {
      protein_g: existing.protein_g + entry.protein_g,
      calories_kcal: existing.calories_kcal + entry.calories_kcal,
    });
  }
  return map;
}

interface MiniChartProps {
  data: { label: string; value: number }[];
  target: number;
  color: string;
  unit: string;
  formatter: (v: number) => string;
}

function MiniChart({ data, target, color, unit, formatter }: MiniChartProps) {
  const maxVal = Math.max(target * 1.2, ...data.map(d => d.value));
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: Math.max(300, data.length * 28) }}>
        <ResponsiveContainer width="100%" height={110}>
          <ComposedChart data={data} barSize={14} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, maxVal]}
              tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={28}
              tickFormatter={(v: number) => unit === 'kcal' ? `${Math.round(v / 100) * 100}` : `${v}g`}
              tickCount={3}
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
              formatter={(v: any) => [formatter(v as number), unit === 'kcal' ? 'Calories' : 'Protein']}
            />
            <ReferenceLine
              y={target}
              stroke="var(--border-default)"
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
            <Bar
              dataKey="value"
              fill={color}
              opacity={0.85}
              radius={[2, 2, 0, 0]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              style={{ fill: color } as any}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function NutritionTargetChart({ foodData, loading }: Props) {
  const { proteinData, kcalData } = useMemo(() => {
    if (!foodData || foodData.length === 0) return { proteinData: [], kcalData: [] };

    const byDay = aggregateByDay(foodData);
    const sortedDates = [...byDay.keys()].sort();

    const proteinData = sortedDates.map(date => ({
      label: formatLabel(date),
      value: Math.round(byDay.get(date)!.protein_g),
    }));

    const kcalData = sortedDates.map(date => ({
      label: formatLabel(date),
      value: Math.round(byDay.get(date)!.calories_kcal),
    }));

    return { proteinData, kcalData };
  }, [foodData]);

  const hasData = proteinData.length > 0;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-lg)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)',
    }}>
      <span className="label-text" style={{ color: 'var(--text-muted)', display: 'block' }}>
        NUTRITION TARGETS (14 DAYS)
      </span>

      {loading ? (
        <div style={{ height: 260, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', opacity: 0.5 }} />
      ) : !hasData ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="label-text" style={{ color: 'var(--text-muted)' }}>No nutrition data yet</span>
        </div>
      ) : (
        <>
          {/* Protein */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="label-text" style={{ color: 'var(--text-muted)' }}>PROTEIN</span>
              <span className="label-text" style={{ color: 'var(--text-muted)' }}>target {PROTEIN_TARGET}g</span>
            </div>
            <MiniChart
              data={proteinData}
              target={PROTEIN_TARGET}
              color="var(--ochre)"
              unit="g"
              formatter={(v) => `${v}g`}
            />
          </div>

          {/* Calories */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="label-text" style={{ color: 'var(--text-muted)' }}>CALORIES</span>
              <span className="label-text" style={{ color: 'var(--text-muted)' }}>target {KCAL_TARGET.toLocaleString()} kcal</span>
            </div>
            <MiniChart
              data={kcalData}
              target={KCAL_TARGET}
              color="var(--dawn)"
              unit="kcal"
              formatter={(v) => `${v.toLocaleString()} kcal`}
            />
          </div>
        </>
      )}
    </div>
  );
}
