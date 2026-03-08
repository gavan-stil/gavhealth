import { useEffect, useState } from 'react';

const CIRC = 2 * Math.PI * 50; // ~314.16

interface RingConfig {
  label: string;
  value: number | null;
  target: number;
  color: string;
  format: (v: number) => string;
}

/* ── Single ring with Apple Watch overflow ── */

function GoalRing({ label, value, target, color, format }: RingConfig) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const pct = value !== null ? Math.min(value / target, 2) : 0;
  const basePct = Math.min(pct, 1);
  const overflowPct = pct > 1 ? pct - 1 : 0;
  const offset = animated ? CIRC * (1 - basePct) : CIRC;
  const overflowOffset = animated ? CIRC * (1 - overflowPct) : CIRC;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={70} height={70} viewBox="0 0 120 120">
        {/* Drop shadow filter for overflow arc */}
        <defs>
          <filter id={`shadow-${label}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(0,0,0,0.6)" />
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx="60" cy="60" r="50"
          fill="none"
          stroke="var(--border-default)"
          strokeWidth="8"
        />

        {/* Base progress arc */}
        <circle
          cx="60" cy="60" r="50"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '60px 60px',
            transition: animated ? 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
          }}
        />

        {/* Overflow arc (Apple Watch wrap) */}
        {overflowPct > 0 && (
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={overflowOffset}
            opacity={0.85}
            filter={`url(#shadow-${label})`}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: '60px 60px',
              transition: animated ? 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s' : 'none',
            }}
          />
        )}

        {/* Center text */}
        <text
          x="60" y="60"
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-primary)"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
          fontSize="20"
          letterSpacing="-1"
        >
          {value !== null ? format(value) : '—'}
        </text>
      </svg>

      <span
        className="label-text"
        style={{ color: 'var(--text-muted)', fontSize: 9, letterSpacing: 1 }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Main component ── */

interface GoalRingsProps {
  sleepScore: number | null;
  steps: number | null;
  proteinG: number;
  readinessScore: number | null;
  loading?: boolean;
}

export default function GoalRingsRow({
  sleepScore,
  steps,
  proteinG,
  readinessScore,
  loading,
}: GoalRingsProps) {
  const rings: RingConfig[] = [
    {
      label: 'SLEEP',
      value: loading ? null : sleepScore,
      target: 100,
      color: 'var(--dawn)',
      format: (v) => `${Math.round(v)}`,
    },
    {
      label: 'STEPS',
      value: loading ? null : steps,
      target: 10000,
      color: 'var(--signal-good)',
      format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`,
    },
    {
      label: 'PROTEIN',
      value: loading ? null : proteinG,
      target: 180,
      color: 'var(--ochre)',
      format: (v) => `${Math.round(v)}g`,
    },
    {
      label: 'RECOVERY',
      value: loading ? null : readinessScore,
      target: 100,
      color: 'var(--clay)',
      format: (v) => `${Math.round(v)}`,
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr 1fr',
      gap: 'var(--space-xs)',
      padding: 'var(--space-sm) 0',
    }}>
      {rings.map((r) => (
        <GoalRing key={r.label} {...r} />
      ))}
    </div>
  );
}
