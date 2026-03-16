/**
 * ActivityEditSheet — generic edit form for activity_logs, sleep_logs, sauna_logs.
 * Renders as a bottom sheet above DayDetailSheet (zIndex 120).
 */

import { useState } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";

/* ── Types ──────────────────────────────────────────────────────────────── */

export type EditableType = "activity" | "workout" | "sleep" | "sauna" | "strength_session";

interface ActivityInit {
  duration_mins?: number | null;
  avg_hr?: number | null;
  min_hr?: number | null;
  max_hr?: number | null;
  distance_km?: number | null;
  avg_pace_secs?: number | null;
  calories_burned?: number | null;
}

interface WorkoutInit {
  workout_split?: "push" | "pull" | "legs" | "abs" | null;
  duration_mins?: number | null;
  avg_hr?: number | null;
  min_hr?: number | null;
  max_hr?: number | null;
  calories_burned?: number | null;
  /** ISO datetime string with timezone — used to populate date + time fields */
  started_at?: string | null;
  activity_date?: string | null;
}

interface SleepInit {
  total_sleep_hrs?: number | null;
  deep_sleep_hrs?: number | null;
  light_sleep_hrs?: number | null;
  sleep_hr_avg?: number | null;
  sleep_score?: number | null;
}

interface SaunaInit {
  duration_mins?: number | null;
  temperature_c?: number | null;
  did_breathing?: boolean;
  did_devotions?: boolean;
}

interface StrengthSessionInit {
  session_label?: "push" | "pull" | "legs" | "abs" | null;
  duration_minutes?: number | null;
  started_at?: string | null;
}

export type EditInit = ActivityInit | WorkoutInit | SleepInit | SaunaInit | StrengthSessionInit;

interface Props {
  type: EditableType;
  id: number;
  label: string; // e.g. "Run", "Sleep", "Sauna"
  init: EditInit;
  onSave: () => void;
  onClose: () => void;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Convert total seconds to M:SS string, e.g. 316 → "5:16" */
function secsToMSS(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Parse M:SS string to total seconds, e.g. "5:16" → 316. Returns null if invalid. */
function mssToSecs(mss: string): number | null {
  const trimmed = mss.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(s) || s < 0 || s >= 60 || m < 0) return null;
  return m * 60 + s;
}

/** Convert decimal minutes to MM:SS string, e.g. 26.2 → "26:12" */
function minsToMMSS(mins: number): string {
  const m = Math.floor(mins);
  const s = Math.round((mins - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Parse MM:SS string to decimal minutes, e.g. "26:12" → 26.2. Returns null if invalid. */
function mmssToMins(mmss: string): number | null {
  const trimmed = mmss.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(s) || s < 0 || s >= 60 || m < 0) return null;
  return m + s / 60;
}

/** Calculate pace (secs/km) from duration (mins) and distance (km) */
function calcPace(durationMins: number, distanceKm: number): number | null {
  if (!distanceKm || distanceKm <= 0 || !durationMins || durationMins <= 0) return null;
  return (durationMins * 60) / distanceKm;
}

/** Estimate calories for running: simple ACSM-ish formula.
 *  With HR: cal ≈ duration_hrs × (avg_hr × 0.6309 − 55.0969) × 4.184 / 60 × duration_min
 *  Without HR: ~1 kcal/kg/km, assume 75kg → 75 × distance_km (rough) */
function calcCalories(durationMins: number, distanceKm: number, avgHr?: number): number | null {
  if (!durationMins || durationMins <= 0) return null;
  if (avgHr && avgHr > 0) {
    // Simplified formula: ~(duration_mins × (avgHr - 55) × 0.05)
    return Math.round(durationMins * (avgHr - 55) * 0.05);
  }
  if (distanceKm && distanceKm > 0) {
    return Math.round(distanceKm * 75);
  }
  return null;
}

const fieldStyle = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  font: "500 14px/1 'JetBrains Mono',monospace",
  padding: "10px 12px",
  width: "100%",
  boxSizing: "border-box" as const,
};

const labelStyle = {
  font: "500 10px/1 'Inter',sans-serif",
  letterSpacing: "0.5px",
  textTransform: "uppercase" as const,
  color: "var(--text-muted)",
};

const calcHintStyle = {
  font: "400 11px/1 'JetBrains Mono',monospace",
  color: "var(--ochre)",
  marginTop: 2,
};

function numField(
  label: string,
  key: string,
  value: string,
  onChange: (k: string, v: string) => void,
  placeholder: string,
  step = "1",
  unit?: string,
  hint?: string
) {
  return (
    <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={labelStyle}>
        {label}{unit ? ` (${unit})` : ""}
      </label>
      <input
        type="number"
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(key, e.target.value)}
        style={fieldStyle}
      />
      {hint && <span style={calcHintStyle}>{hint}</span>}
    </div>
  );
}

function durationField(
  value: string,
  onChange: (v: string) => void
) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={labelStyle}>Duration (mm:ss)</label>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder="e.g. 26:12"
        onChange={(e) => onChange(e.target.value)}
        style={fieldStyle}
      />
    </div>
  );
}

