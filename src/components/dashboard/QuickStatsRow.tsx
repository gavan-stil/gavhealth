import { Smile, Zap, UtensilsCrossed } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TodayStats } from '@/hooks/useDashboardV2';

const MOOD_EMOJI = ['😞', '😕', '😐', '🙂', '😄'];
const ENERGY_EMOJI = ['🪫', '😴', '⚡', '🔥', '💥'];

interface Props {
  stats: TodayStats;
}

function Tile({
  icon,
  value,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
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
      <span className="stat-number" style={{ color: 'var(--ochre)', fontSize: 22 }}>{value}</span>
      <span className="label-text" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </button>
  );
}

export default function QuickStatsRow({ stats }: Props) {
  const navigate = useNavigate();
  const goLog = () => navigate('/log');

  const moodLabel = stats.mood !== null ? (MOOD_EMOJI[stats.mood - 1] ?? '—') : '—';
  const energyLabel = stats.energy !== null ? (ENERGY_EMOJI[stats.energy - 1] ?? '—') : '—';
  const waterLabel = stats.water_ml > 0 ? `${(stats.water_ml / 1000).toFixed(1)}L` : '—';
  const kcalLabel = stats.calories_kcal > 0 ? `${Math.round(stats.calories_kcal)}` : '—';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-sm)',
    }}>
      <Tile icon={<Smile size={16} color="var(--ochre)" />} value={moodLabel} label="Mood" onClick={goLog} />
      <Tile icon={<Zap size={16} color="var(--ochre)" />} value={energyLabel} label="Energy" onClick={goLog} />
      <Tile
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2C8 2 3 7.5 3 10.5C3 13.0 5.24 15 8 15C10.76 15 13 13.0 13 10.5C13 7.5 8 2 8 2Z"
              fill="var(--dawn)" opacity="0.8" />
          </svg>
        }
        value={waterLabel}
        label="Water"
        onClick={goLog}
      />
      <Tile icon={<UtensilsCrossed size={16} color="var(--ochre)" />} value={kcalLabel} label="Calories" onClick={goLog} />
    </div>
  );
}
