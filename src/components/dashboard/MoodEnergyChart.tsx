import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import type { MoodEntry } from '@/hooks/useDashboardV2';

interface Props {
  data: MoodEntry[] | null;
  loading: boolean;
}

function formatLabel(isoStr: string): string {
  const d = new Date(isoStr.split('T')[0] + 'T00:00:00');
  return `${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getDate()}`;
}

export default function MoodEnergyChart({ data, loading }: Props) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data]
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
      .map(d => ({
        label: formatLabel(d.logged_at),
        mood: d.mood,
        energy: d.energy,
      }));
  }, [data]);

  const isEmpty = !loading && chartData.length === 0;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-lg)',
    }}>
      <span className="label-text" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 'var(--space-md)' }}>
        MOOD & ENERGY (30 DAYS)
      </span>

      {loading ? (
        <div style={{ height: 160, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', opacity: 0.5 }} />
      ) : isEmpty ? (
        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="label-text" style={{ color: 'var(--text-muted)' }}>No mood data yet</span>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 300 }}>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[1, 5]}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={20}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--text-primary)',
                  }}
                  cursor={{ stroke: 'var(--border-default)' }}
                />
                <Line
                  type="monotone"
                  dataKey="mood"
                  stroke="var(--ochre)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--ochre)', strokeWidth: 0 }}
                  name="Mood"
                />
                <Line
                  type="monotone"
                  dataKey="energy"
                  stroke="var(--gold)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--gold)', strokeWidth: 0 }}
                  name="Energy"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!loading && !isEmpty && (
        <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 2, background: 'var(--ochre)', borderRadius: 1 }} />
            <span className="label-text" style={{ color: 'var(--text-muted)' }}>Mood</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 2, background: 'var(--gold)', borderRadius: 1 }} />
            <span className="label-text" style={{ color: 'var(--text-muted)' }}>Energy</span>
          </div>
        </div>
      )}
    </div>
  );
}
