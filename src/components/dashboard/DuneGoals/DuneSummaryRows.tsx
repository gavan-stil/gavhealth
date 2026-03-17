import type { DuneSignalData } from '@/hooks/useDuneData';

function formatValue(val: number, key: string): string {
  if (key === 'water_ml')    return (val / 1000).toFixed(2) + 'L';
  if (key === 'sleep_hrs')   return val.toFixed(1) + 'hr';
  if (key === 'protein_g')   return Math.round(val) + 'g';
  if (key === 'calories_in') return Math.round(val).toLocaleString() + ' cal';
  return String(val);
}

function formatGap(gap: number, key: string): string {
  const abs = Math.abs(gap);
  let str: string;
  if (key === 'water_ml')         str = (abs / 1000).toFixed(2) + 'L';
  else if (key === 'sleep_hrs')   str = abs.toFixed(1) + 'hr';
  else if (key === 'protein_g')   str = Math.round(abs) + 'g';
  else if (key === 'calories_in') str = Math.round(abs).toLocaleString() + ' cal';
  else str = String(abs);
  return (gap >= 0 ? '+' : '\u2212') + str;
}

function dotColor(gapPct: number): string {
  const warmth = Math.max(0, Math.min(1, (gapPct + 0.50) / 0.75));
  const r = Math.round(85  + warmth * 165);
  const g = Math.round(38  + warmth * 100);
  const b = Math.round(10  + warmth * 28);
  return `rgb(${r},${g},${b})`;
}

interface Props {
  signals: DuneSignalData[];
}

export default function DuneSummaryRows({ signals }: Props) {
  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
      {signals.map((sig, i) => {
        const isLast    = i === signals.length - 1;
        const gapStr    = sig.value != null ? formatGap(sig.gap, sig.key) : '—';
        const isNeutral = Math.abs(sig.gapPct) <= 0.05;
        const gapColor  = isNeutral
          ? 'var(--text-muted)'
          : sig.gap >= 0 ? 'var(--signal-good)' : 'var(--signal-poor)';

        return (
          <div
            key={sig.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: 'var(--space-sm) var(--space-lg)',
              borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: dotColor(sig.gapPct),
            }} />
            <span className="label-text" style={{ color: 'var(--text-muted)', flex: 1 }}>
              {sig.label.toUpperCase()}
            </span>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 14, fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              {sig.value != null ? formatValue(sig.value, sig.key) : '—'}
            </span>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11, fontWeight: 400,
              color: gapColor,
              minWidth: 64,
              textAlign: 'right',
            }}>
              {gapStr}
            </span>
          </div>
        );
      })}
    </div>
  );
}
