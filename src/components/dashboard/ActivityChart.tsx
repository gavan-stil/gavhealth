import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import type { ActivityFeedItem } from '@/hooks/useDashboardV2';

interface Props {
  data: ActivityFeedItem[] | null;
  loading: boolean;
}

const TYPE_COLOR: Record<string, string> = {
  run: 'var(--sand)',
  strength: 'var(--rust)',
  workout: 'var(--rust)',
  ride: 'var(--dawn)',
  sauna: 'var(--ember)',
};

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${day} ${d.getDate()}`;
}

export default function ActivityChart({ data, loading }: Props) {
  const chartData = useMemo(() => {
    if (!data) return [];
    // Get last 14 days
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString('en-CA'));
    }
    return days.map(date => {
      const dayItems = data.filter(a => a.date === date);
      const run = dayItems.filter(a => a.type === 'run').length;
      const strength = dayItems.filter(a => a.type === 'strength' || a.type === 'workout').length;
      const ride = dayItems.filter(a => a.type === 'ride').length;
      const sauna = dayItems.filter(a => a.type === 'sauna').length;
      return { date, label: formatDayLabel(date), run, strength, ride, sauna };
    });
  }, [data]);

  return (
    <div className="goe-card" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-lg)',
    }}>
      <span className="label-text" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 'var(--space-md)' }}>
        ACTIVITY (14 DAYS)
      </span>

      {loading ? (
        <div style={{ height: 160, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', opacity: 0.5 }} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 400 }}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barSize={12} barGap={2} barCategoryGap="30%">
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
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
                />
                <Bar dataKey="run" name="Run" stackId="a" fill={TYPE_COLOR.run} radius={[0, 0, 0, 0]} />
                <Bar dataKey="strength" name="Strength" stackId="a" fill={TYPE_COLOR.strength} radius={[0, 0, 0, 0]} />
                <Bar dataKey="ride" name="Ride" stackId="a" fill={TYPE_COLOR.ride} radius={[0, 0, 0, 0]} />
                <Bar dataKey="sauna" name="Sauna" stackId="a" fill={TYPE_COLOR.sauna} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-sm)', flexWrap: 'wrap' }}>
        {Object.entries({ Run: TYPE_COLOR.run, Strength: TYPE_COLOR.strength, Ride: TYPE_COLOR.ride, Sauna: TYPE_COLOR.sauna }).map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span className="label-text" style={{ color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
