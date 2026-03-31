import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { Exercise, ExerciseSession } from "@/types/trends";

/* ── Category map ── */

type Category = "push" | "pull" | "legs" | "abs" | "other";

// Maps backend category → frontend group (for colour + filter)
const BACKEND_TO_CATEGORY: Record<string, Category> = {
  chest:     "push",
  shoulders: "push",
  arms:      "push",
  back:      "pull",
  legs:      "legs",
  abs:       "abs",
  core:      "abs",
};

const CATEGORY_COLORS: Record<Category, string> = {
  push:  "#c45a4a",  // rust
  pull:  "#7FAABC",  // dawn
  legs:  "#d4a04a",  // ochre
  abs:   "#8a7a6a",  // muted warm
  other: "#6a6a6a",  // neutral
};

// March 2026 — earliest month with real data
const DATA_START = new Date(2026, 2, 1); // month is 0-indexed

/* ── Sparkline (SVG polyline) ── */

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 120, h = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (w - 8) + 4;
      const y = h - 4 - ((v - min) / range) * (h - 8);
      return `${x},${y}`;
    })
    .join(" ");

  const lastX = parseFloat(points.split(" ").at(-1)!.split(",")[0]);
  const lastY = parseFloat(points.split(" ").at(-1)!.split(",")[1]);
  const lastVal = values.at(-1)!;

  return (
    <svg width={w + 28} height={h} style={{ overflow: "visible" }}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--ochre)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={3} fill="var(--ochre)" />
      <text
        x={lastX + 6}
        y={lastY + 4}
        fontSize={9}
        fill="var(--ochre)"
        fontFamily="var(--font-mono, monospace)"
        fontWeight={700}
      >
        {lastVal % 1 === 0 ? lastVal : lastVal.toFixed(1)}kg
      </text>
    </svg>
  );
}

/* ── Monthly volume bars ── */

function MonthlyVolumeBars({ history }: { history: ExerciseSession[] }) {
  // Calendar months from DATA_START up to current month (max 6)
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  let cursor = new Date(DATA_START.getFullYear(), DATA_START.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cursor <= end) {
    months.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      label: cursor.toLocaleString("default", { month: "short" }),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  // Cap at 6 most recent to avoid overflow
  if (months.length > 6) months.splice(0, months.length - 6);

  const volumeByMonth = new Map<string, number>();
  for (const session of history) {
    const monthKey = session.session_date.slice(0, 7);
    volumeByMonth.set(monthKey, (volumeByMonth.get(monthKey) ?? 0) + session.session_volume_kg);
  }

  const values = months.map((m) => volumeByMonth.get(m.key) ?? 0);
  const maxVal = Math.max(...values, 1);

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
      {months.map((m, i) => (
        <div
          key={m.key}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
        >
          <div
            style={{
              width: 20,
              height: Math.max(4, Math.round((values[i] / maxVal) * 48)),
              background: i === months.length - 1 ? "var(--ochre)" : "var(--border-default)",
              borderRadius: "2px 2px 0 0",
            }}
          />
          <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "inherit" }}>
            {m.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Card ── */

interface Props {
  exercise: Exercise;
  days: number;
}

export default function ExerciseProgressCard({ exercise, days }: Props) {
  const [history, setHistory] = useState<ExerciseSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<ExerciseSession[]>(
      `/api/strength/exercise/${exercise.id}/history?days=${days}`
    )
      .then(setHistory)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [exercise.id, days]);

  // Use muscles array for chips, fall back to single category
  const muscleChips = exercise.muscles?.length
    ? exercise.muscles
    : [{ muscle_group: exercise.category, macro_group: BACKEND_TO_CATEGORY[exercise.category] ?? "other", is_primary: true }];
  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-md) var(--space-lg)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-sm)",
  };

  if (loading) {
    return (
      <div className="goe-card" style={{ ...cardStyle, opacity: 0.6 }}>
        <span className="label-text" style={{ color: "var(--text-muted)" }}>
          {exercise.name}
        </span>
        <div
          style={{
            height: 36,
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-sm)",
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    );
  }

  // Error: show minimal error card; empty history: hide entirely (unlinked exercise)
  if (error) {
    return (
      <div className="goe-card" style={cardStyle}>
        <span className="label-text" style={{ color: "var(--text-muted)" }}>
          {exercise.name} — {error}
        </span>
      </div>
    );
  }
  if (!history || history.length === 0) return null;

  const topWeights = history.map((h) => h.top_weight_kg);
  const lastIdx = history.length - 1;
  // Find session closest to 4 weeks ago (time-based, not session-count)
  const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const compareIdx = history.findIndex((h) => new Date(h.session_date).getTime() >= fourWeeksAgo);
  const effectiveCompareIdx = compareIdx === -1 ? 0 : compareIdx;
  const change4w = topWeights[lastIdx] - topWeights[effectiveCompareIdx];

  return (
    <div className="goe-card" style={cardStyle}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", flexWrap: "wrap" }}>
          {muscleChips.map((m) => {
            const color = CATEGORY_COLORS[m.macro_group as Category] ?? CATEGORY_COLORS.other;
            return (
              <span
                key={m.muscle_group}
                style={{
                  padding: "2px 6px",
                  borderRadius: "var(--radius-pill)",
                  background: `${color}22`,
                  color: color,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  opacity: m.is_primary ? 1 : 0.6,
                }}
              >
                {m.muscle_group}
              </span>
            );
          })}
          <span className="body-text" style={{ fontWeight: 600 }}>
            {exercise.name}
          </span>
        </div>
        {lastIdx > effectiveCompareIdx && (
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 700,
              color: change4w >= 0 ? "var(--signal-good)" : "var(--signal-poor)",
            }}
          >
            {change4w >= 0 ? "+" : ""}
            {change4w % 1 === 0 ? change4w : change4w.toFixed(1)}kg
          </span>
        )}
      </div>

      {/* Sparkline + monthly bars side by side */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Sparkline values={topWeights} />
        <MonthlyVolumeBars history={history} />
      </div>

      {/* Best set info */}
      <div style={{ display: "flex", gap: "var(--space-lg)" }}>
        <div>
          <span className="label-text" style={{ color: "var(--text-muted)", display: "block" }}>
            TOP
          </span>
          <span
            style={{
              fontSize: 13,
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {topWeights[lastIdx]}kg
          </span>
        </div>
        <div>
          <span className="label-text" style={{ color: "var(--text-muted)", display: "block" }}>
            EST 1RM
          </span>
          <span
            style={{
              fontSize: 13,
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 700,
              color: "var(--ochre)",
            }}
          >
            {history[lastIdx].estimated_1rm.toFixed(1)}kg
          </span>
        </div>
        <div>
          <span className="label-text" style={{ color: "var(--text-muted)", display: "block" }}>
            SESSIONS
          </span>
          <span
            style={{
              fontSize: 13,
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {history.length}
          </span>
        </div>
      </div>
    </div>
  );
}
