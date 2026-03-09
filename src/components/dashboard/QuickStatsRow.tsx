import { useNavigate } from 'react-router-dom';
import { MoodIcon, EnergyIcon } from '@/components/log/MoodEnergyCard';
import type { TodayStats, MoodEntry } from '@/hooks/useDashboardV2';

const WATER_TARGET = 3000; // ml
const KCAL_TARGET = 2500;

/* ── Tiny 7-day sparkline ── */

function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return null;
  const w = 60;
  const h = 20;
  const padY = 2;
  const range = 4; // 1-5 scale
  const step = w / (values.length - 1);

  const points = values
    .map((v, i) => {
      if (v === null) return null;
      const x = i * step;
      const y = padY + ((5 - v) / range) * (h - padY * 2);
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(' ');

  return (
    <svg width={w} height={h} style={{ display: 'block', marginTop: 2 }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </svg>
  );
}

function MoodSparkline({ entries }: { entries: MoodEntry[] }) {
  if (entries.length < 2) return null;
  const last7 = entries.slice(0, 7).reverse();
  return <Sparkline values={last7.map(e => e.mood)} color="var(--ochre)" />;
}

function EnergySparkline({ entries }: { entries: MoodEntry[] }) {
  if (entries.length < 2) return null;
  const last7 = entries.slice(0, 7).reverse();
  return <Sparkline values={last7.map(e => e.energy)} color="var(--ochre)" />;
}

/* ── Progress bar (thin horizontal) ── */

function ProgressBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = Math.min(value / target, 1);
  return (
    <div style={{
      width: '100%',
      height: 4,
      borderRadius: 2,
      background: 'var(--border-default)',
      marginTop: 4,
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct * 100}%`,
        height: '100%',
        borderRadius: 2,
        background: color,
        transition: 'width 0.3s',
      }} />
    </div>
  );
}

/* ── Tile ── */

function Tile({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 'var(--space-xs)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/* ── Main component ── */

interface Props {
  stats: TodayStats;
  moodEntries?: MoodEntry[] | null;
}

export default function QuickStatsRow({ stats, moodEntries }: Props) {
  const navigate = useNavigate();
  const goLog = () => navigate('/log');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
      {/* Mood */}
      <Tile
        icon={stats.mood !== null ? <MoodIcon value={stats.mood} size={22} /> : <MoodIcon value={3} size={22} />}
        onClick={goLog}
      >
        <span className="stat-number" style={{ color: 'var(--ochre)', fontSize: 18 }}>
          {stats.mood !== null ? `${stats.mood}/5` : '—'}
        </span>
        {moodEntries && moodEntries.length >= 2 && <MoodSparkline entries={moodEntries} />}
        <span className="label-text" style={{ color: 'var(--text-muted)' }}>Mood</span>
      </Tile>

      {/* Energy */}
      <Tile
        icon={stats.energy !== null ? <EnergyIcon value={stats.energy} size={22} /> : <EnergyIcon value={3} size={22} />}
        onClick={goLog}
      >
        <span className="stat-number" style={{ color: 'var(--ochre)', fontSize: 18 }}>
          {stats.energy !== null ? `${stats.energy}/5` : '—'}
        </span>
        {moodEntries && moodEntries.length >= 2 && <EnergySparkline entries={moodEntries} />}
        <span className="label-text" style={{ color: 'var(--text-muted)' }}>Energy</span>
      </Tile>

      {/* Water */}
      <Tile
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2C8 2 3 7.5 3 10.5C3 13.0 5.24 15 8 15C10.76 15 13 13.0 13 10.5C13 7.5 8 2 8 2Z"
              fill="var(--dawn)" opacity="0.8" />
          </svg>
        }
        onClick={goLog}
      >
        <span className="stat-number" style={{ color: 'var(--ochre)', fontSize: 18 }}>
          {stats.water_ml > 0 ? `${(stats.water_ml / 1000).toFixed(1)}L` : '—'}
        </span>
        {stats.water_ml > 0 && (
          <>
            <span className="label-text" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              / {(WATER_TARGET / 1000).toFixed(1)}L
            </span>
            <ProgressBar value={stats.water_ml} target={WATER_TARGET} color="var(--dawn)" />
          </>
        )}
        <span className="label-text" style={{ color: 'var(--text-muted)' }}>Water</span>
      </Tile>

      {/* Calories */}
      <Tile
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ochre)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
            <path d="M7 2v20" />
            <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
          </svg>
        }
        onClick={goLog}
      >
        <span className="stat-number" style={{ color: 'var(--ochre)', fontSize: 18 }}>
          {stats.calories_kcal > 0 ? `${Math.round(stats.calories_kcal)}` : '—'}
        </span>
        {stats.calories_kcal > 0 && (
          <>
            <span className="label-text" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              / {KCAL_TARGET} kcal
            </span>
            <ProgressBar value={stats.calories_kcal} target={KCAL_TARGET} color="var(--ochre)" />
          </>
        )}
        <span className="label-text" style={{ color: 'var(--text-muted)' }}>Calories</span>
      </Tile>
    </div>
  );
}
