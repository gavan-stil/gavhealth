import { useRef, useState, useCallback } from "react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import useDashboard from "@/hooks/useDashboard";
import useDashboardV2 from "@/hooks/useDashboardV2";
import useGoalRings from "@/hooks/useGoalRings";
import useSleepStages from "@/hooks/useSleepStages";
import useSleepHistory from "@/hooks/useSleepHistory";
import useIntradayHR from "@/hooks/useIntradayHR";
import GoalRingsRow from "@/components/dashboard/GoalRingsRow";
import SleepCard from "@/components/dashboard/SleepCard";
import SleepHistorySheet from "@/components/dashboard/SleepHistorySheet";
import IntradayHRChart from "@/components/dashboard/IntradayHRChart";
import MomentumCard from "@/components/dashboard/MomentumCard";
import ProgressCard from "@/components/dashboard/ProgressCard";
import useMomentum from "@/hooks/useMomentum";
import useProgress from "@/hooks/useProgress";
import VitalsCard from "@/components/dashboard/VitalsCard";
import StreaksCard from "@/components/dashboard/StreaksCard";
import CardSkeleton from "@/components/dashboard/CardSkeleton";
import CardError from "@/components/dashboard/CardError";
import CardEmpty from "@/components/dashboard/CardEmpty";
import SyncButton from "@/components/SyncButton";
import QuickStatsRow from "@/components/dashboard/QuickStatsRow";
import ActivityChart from "@/components/dashboard/ActivityChart";
import CalorieBalanceChart from "@/components/dashboard/CalorieBalanceChart";
import ReadinessCard from "@/components/dashboard/ReadinessCard";
import MoodEnergyChart from "@/components/dashboard/MoodEnergyChart";
import WaterNutritionChart from "@/components/dashboard/WaterNutritionChart";
import NutritionTargetChart from "@/components/dashboard/NutritionTargetChart";

const PULL_THRESHOLD = 60;

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

function stepDate(date: string, delta: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString("en-CA");
}

