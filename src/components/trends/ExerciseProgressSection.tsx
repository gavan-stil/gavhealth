import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { Exercise } from "@/types/trends";
import ExerciseProgressCard from "./ExerciseProgressCard";

type Filter = "all" | "push" | "pull" | "legs" | "abs";

// Maps backend category values → frontend filter tabs
// "other" is intentionally absent — those exercises only appear under "all"
const CATEGORY_TO_FILTER: Record<string, Filter> = {
  chest:     "push",
  shoulders: "push",
  arms:      "push",
  back:      "pull",
  legs:      "legs",
  abs:       "abs",
  core:      "abs",
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "push", label: "Push" },
  { key: "pull", label: "Pull" },
  { key: "legs", label: "Legs" },
  { key: "abs", label: "Abs" },
];

interface Props {
  days: number;
}

export default function ExerciseProgressSection({ days }: Props) {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    apiFetch<Exercise[]>("/api/exercises")
      .then(setExercises)
      .catch(() => setExercises([]));
  }, []);

  const filtered =
    exercises == null
      ? null
      : filter === "all"
      ? exercises
      : exercises.filter(
          (ex) => CATEGORY_TO_FILTER[ex.category] === filter
        );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
      }}
    >
      {/* Header + filter pills */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
        }}
      >
        <span className="label-text" style={{ color: "var(--text-muted)" }}>
          EXERCISE PROGRESS
        </span>
        <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "4px 12px",
                borderRadius: "var(--radius-pill)",
                border: "1px solid",
                borderColor: filter === f.key ? "var(--ochre)" : "var(--border-default)",
                background:
                  filter === f.key ? "rgba(212,160,74,0.15)" : "transparent",
                color: filter === f.key ? "var(--ochre)" : "var(--text-muted)",
                fontSize: 11,
                fontFamily: "inherit",
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {filtered === null && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-lg)",
          }}
        >
          <span className="label-text" style={{ color: "var(--text-muted)" }}>
            Loading exercises…
          </span>
        </div>
      )}

      {/* Empty */}
      {filtered !== null && filtered.length === 0 && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-lg)",
            textAlign: "center",
          }}
        >
          <span className="body-text" style={{ color: "var(--text-muted)" }}>
            No {filter === "all" ? "" : filter + " "}exercises logged yet
          </span>
        </div>
      )}

      {/* Exercise cards */}
      {filtered !== null &&
        filtered.map((ex) => (
          <ExerciseProgressCard key={ex.id} exercise={ex} days={days} />
        ))}
    </div>
  );
}
