/**
 * ExerciseManagerSheet — full list of all exercises, grouped by macro group.
 * Tap an exercise to open ExerciseEditSheet.
 * zIndex 120 (same level as DayDetailSheet).
 */

import { useState, useEffect } from "react";
import { X, Pencil } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Exercise } from "@/types/trends";
import ExerciseEditSheet from "./ExerciseEditSheet";

const MACRO_COLOURS: Record<string, string> = {
  push: "#c45a4a",
  pull: "#7FAABC",
  legs: "#d4a04a",
  abs: "#8a7a6a",
  other: "#6a6a6a",
};

const MACRO_ORDER = ["push", "pull", "legs", "abs", "other"];
const MACRO_LABELS: Record<string, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  abs: "Abs",
  other: "Other",
};

interface Props {
  onClose: () => void;
  onExerciseUpdated?: () => void;
}

/** Get the primary macro group for an exercise */
function primaryMacro(ex: Exercise): string {
  const primary = ex.muscles?.find((m) => m.is_primary);
  if (primary) return primary.macro_group;
  // Fallback to category field for backwards compat
  const CATEGORY_TO_MACRO: Record<string, string> = {
    chest: "push", shoulders: "push", arms: "push",
    back: "pull", legs: "legs", core: "abs", other: "other",
  };
  return CATEGORY_TO_MACRO[ex.category] ?? "other";
}

export default function ExerciseManagerSheet({ onClose, onExerciseUpdated }: Props) {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  const fetchExercises = () => {
    apiFetch<Exercise[]>("/api/exercises")
      .then(setExercises)
      .catch(() => setExercises([]));
  };

  useEffect(fetchExercises, []);

  const handleSave = (updated: Exercise) => {
    setExercises((prev) =>
      prev?.map((ex) => (ex.id === updated.id ? updated : ex)) ?? null
    );
    setEditingExercise(null);
    onExerciseUpdated?.();
  };

  // Group exercises by macro group
  const grouped: Record<string, Exercise[]> = {};
  for (const ex of exercises ?? []) {
    const macro = primaryMacro(ex);
    (grouped[macro] ??= []).push(ex);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 119 }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--bg-primary)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          zIndex: 120,
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "var(--space-lg)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-lg)" }}>
          <h3 style={{ font: "600 16px/1.2 'Inter',sans-serif", color: "var(--text-primary)", margin: 0 }}>
            Manage Exercises
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {exercises === null ? (
          <div style={{ font: "400 13px/1.4 'Inter',sans-serif", color: "var(--text-muted)", padding: "20px 0", textAlign: "center" }}>
            Loading...
          </div>
        ) : exercises.length === 0 ? (
          <div style={{ font: "400 13px/1.4 'Inter',sans-serif", color: "var(--text-muted)", padding: "20px 0", textAlign: "center" }}>
            No exercises logged yet.
          </div>
        ) : (
          MACRO_ORDER.map((macro) => {
            const items = grouped[macro];
            if (!items?.length) return null;
            return (
              <div key={macro} style={{ marginBottom: "var(--space-lg)" }}>
                {/* Group header */}
                <div
                  style={{
                    font: "600 11px/1 'Inter',sans-serif",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    color: MACRO_COLOURS[macro],
                    marginBottom: "var(--space-sm)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-xs)",
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: MACRO_COLOURS[macro] }} />
                  {MACRO_LABELS[macro]} ({items.length})
                </div>

                {/* Exercise rows */}
                {items.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => setEditingExercise(ex)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                      padding: "12px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-sm)",
                      marginBottom: "var(--space-xs)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ font: "500 13px/1.2 'Inter',sans-serif", color: "var(--text-primary)", flex: 1 }}>
                      {ex.name}
                    </span>

                    {/* Muscle chips */}
                    <div style={{ display: "flex", gap: 4, marginRight: "var(--space-sm)", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {(ex.muscles ?? []).map((m) => (
                        <span
                          key={m.muscle_group}
                          style={{
                            font: "500 9px/1 'Inter',sans-serif",
                            padding: "3px 6px",
                            borderRadius: 4,
                            background: `${MACRO_COLOURS[m.macro_group] ?? "#666"}22`,
                            color: MACRO_COLOURS[m.macro_group] ?? "#666",
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                            opacity: m.is_primary ? 1 : 0.6,
                          }}
                        >
                          {m.muscle_group}
                        </span>
                      ))}
                    </div>

                    <Pencil size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            );
          })
        )}

        {/* Bottom safe area */}
        <div style={{ height: "env(safe-area-inset-bottom, 16px)" }} />
      </div>

      {/* Edit sheet (overlays on top) */}
      {editingExercise && (
        <ExerciseEditSheet
          exercise={editingExercise}
          onSave={handleSave}
          onClose={() => setEditingExercise(null)}
        />
      )}
    </>
  );
}
