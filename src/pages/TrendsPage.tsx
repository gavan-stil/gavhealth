import { useState } from "react";
import { useTrendsData } from "@/hooks/useTrendsData";
import type { TimeRange } from "@/hooks/useTrendsData";
import { useStrengthTrends } from "@/hooks/useStrengthTrends";
import EnergyBalanceChart from "@/components/trends/EnergyBalanceChart";
import ProteinWeightChart from "@/components/trends/ProteinWeightChart";
import StrengthQualityChart from "@/components/trends/StrengthQualityChart";
import RunHRZonesChart from "@/components/trends/RunHRZonesChart";
import WorkoutVolumeChart from "@/components/trends/WorkoutVolumeChart";
import ExerciseProgressSection from "@/components/trends/ExerciseProgressSection";
import SplitProgressChart from "@/components/trends/SplitProgressChart";
import NutritionTrendsChart from "@/components/trends/NutritionTrendsChart";
import WaterTrendsChart from "@/components/trends/WaterTrendsChart";
import useGoals from "@/hooks/useGoals";
import { AlertTriangle } from "lucide-react";

/* ── Inline skeleton (avoids modifying dashboard CardSkeleton) ── */

const pulseStyle: React.CSSProperties = {
  background:
    "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-card-hover) 50%, var(--bg-card) 75%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-pulse 1.5s ease-in-out infinite",
  borderRadius: "var(--radius-sm)",
};

function SkeletonBlock({ w, h }: { w: string; h: number }) {
  return <div style={{ ...pulseStyle, width: w, height: h }} />;
}

function TrendsSkeleton() {
  return (
    <>
      {/* Sparklines skeleton */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-sm)",
        }}
      >
        <SkeletonBlock w="50%" h={10} />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "var(--space-sm) 0",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <SkeletonBlock w="48px" h={10} />
              <SkeletonBlock w="36px" h={14} />
            </div>
            <SkeletonBlock w="120px" h={32} />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-sm)",
        }}
      >
        <SkeletonBlock w="60%" h={10} />
        <SkeletonBlock w="100%" h={200} />
      </div>

      {/* Correlation skeleton */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-sm)",
        }}
      >
        <SkeletonBlock w="50%" h={10} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
            <SkeletonBlock w="55%" h={14} />
            <SkeletonBlock w="30%" h={14} />
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Page ── */

export default function TrendsPage() {
  const [days] = useState<TimeRange>(30);
  const { data, loading, error, refetch } = useTrendsData(days);
  const strengthTrends = useStrengthTrends(days);
  const { targets: goalTargets } = useGoals();
  const proteinTarget = goalTargets["protein_g"]?.target_min ?? 180;
  const waterTarget = goalTargets["water_ml"]?.target_min ?? 3000;

  return (
    <div
      style={{
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
      }}
    >
      {loading ? (
        <TrendsSkeleton />
      ) : !data ? (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-lg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-sm)",
            minHeight: 120,
          }}
        >
          <AlertTriangle size={16} style={{ color: "var(--signal-poor)" }} />
          <span className="body-text" style={{ color: "var(--text-muted)" }}>
            Couldn't load trends data
          </span>
          {error && (
            <span
              className="label-text"
              style={{ color: "var(--text-muted)", textAlign: "center" }}
            >
              {error}
            </span>
          )}
          <span
            className="label-text"
            style={{ color: "var(--ochre)", cursor: "pointer" }}
            onClick={refetch}
          >
            Tap to retry
          </span>
        </div>
      ) : (
        <>
          {error && (
            <div
              style={{
                padding: "var(--space-sm) var(--space-md)",
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-default)",
              }}
            >
              <span className="label-text" style={{ color: "var(--signal-caution)" }}>
                {error}
              </span>
            </div>
          )}
          <EnergyBalanceChart proteinTarget={proteinTarget} />
          <ProteinWeightChart proteinTarget={proteinTarget} />
          <SplitProgressChart />
          <StrengthQualityChart />
          <RunHRZonesChart />
          <NutritionTrendsChart nutrition={data.nutrition} proteinTarget={proteinTarget} />
          <WaterTrendsChart water={data.water} waterTarget={waterTarget} />
          <WorkoutVolumeChart
            sessions={strengthTrends.sessions}
            loading={strengthTrends.loading}
            error={strengthTrends.error}
            refetch={strengthTrends.refetch}
            days={days}
          />
          <ExerciseProgressSection days={days} />
        </>
      )}
    </div>
  );
}
