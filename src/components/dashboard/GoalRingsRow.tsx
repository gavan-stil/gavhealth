import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const CIRC = 2 * Math.PI * 50; // ~314.16

/* ── Icons in 24×24 coordinate space (from original design) ── */

function SleepIcon({ color }: { color: string }) {
  return (
    <path
      d="M 15 4 A 8 8 0 1 0 15 20 A 6 6 0 0 1 15 4"
      fill="none" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
    />
  );
}

function StepsIcon({ color }: { color: string }) {
  return (
    <>
      <line x1="10" y1="4" x2="6" y2="20" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="18" y1="4" x2="14" y2="20" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </>
  );
}

function ProteinIcon({ color }: { color: string }) {
  return (
    <>
      <line x1="8" y1="4" x2="8" y2="10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="4" x2="12" y2="10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16" y1="4" x2="16" y2="10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 8 10 Q 8 14 12 14 Q 16 14 16 10" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="14" x2="12" y2="20" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </>
  );
}

function RecoveryIcon({ color }: { color: string }) {
  return (
    <path
      d="M 13 2 L 4 14 L 11 14 L 11 22 L 20 10 L 13 10 Z"
      fill="none" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
    />
  );
}

interface RingConfig {
  label: string;
  value: number | null;
  target: number;
  color: string;
  format: (v: number) => string;
  icon: (color: string) => ReactNode;
}

/* ── Single ring with Apple Watch overflow ── */

function GoalRing({ label, value, target, color, format, icon }: RingConfig) {
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
      <svg width={91} height={91} viewBox="0 0 120 120">
        <defs>
          <filter id={`shadow-${label}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(0,0,0,0.6)" />
          </filter>
        </defs>

        {/* Background track */}
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-default)" strokeWidth="8" />

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

        {/* Icon — centered at (60, 39) in the upper interior */}
        <g transform="translate(51, 30) scale(0.75)">
          {icon(color)}
        </g>

        {/* Value text — lower interior */}
        <text
          x="60" y="76"
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-primary)"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
          fontSize="18"
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
      icon: (c) => <SleepIcon color={c} />,
    },
    {
      label: 'STEPS',
      value: loading ? null : steps,
      target: 10000,
      color: 'var(--signal-good)',
      format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`,
      icon: (c) => <StepsIcon color={c} />,
    },
    {
      label: 'PROTEIN',
      value: loading ? null : proteinG,
      target: 180,
      color: 'var(--ochre)',
      format: (v) => `${Math.round(v)}g`,
      icon: (c) => <ProteinIcon color={c} />,
    },
    {
      label: 'RECOVERY',
      value: loading ? null : readinessScore,
      target: 100,
      color: 'var(--clay)',
      format: (v) => `${Math.round(v)}`,
      icon: (c) => <RecoveryIcon color={c} />,
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