function formatDateLabel(date: string): string {
  const today = todayLocal();
  if (date === today) return "Today";
  const yesterday = stepDate(today, -1);
  if (date === yesterday) return "Yesterday";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState<string>(todayLocal);
  const [sleepSheetOpen, setSleepSheetOpen] = useState(false);
  const isToday = selectedDate === todayLocal();

  const { readiness, vitals, streaks } = useDashboard();
  const momentum = useMomentum();
  const progress = useProgress();
  const v2 = useDashboardV2(selectedDate);
  const goalRings = useGoalRings(selectedDate);
  const sleepStages = useSleepStages(selectedDate);
  const sleepHistory = useSleepHistory(30);
  const intradayHR = useIntradayHR(selectedDate);

  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refetchAll = useCallback(() => {
    setSelectedDate(todayLocal());
    readiness.refetch();
    momentum.refetch();
    progress.refetch();
    vitals.refetch();
    streaks.refetch();
    v2.refetch();
    goalRings.refetch();
    sleepStages.refetch();
    sleepHistory.refetch();
    intradayHR.refetch();
  }, [readiness, momentum, progress, vitals, streaks, v2, goalRings, sleepStages, sleepHistory, intradayHR]);

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

  const chartsLoading = v2.activities.loading || v2.mood.loading || v2.water.loading || v2.food.loading;

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
      {/* Header row: date stepper + sync button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          <button
            onClick={() => setSelectedDate(d => stepDate(d, -1))}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="label-text" style={{ color: "var(--text-secondary)", minWidth: 90, textAlign: "center" }}>
            {formatDateLabel(selectedDate)}
          </span>
          <button
            onClick={() => setSelectedDate(d => stepDate(d, 1))}
            disabled={isToday}
            style={{
              background: "none",
              border: "none",
              color: isToday ? "var(--border-default)" : "var(--text-muted)",
              cursor: isToday ? "default" : "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
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

      {/* Quick stats */}
      <QuickStatsRow stats={v2.todayStats} moodEntries={v2.mood.data} />

      {/* Goal rings */}
      {(() => {
        const stepsFromIntraday = intradayHR.loading
          ? null
          : intradayHR.data
            ? intradayHR.data.buckets.reduce((sum, b) => sum + (b.steps_count ?? 0), 0)
            : null;
        return (
          <GoalRingsRow
            sleepScore={goalRings.sleepScore}
            steps={stepsFromIntraday}
            proteinG={v2.todayStats.protein_g}
            readinessScore={readiness.data?.score ?? null}
            loading={goalRings.loading || readiness.loading}
          />
        );
      })()}

      {/* Momentum */}
      {momentum.loading ? (
        <CardSkeleton variant="readiness" />
      ) : momentum.error ? (
        <CardError section="momentum" onRetry={momentum.refetch} />
      ) : momentum.data ? (
        <MomentumCard data={momentum.data} />
      ) : (
        <CardEmpty section="momentum" />
      )}

      {/* Progress */}
      {progress.data && <ProgressCard data={progress.data} />}

      {/* Sleep stages */}
      {sleepStages.loading ? null : sleepStages.data ? (
        <SleepCard data={sleepStages.data} onClick={() => setSleepSheetOpen(true)} />
      ) : (
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span className="label-text" style={{ color: "var(--text-muted)" }}>SLEEP</span>
          <span className="body-text" style={{ color: "var(--text-muted)" }}>No data — navigate to see a previous night</span>
        </div>
      )}

      {/* Sleep history sheet */}
      {sleepSheetOpen && (
        <SleepHistorySheet
          entries={sleepHistory.data}
          loading={sleepHistory.loading}
          onClose={() => setSleepSheetOpen(false)}
        />
      )}

      {/* Readiness */}
      {readiness.loading ? (
        <CardSkeleton variant="readiness" />
      ) : readiness.error ? (
        <CardError section="readiness" onRetry={readiness.refetch} />
      ) : readiness.data ? (
        <ReadinessCard data={readiness.data} />
      ) : null}

      {/* Intraday HR */}
      <IntradayHRChart data={intradayHR.data} loading={intradayHR.loading} />

      {/* Activity chart */}
      <ActivityChart data={v2.activities.data} loading={v2.activities.loading} />

      {/* Calorie balance chart */}
      <CalorieBalanceChart
        activityData={v2.activityData.data}
        foodData={v2.food.data}
        loading={v2.activityData.loading || v2.food.loading}
      />

      {/* Mood & Energy chart */}
      <MoodEnergyChart data={v2.mood.data} loading={v2.mood.loading} />

      {/* Water & Nutrition chart */}
      <WaterNutritionChart
        waterData={v2.water.data}
        foodData={v2.food.data}
        loading={chartsLoading}
      />

      {/* Nutrition targets chart */}
      <NutritionTargetChart
        foodData={v2.food.data}
        loading={v2.food.loading}
      />

      {/* Collapsed: Vitals + Streaks */}
      <details style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <summary style={{
          padding: 'var(--space-md) var(--space-lg)',
          cursor: 'pointer',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span className="label-text" style={{ color: 'var(--text-muted)' }}>MORE STATS</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>▼</span>
        </summary>
        <div style={{ padding: 'var(--space-md) var(--space-lg) var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {vitals.loading ? (
            <CardSkeleton variant="vitals" />
          ) : vitals.error ? (
            <CardError section="vitals" onRetry={vitals.refetch} />
          ) : vitals.data ? (
            <VitalsCard data={vitals.data} />
          ) : (
            <CardEmpty section="vitals" />
          )}

          {streaks.loading ? (
            <CardSkeleton variant="streaks" />
          ) : streaks.error ? (
            <CardError section="streaks" onRetry={streaks.refetch} />
          ) : streaks.data ? (
            <StreaksCard data={streaks.data} />
          ) : (
            <CardEmpty section="streaks" />
          )}
        </div>
      </details>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        details > summary::-webkit-details-marker { display: none; }
      `}</style>
    </div>
  );
}
