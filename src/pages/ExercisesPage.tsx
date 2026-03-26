/**
 * ExercisesPage — standalone page for managing exercises and their muscle tags.
 * Accessible via /exercises (gear icon on Trends → Exercise Progress).
 * No overlays or sheets — just a normal scrollable page.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Exercise, ExerciseMuscle, MuscleGroupDef } from "@/types/trends";

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
const MACRO_OPTIONS = ["push", "pull", "legs", "abs", "other"] as const;

/** Get the primary macro group for an exercise */
function primaryMacro(ex: Exercise): string {
  const primary = ex.muscles?.find((m) => m.is_primary);
  if (primary) return primary.macro_group;
  const CATEGORY_TO_MACRO: Record<string, string> = {
    chest: "push", shoulders: "push", arms: "push",
    back: "pull", legs: "legs", core: "abs", other: "other",
  };
  return CATEGORY_TO_MACRO[ex.category] ?? "other";
}

// ── Inline Edit Panel ──────────────────────────────────────────────
function ExerciseEditor({
  exercise,
  allGroups,
  onSave,
  onCancel,
  onGroupCreated,
}: {
  exercise: Exercise;
  allGroups: MuscleGroupDef[];
  onSave: (updated: Exercise) => void;
  onCancel: () => void;
  onGroupCreated: (g: MuscleGroupDef) => void;
}) {
  const [muscles, setMuscles] = useState<ExerciseMuscle[]>(exercise.muscles ?? []);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMacro, setNewGroupMacro] = useState("other");
  const [error, setError] = useState<string | null>(null);

  const togglePrimary = (idx: number) => {
    setMuscles((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, is_primary: !m.is_primary } : m))
    );
  };

  const removeTag = (idx: number) => {
    setMuscles((prev) => prev.filter((_, i) => i !== idx));
  };

  const addGroup = (group: MuscleGroupDef) => {
    if (muscles.some((m) => m.muscle_group === group.name)) return;
    setMuscles((prev) => [
      ...prev,
      { muscle_group: group.name, macro_group: group.macro_group, is_primary: true },
    ]);
    setShowAdd(false);
  };

  const createAndAddGroup = async () => {
    const name = newGroupName.trim().toLowerCase();
    if (!name) return;
    try {
      const created = await apiFetch<MuscleGroupDef>("/api/muscle-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, macro_group: newGroupMacro }),
      });
      onGroupCreated(created);
      addGroup(created);
      setShowNewGroup(false);
      setNewGroupName("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create group");
    }
  };

  const handleSave = async () => {
    if (muscles.length === 0) {
      setError("At least one muscle group required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<Exercise>(`/api/exercises/${exercise.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          muscles: muscles.map((m) => ({
            muscle_group: m.muscle_group,
            is_primary: m.is_primary,
          })),
        }),
      });
      onSave(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const availableGroups = allGroups.filter(
    (g) => !muscles.some((m) => m.muscle_group === g.name)
  );

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--ochre)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        marginBottom: "var(--space-sm)",
      }}
    >
      {/* Exercise name */}
      <div style={{
        font: "500 14px/1 'JetBrains Mono',monospace",
        color: "var(--ochre)",
        marginBottom: "var(--space-md)",
      }}>
        {exercise.name}
      </div>

      {/* Current tags */}
      <div style={{
        font: "500 10px/1 'Inter',sans-serif",
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        marginBottom: "var(--space-xs)",
      }}>
        Muscle Groups
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
        {muscles.map((m, idx) => (
          <div
            key={m.muscle_group}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              padding: "10px 12px",
              background: "var(--bg-primary)",
              border: `1px solid ${MACRO_COLOURS[m.macro_group] ?? "#666"}44`,
              borderRadius: "var(--radius-sm)",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: MACRO_COLOURS[m.macro_group] ?? "#666", flexShrink: 0 }} />
            <span style={{ font: "500 13px/1 'Inter',sans-serif", color: "var(--text-primary)", flex: 1 }}>
              {m.muscle_group}
            </span>
            <span style={{ font: "500 10px/1 'Inter',sans-serif", color: MACRO_COLOURS[m.macro_group] ?? "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {m.macro_group}
            </span>
            <button
              onClick={() => togglePrimary(idx)}
              style={{
                background: m.is_primary ? (MACRO_COLOURS[m.macro_group] ?? "#666") : "transparent",
                border: `1px solid ${MACRO_COLOURS[m.macro_group] ?? "#666"}`,
                borderRadius: "var(--radius-sm)",
                padding: "4px 8px",
                font: "600 10px/1 'Inter',sans-serif",
                color: m.is_primary ? "#fff" : (MACRO_COLOURS[m.macro_group] ?? "#666"),
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                minWidth: 52,
              }}
            >
              {m.is_primary ? "Major" : "Minor"}
            </button>
            <button
              onClick={() => removeTag(idx)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {muscles.length === 0 && (
          <div style={{ font: "400 13px/1.4 'Inter',sans-serif", color: "var(--text-muted)", padding: "8px 0" }}>
            No muscle groups assigned. Add one below.
          </div>
        )}
      </div>

      {/* Add group */}
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: "flex", alignItems: "center", gap: "var(--space-xs)",
            background: "none", border: "1px dashed var(--border-default)",
            borderRadius: "var(--radius-sm)", padding: "10px 12px",
            color: "var(--text-muted)", font: "500 13px/1 'Inter',sans-serif",
            cursor: "pointer", width: "100%",
          }}
        >
          <Plus size={14} /> Add muscle group
        </button>
      ) : (
        <div style={{
          background: "var(--bg-primary)", border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-sm)", overflow: "hidden", marginBottom: "var(--space-sm)",
        }}>
          {availableGroups.map((g) => (
            <button
              key={g.id}
              onClick={() => addGroup(g)}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-sm)",
                width: "100%", padding: "10px 12px", background: "none",
                border: "none", borderBottom: "1px solid var(--border-default)",
                color: "var(--text-primary)", font: "500 13px/1 'Inter',sans-serif",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: MACRO_COLOURS[g.macro_group] ?? "#666" }} />
              {g.name}
              <span style={{ marginLeft: "auto", font: "400 10px/1 'Inter',sans-serif", color: "var(--text-muted)", textTransform: "uppercase" }}>
                {g.macro_group}
              </span>
            </button>
          ))}

          {!showNewGroup ? (
            <button
              onClick={() => setShowNewGroup(true)}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-xs)",
                width: "100%", padding: "10px 12px", background: "none",
                border: "none", color: "var(--ochre)", font: "500 13px/1 'Inter',sans-serif", cursor: "pointer",
              }}
            >
              <Plus size={14} /> Create new group
            </button>
          ) : (
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g. glutes, forearms..."
                style={{
                  background: "var(--bg-card)", border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-sm)", color: "var(--text-primary)",
                  font: "500 13px/1 'Inter',sans-serif", padding: "8px 10px",
                  width: "100%", boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                {MACRO_OPTIONS.map((macro) => (
                  <button
                    key={macro}
                    onClick={() => setNewGroupMacro(macro)}
                    style={{
                      padding: "4px 10px", borderRadius: "var(--radius-sm)",
                      border: `1px solid ${MACRO_COLOURS[macro]}`,
                      background: newGroupMacro === macro ? MACRO_COLOURS[macro] : "transparent",
                      color: newGroupMacro === macro ? "#fff" : MACRO_COLOURS[macro],
                      font: "600 10px/1 'Inter',sans-serif", cursor: "pointer",
                      textTransform: "uppercase", letterSpacing: "0.5px",
                    }}
                  >
                    {macro}
                  </button>
                ))}
              </div>
              <button
                onClick={createAndAddGroup}
                disabled={!newGroupName.trim()}
                style={{
                  padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "none",
                  background: "var(--ochre)", color: "#fff", font: "600 12px/1 'Inter',sans-serif",
                  cursor: newGroupName.trim() ? "pointer" : "not-allowed",
                  opacity: newGroupName.trim() ? 1 : 0.5,
                }}
              >
                Create & Add
              </button>
            </div>
          )}

          <button
            onClick={() => { setShowAdd(false); setShowNewGroup(false); }}
            style={{
              width: "100%", padding: "8px", background: "none", border: "none",
              color: "var(--text-muted)", font: "400 11px/1 'Inter',sans-serif", cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div style={{ font: "400 12px/1.3 'Inter',sans-serif", color: "var(--signal-bad)", marginTop: "var(--space-sm)" }}>
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: "12px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-default)", background: "none",
            color: "var(--text-muted)", font: "600 13px/1 'Inter',sans-serif", cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1, padding: "12px", borderRadius: "var(--radius-sm)",
            border: "none", background: "var(--ochre)", color: "#fff",
            font: "600 13px/1 'Inter',sans-serif",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────
export default function ExercisesPage() {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [allGroups, setAllGroups] = useState<MuscleGroupDef[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Exercise[]>("/api/exercises")
      .then(setExercises)
      .catch(() => { setExercises([]); setError("Failed to load exercises"); });
    apiFetch<MuscleGroupDef[]>("/api/muscle-groups")
      .then(setAllGroups)
      .catch(() => {});
  }, []);

  const handleSave = (updated: Exercise) => {
    setExercises((prev) =>
      prev?.map((ex) => (ex.id === updated.id ? updated : ex)) ?? null
    );
    setEditingId(null);
  };

  // Group by macro
  const grouped: Record<string, Exercise[]> = {};
  for (const ex of exercises ?? []) {
    const macro = primaryMacro(ex);
    (grouped[macro] ??= []).push(ex);
  }

  return (
    <div style={{ padding: "var(--space-md)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-lg)" }}>
        <button
          onClick={() => navigate("/trends")}
          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ font: "600 18px/1.2 'Inter',sans-serif", color: "var(--text-primary)", margin: 0 }}>
          Manage Exercises
        </h2>
      </div>

      <p style={{ font: "400 13px/1.4 'Inter',sans-serif", color: "var(--text-muted)", marginBottom: "var(--space-lg)", marginTop: 0 }}>
        Tap an exercise to edit its muscle group tags. This controls which category it appears under in Trends.
      </p>

      {error && (
        <div style={{ font: "400 13px/1.3 'Inter',sans-serif", color: "var(--signal-bad)", marginBottom: "var(--space-md)" }}>
          {error}
        </div>
      )}

      {exercises === null ? (
        <div style={{ font: "400 13px/1.4 'Inter',sans-serif", color: "var(--text-muted)", padding: "20px 0", textAlign: "center" }}>
          Loading...
        </div>
      ) : exercises.length === 0 && !error ? (
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
              <div style={{
                font: "600 11px/1 'Inter',sans-serif", letterSpacing: "0.5px",
                textTransform: "uppercase", color: MACRO_COLOURS[macro],
                marginBottom: "var(--space-sm)", display: "flex",
                alignItems: "center", gap: "var(--space-xs)",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: MACRO_COLOURS[macro] }} />
                {MACRO_LABELS[macro]} ({items.length})
              </div>

              {/* Exercise rows */}
              {items.map((ex) =>
                editingId === ex.id ? (
                  <ExerciseEditor
                    key={ex.id}
                    exercise={ex}
                    allGroups={allGroups}
                    onSave={handleSave}
                    onCancel={() => setEditingId(null)}
                    onGroupCreated={(g) => setAllGroups((prev) => [...prev, g])}
                  />
                ) : (
                  <button
                    key={ex.id}
                    onClick={() => setEditingId(ex.id)}
                    style={{
                      display: "flex", alignItems: "center", width: "100%",
                      padding: "12px", background: "var(--bg-card)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-sm)",
                      marginBottom: "var(--space-xs)", cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{ font: "500 13px/1.2 'Inter',sans-serif", color: "var(--text-primary)", flex: 1 }}>
                      {ex.name}
                    </span>

                    {/* Muscle chips */}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {(ex.muscles ?? []).map((m) => (
                        <span
                          key={m.muscle_group}
                          style={{
                            font: "500 9px/1 'Inter',sans-serif", padding: "3px 6px",
                            borderRadius: 4,
                            background: `${MACRO_COLOURS[m.macro_group] ?? "#666"}22`,
                            color: MACRO_COLOURS[m.macro_group] ?? "#666",
                            textTransform: "uppercase", letterSpacing: "0.3px",
                            opacity: m.is_primary ? 1 : 0.6,
                          }}
                        >
                          {m.muscle_group}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              )}
            </div>
          );
        })
      )}

      {/* Bottom spacer for tab bar */}
      <div style={{ height: 24 }} />
    </div>
  );
}
