import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Exercise } from "@/types/trends";
import ExerciseProgressCard from "./ExerciseProgressCard";

type Filter = "all" | "push" | "pull" | "legs" | "abs";

// Maps backend category values → frontend filter tabs (backwards compat)
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

/** Check if an exercise matches a filter, using muscles array with fallback to category */
function exerciseMatchesFilter(ex: Exercise, filter: Filter): boolean {
  if (filter === "all") return true;

  // Multi-category: check if ANY muscle group maps to this filter's macro group
  if (ex.muscles?.length) {
    return ex.muscles.some((m) => m.macro_group === filter);
  }

  // Fallback to single category for exercises without muscles data
  return CATEGORY_TO_FILTER[ex.category] === filter;
}

interface Props {
  days: number;
}

export default function ExerciseProgressSection({ days }: Props) {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const fetchExercises = () => {
    apiFetch<Exercise[]>("/api/exercises")
      .then(setExercises)
      .catch(() => setExercises([]));
  };

  useEffect(fetchExercises, []);

  const filtered =
    exercises == null
      ? null
      : exercises.filter((ex) => exerciseMatchesFilter(ex, filter));

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="label-text" style={{ color: "var(--text-muted)" }}>
            EXERCISE PROGRESS
          </span>
          <button
            onClick={() => navigate("/exercises")}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
            }}
            title="Manage exercises"
          >
            <Settings size={16} />
          </button>
        </div>
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