function paceField(
  value: string,
  onChange: (v: string) => void,
  calcPaceSecs: number | null
) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={labelStyle}>Pace (min/km)</label>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder={calcPaceSecs ? secsToMSS(calcPaceSecs) : "e.g. 5:16"}
        onChange={(e) => onChange(e.target.value)}
        style={fieldStyle}
      />
      {calcPaceSecs && (
        <span style={calcHintStyle}>
          calculated: {secsToMSS(calcPaceSecs)}/km
          {!value.trim() && " (will be used)"}
        </span>
      )}
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────────────── */

export default function ActivityEditSheet({ type, id, label, init, onSave, onClose }: Props) {
  // Flatten init to string-valued form state (exclude pace, duration, split, started_at — handled separately)
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(init)) {
      if (k === "avg_pace_secs" || k === "duration_mins" || k === "workout_split" || k === "started_at" || k === "activity_date") continue;
      if (v != null && v !== undefined) out[k] = String(v);
    }
    return out;
  });

  // Duration as MM:SS string for activity types (runs/rides)
  const [durationStr, setDurationStr] = useState(() => {
    const ai = init as ActivityInit;
    return ai.duration_mins ? minsToMMSS(ai.duration_mins) : "";
  });

  // Pace as M:SS string (separate from numeric fields)
  const [paceStr, setPaceStr] = useState(() => {
    const ai = init as ActivityInit;
    return ai.avg_pace_secs ? secsToMSS(ai.avg_pace_secs) : "";
  });

  // Workout split picker (shared by "workout" and "strength_session")
  const [workoutSplit, setWorkoutSplit] = useState<"push" | "pull" | "legs" | "abs" | null>(() => {
    if (type === "workout") return (init as WorkoutInit).workout_split ?? null;
    if (type === "strength_session") {
      const s = (init as StrengthSessionInit).session_label;
      return (s === "push" || s === "pull" || s === "legs" || s === "abs") ? s : null;
    }
    return null;
  });

  // "abs" split for strength_session only
  const [strengthSplit, setStrengthSplit] = useState<"push" | "pull" | "legs" | "abs" | null>(() => {
    if (type !== "strength_session") return null;
    return (init as StrengthSessionInit).session_label ?? null;
  });

  // Workout date + time fields (Brisbane local)
  const [workoutDate, setWorkoutDate] = useState(() => {
    if (type === "workout") {
      const wi = init as WorkoutInit;
      if (wi.activity_date) return wi.activity_date;
      if (wi.started_at) return new Date(wi.started_at).toLocaleDateString("en-CA");
      return "";
    }
    if (type === "strength_session") {
      const si = init as StrengthSessionInit;
      if (si.started_at) return new Date(si.started_at).toLocaleDateString("en-CA");
      return "";
    }
    return "";
  });
  const [workoutTime, setWorkoutTime] = useState(() => {
    if (type === "workout") {
      const wi = init as WorkoutInit;
      if (!wi.started_at) return "";
      const d = new Date(wi.started_at);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    if (type === "strength_session") {
      const si = init as StrengthSessionInit;
      if (!si.started_at) return "";
      const d = new Date(si.started_at);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return "";
  });

  // Workout duration as MM:SS (used for both "workout" and "strength_session")
  const [workoutDurStr, setWorkoutDurStr] = useState(() => {
    if (type === "workout") {
      const wi = init as WorkoutInit;
      return wi.duration_mins ? minsToMMSS(wi.duration_mins) : "";
    }
    if (type === "strength_session") {
      const si = init as StrengthSessionInit;
      return si.duration_minutes ? minsToMMSS(si.duration_minutes) : "";
    }
    return "";
  });

  // Boolean toggles for sauna
  const [breathing, setBreathing] = useState(
    type === "sauna" ? !!(init as SaunaInit).did_breathing : false
  );
  const [devotions, setDevotions] = useState(
    type === "sauna" ? !!(init as SaunaInit).did_devotions : false
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setFields((prev) => ({ ...prev, [k]: v }));

  // Derived calculated values for runs
  const durationMins = type === "activity" ? (mmssToMins(durationStr) ?? NaN) : parseFloat(fields.duration_mins ?? "");
  const distanceKm = parseFloat(fields.distance_km ?? "");
  const avgHr = parseFloat(fields.avg_hr ?? "");

  const calculatedPace = calcPace(durationMins, distanceKm);
  const calculatedCals = calcCalories(durationMins, distanceKm, avgHr || undefined);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Build payload — only include filled fields
      const body: Record<string, number | boolean | string> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (k === "avg_pace_secs") continue; // handled below
        if (k === "calories_burned" && v.trim() === "" && calculatedCals) {
          // Use calculated calories when field is empty
          body.calories_burned = calculatedCals;
          continue;
        }
        if (v.trim() === "") continue;
        const n = parseFloat(v);
        if (!isNaN(n)) body[k] = n;
      }

      // Handle duration: MM:SS → decimal minutes
      if (type === "activity") {
        const parsedDuration = mmssToMins(durationStr);
        if (parsedDuration !== null) {
          body.duration_mins = Math.round(parsedDuration * 100) / 100;
        }
      }

      // Handle pace: manual M:SS entry → convert to secs, else use calculated
      if (type === "activity") {
        const manualPace = mssToSecs(paceStr);
        if (manualPace !== null) {
          body.avg_pace_secs = manualPace;
        } else if (calculatedPace) {
          body.avg_pace_secs = Math.round(calculatedPace * 10) / 10;
        }
      }

      if (type === "sauna") {
        body.did_breathing = breathing;
        body.did_devotions = devotions;
      }

      if (type === "workout") {
        // Duration
        const parsedDur = mmssToMins(workoutDurStr);
        if (parsedDur !== null) body.duration_mins = Math.round(parsedDur * 100) / 100;
        // Split
        if (workoutSplit) body.workout_split = workoutSplit;
        // Date + time → started_at with Brisbane offset, activity_date
        if (workoutDate) {
          body.activity_date = workoutDate;
          const timeStr = workoutTime || "06:00";
          body.started_at = `${workoutDate}T${timeStr}:00+10:00`;
        }
      }

      if (type === "strength_session") {
        // Duration → integer minutes
        const parsedDur = mmssToMins(workoutDurStr);
        if (parsedDur !== null) body.duration_minutes = Math.round(parsedDur);
        // Split label
        if (strengthSplit) body.session_label = strengthSplit;
        // Date + time → session_datetime with Brisbane offset
        if (workoutDate) {
          const timeStr = workoutTime || "06:00";
          body.session_datetime = `${workoutDate}T${timeStr}:00+10:00`;
        }
      }

      const endpoint =
        type === "activity" || type === "workout"
          ? `/api/activity-logs/${id}`
          : type === "sleep"
          ? `/api/sleep/${id}`
          : type === "strength_session"
          ? `/api/strength/sessions/${id}`
          : `/api/sauna/${id}`;

      await apiFetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 119,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          zIndex: 120,
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          padding: "12px 16px 48px",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 16px" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ font: "700 16px/1 'Inter',sans-serif", color: "var(--text-primary)", flex: 1 }}>
            Edit {label}
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, display: "flex" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {type === "activity" && (<>
            {durationField(durationStr, setDurationStr)}
            {numField("Distance", "distance_km", fields.distance_km ?? "", set, "e.g. 5.58", "0.01", "km")}
            {paceField(paceStr, setPaceStr, calculatedPace)}
            {numField("Avg HR", "avg_hr", fields.avg_hr ?? "", set, "e.g. 145", "1", "bpm")}
            {numField("Min HR", "min_hr", fields.min_hr ?? "", set, "e.g. 110", "1", "bpm")}
            {numField("Max HR", "max_hr", fields.max_hr ?? "", set, "e.g. 175", "1", "bpm")}
            {numField(
              "Calories burned", "calories_burned", fields.calories_burned ?? "", set, "e.g. 520", "1", "kcal",
              calculatedCals && !fields.calories_burned?.trim()
                ? `estimated: ${calculatedCals} kcal (will be used)`
                : calculatedCals
                ? `estimated: ${calculatedCals} kcal`
                : undefined
            )}
          </>)}

          {type === "workout" && (<>
            {/* Split picker */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>Split</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["push", "pull", "legs", "abs"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setWorkoutSplit(workoutSplit === s ? null : s)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${workoutSplit === s ? "var(--ochre)" : "var(--border-default)"}`,
                      background: workoutSplit === s ? "rgba(212,160,74,0.15)" : "transparent",
                      color: workoutSplit === s ? "var(--ochre)" : "var(--text-muted)",
                      font: "600 12px/1 'Inter',sans-serif",
                      textTransform: "capitalize",
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Date + time */}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={workoutDate}
                  onChange={(e) => setWorkoutDate(e.target.value)}
                  style={fieldStyle}
                />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={labelStyle}>Time (Brisbane)</label>
                <input
                  type="time"
                  value={workoutTime}
                  onChange={(e) => setWorkoutTime(e.target.value)}
                  style={fieldStyle}
                />
              </div>
            </div>

            {durationField(workoutDurStr, setWorkoutDurStr)}
            {numField("Avg HR", "avg_hr", fields.avg_hr ?? "", set, "e.g. 145", "1", "bpm")}
            {numField("Min HR", "min_hr", fields.min_hr ?? "", set, "e.g. 110", "1", "bpm")}
            {numField("Max HR", "max_hr", fields.max_hr ?? "", set, "e.g. 175", "1", "bpm")}
            {numField("Calories burned", "calories_burned", fields.calories_burned ?? "", set, "e.g. 420", "1", "kcal")}
          </>)}

          {type === "strength_session" && (<>
            {/* Split picker — push/pull/legs/abs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>Split</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["push", "pull", "legs", "abs"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStrengthSplit(strengthSplit === s ? null : s)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${strengthSplit === s ? "var(--ochre)" : "var(--border-default)"}`,
                      background: strengthSplit === s ? "rgba(212,160,74,0.15)" : "transparent",
                      color: strengthSplit === s ? "var(--ochre)" : "var(--text-muted)",
                      font: "600 12px/1 'Inter',sans-serif",
                      textTransform: "capitalize",
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Date + time */}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={workoutDate}
                  onChange={(e) => setWorkoutDate(e.target.value)}
                  style={fieldStyle}
                />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={labelStyle}>Time (Brisbane)</label>
                <input
                  type="time"
                  value={workoutTime}
                  onChange={(e) => setWorkoutTime(e.target.value)}
                  style={fieldStyle}
                />
              </div>
            </div>

            {durationField(workoutDurStr, setWorkoutDurStr)}
          </>)}

          {type === "sleep" && (<>
            {numField("Total sleep", "total_sleep_hrs", fields.total_sleep_hrs ?? "", set, "e.g. 7.5", "0.1", "hrs")}
            {numField("Deep sleep", "deep_sleep_hrs", fields.deep_sleep_hrs ?? "", set, "e.g. 1.8", "0.1", "hrs")}
            {numField("Light sleep", "light_sleep_hrs", fields.light_sleep_hrs ?? "", set, "e.g. 4.2", "0.1", "hrs")}
            {numField("Avg sleep HR", "sleep_hr_avg", fields.sleep_hr_avg ?? "", set, "e.g. 52", "1", "bpm")}
            {numField("Sleep score", "sleep_score", fields.sleep_score ?? "", set, "e.g. 82", "1", "/100")}
          </>)}

          {type === "sauna" && (<>
            {numField("Duration", "duration_mins", fields.duration_mins ?? "", set, "e.g. 20", "1", "min")}
            {numField("Temperature", "temperature_c", fields.temperature_c ?? "", set, "e.g. 85", "1", "°C")}

            {/* Boolean toggles */}
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { label: "Breathing", val: breathing, set: setBreathing },
                { label: "Devotions", val: devotions, set: setDevotions },
              ].map(({ label: lbl, val, set: setFn }) => (
                <button
                  key={lbl}
                  onClick={() => setFn(!val)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${val ? "var(--ochre)" : "var(--border-default)"}`,
                    background: val ? "rgba(212,160,74,0.15)" : "transparent",
                    color: val ? "var(--ochre)" : "var(--text-muted)",
                    font: "600 12px/1 'Inter',sans-serif",
                    cursor: "pointer",
                  }}
                >
                  {lbl} {val ? "✓" : ""}
                </button>
              ))}
            </div>
          </>)}

          {error && (
            <div style={{ fontSize: 12, color: "var(--rust)", padding: "6px 10px", background: "rgba(196,90,74,0.1)", borderRadius: 6 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "13px",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: saving ? "var(--border-default)" : "var(--ochre)",
              color: saving ? "var(--text-muted)" : "var(--bg-base)",
              font: "700 14px/1 'Inter',sans-serif",
              cursor: saving ? "default" : "pointer",
              marginTop: 4,
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </>
  );
}
