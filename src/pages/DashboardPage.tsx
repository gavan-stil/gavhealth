import { useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import useDashboard from "@/hooks/useDashboard";
import ReadinessCard from "@/components/dashboard/ReadinessCard";
import VitalsCard from "@/components/dashboard/VitalsCard";
import StreaksCard from "@/components/dashboard/StreaksCard";
import CardSkeleton from "@/components/dashboard/CardSkeleton";
import CardError from "@/components/dashboard/CardError";
import CardEmpty from "@/components/dashboard/CardEmpty";
import SyncButton from "@/components/SyncButton";

const PULL_THRESHOLD = 60;

export default function DashboardPage() {
  const { readiness, vitals, streaks } = useDashboard();

  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refetchAll = useCallback(() => {
    readiness.refetch();
    vitals.refetch();
    streaks.refetch();
  }, [readiness, vitals, streaks]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (el && el.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      const el = containerRef.current;
      if (!el || el.scrollTop > 0) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        setPullDistance(Math.min(delta * 0.5, 80));
      }
    },
    [refreshing],
  );

  const onTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      refetchAll();
      setTimeout(() => {
        setRefreshing(false);
        setPullDistance(0);
      }, 1200);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, refetchAll]);

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
      }}
    >
      {/* Header row with sync button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <SyncButton onSuccess={refetchAll} />
      </div>

      {/* Pull indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            height: refreshing ? 40 : pullDistance * 0.5,
            overflow: "hidden",
            transition: refreshing ? "height 0.2s" : "none",
          }}
        >
          <Loader2
            size={20}
            color="var(--ochre)"
            style={{
              animation: refreshing ? "spin 0.8s linear infinite" : "none",
              opacity: pullDistance >= PULL_THRESHOLD || refreshing ? 1 : pullDistance / PULL_THRESHOLD,
            }}
          />
        </div>
      )}

      {/* Readiness */}
      {readiness.loading ? (
        <CardSkeleton variant="readiness" />
      ) : readiness.error ? (
        <CardError section="readiness" onRetry={readiness.refetch} />
      ) : readiness.data ? (
        <ReadinessCard data={readiness.data} />
      ) : (
        <CardEmpty section="readiness" />
      )}

      {/* Vitals */}
      {vitals.loading ? (
        <CardSkeleton variant="vitals" />
      ) : vitals.error ? (
        <CardError section="vitals" onRetry={vitals.refetch} />
      ) : vitals.data ? (
        <VitalsCard data={vitals.data} />
      ) : (
        <CardEmpty section="vitals" />
      )}

      {/* Streaks */}
      {streaks.loading ? (
        <CardSkeleton variant="streaks" />
      ) : streaks.error ? (
        <CardError section="streaks" onRetry={streaks.refetch} />
      ) : streaks.data ? (
        <StreaksCard data={streaks.data} />
      ) : (
        <CardEmpty section="streaks" />
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
