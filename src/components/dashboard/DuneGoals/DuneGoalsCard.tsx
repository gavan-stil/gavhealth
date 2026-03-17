import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useDuneData } from '@/hooks/useDuneData';
import DuneCanvas from './DuneCanvas';
import DuneSummaryRows from './DuneSummaryRows';
import CardError from '@/components/dashboard/CardError';

function DuneSkeleton() {
  return (
    <div style={{
      width: '100%',
      height: 320,
      background: 'linear-gradient(180deg, #0d0806 0%, #1a0d05 35%, #0a0503 100%)',
      animation: 'dune-skeleton-pulse 2s ease-in-out infinite',
    }} />
  );
}

export default function DuneGoalsCard() {
  const { signals, loading, error, refetch } = useDuneData();
  const [expanded, setExpanded] = useState(false);

  const onTrackCount = signals.filter(
    s => s.gapPct >= -0.08 && s.gapPct <= 0.15,
  ).length;

  return (
    <>
      <style>{`
        @keyframes dune-skeleton-pulse {
          0%, 100% { opacity: 0.55; }
          50%       { opacity: 0.90; }
        }
      `}</style>

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div
          onClick={() => setExpanded(e => !e)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-md) var(--space-lg)',
            cursor: 'pointer',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span className="label-text">Goals</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            {!loading && !error && signals.length > 0 && (
              <span className="label-text" style={{ color: 'var(--ochre)' }}>
                {onTrackCount} of {signals.length} on track
              </span>
            )}
            <ChevronDown
              size={14}
              color="var(--text-muted)"
              style={{
                transition: 'transform 0.25s ease',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </div>
        </div>

        {/* Canvas */}
        {loading ? (
          <DuneSkeleton />
        ) : error ? (
          <div style={{ padding: 'var(--space-lg)' }}>
            <CardError section="goals" onRetry={refetch} />
          </div>
        ) : (
          <DuneCanvas signals={signals} />
        )}

        {/* Collapsible summary rows */}
        <div style={{
          overflow: 'hidden',
          maxHeight: expanded ? 500 : 0,
          opacity: expanded ? 1 : 0,
          transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
        }}>
          {!loading && !error && signals.length > 0 && (
            <DuneSummaryRows signals={signals} />
          )}
        </div>
      </div>
    </>
  );
}
