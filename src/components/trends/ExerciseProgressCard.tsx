import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { Exercise, ExerciseSession } from "@/types/trends";

/* ── Category map ── */

type Category = "push" | "pull" | "legs" | "abs";

const EXERCISE_CATEGORIES: Record<string, Category> = {
  Squat: "legs",
  "Leg Press": "legs",
  RDL: "legs",
  Deadlift: "legs",
  "Bench Press": "push",
  OHP: "push",
  Dips: "push",
  "Push-ups": "push",
  "Pull-ups": "pull",
  Row: "pull",
  "Chin-ups": "pull",
  Plank: "abs",
  Crunch: "abs",
};

const CATEGORY_COLORS: Record<Category, string> = {
  push: "#c45a4a",  // rust
  pull: "#7FAABC",  // dawn
  legs: "#d4a04a",  // ochre
  abs:  "#8a7a6a",  // muted warm
};

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
  // Last 4 calendar months
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("default", { month: "short" }),
    });
  }

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

  const category: Category = EXERCISE_CATEGORIES[exercise.name] ?? "legs";
  const catColor = CATEGORY_COLORS[category];

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
      <div style={{ ...cardStyle, opacity: 0.6 }}>
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

  if (error || !history || history.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "var(--radius-pill)",
              background: `${catColor}22`,
              color: catColor,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {category}
          </span>
          <span className="body-text" style={{ fontWeight: 600 }}>
            {exercise.name}
          </span>
        </div>
        <span className="label-text" style={{ color: "var(--text-muted)" }}>
          {error ?? "No data logged yet"}
        </span>
      </div>
    );
  }

  const topWeights = history.map((h) => h.top_weight_kg);
  const lastIdx = history.length - 1;
  const compareIdx = Math.max(0, lastIdx - 4);
  const change4w = topWeights[lastIdx] - topWeights[compareIdx];

  return (
    <div style={cardStyle}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "var(--radius-pill)",
              background: `${catColor}22`,
              color: catColor,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {category}
          </span>
          <span className="body-text" style={{ fontWeight: 600 }}>
            {exercise.name}
          </span>
        </div>
        {lastIdx > compareIdx && (
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
