/**
 * ActivityEditSheet — generic edit form for activity_logs, sleep_logs, sauna_logs.
 * Renders as a bottom sheet above DayDetailSheet (zIndex 120).
 */

import { useState } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";

/* ── Types ──────────────────────────────────────────────────────────────── */

export type EditableType = "activity" | "sleep" | "sauna";

interface ActivityInit {
  duration_mins?: number | null;
  avg_hr?: number | null;
  min_hr?: number | null;
  max_hr?: number | null;
  distance_km?: number | null;
  avg_pace_secs?: number | null;
  calories_burned?: number | null;
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

export type EditInit = ActivityInit | SleepInit | SaunaInit;

interface Props {
  type: EditableType;
  id: number;
  label: string; // e.g. "Run", "Sleep", "Sauna"
  init: EditInit;
  onSave: () => void;
  onClose: () => void;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function numField(
  label: string,
  key: string,
  value: string,
  onChange: (k: string, v: string) => void,
  placeholder: string,
  step = "1",
  unit?: string
) {
  return (
    <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{
        font: "500 10px/1 'Inter',sans-serif",
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}>
        {label}{unit ? ` (${unit})` : ""}
      </label>
      <input
        type="number"
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(key, e.target.value)}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-sm)",
          color: "var(--text-primary)",
          font: "500 14px/1 'JetBrains Mono',monospace",
          padding: "10px 12px",
          width: "100%",
          boxSizing: "border-box" as const,
        }}
      />
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────────────── */

export default function ActivityEditSheet({ type, id, label, init, onSave, onClose }: Props) {
  // Flatten init to string-valued form state
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(init)) {
      if (v != null && v !== undefined) out[k] = String(v);
    }
    return out;
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

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Build payload — only include filled fields
      const body: Record<string, number | boolean | string> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v.trim() === "") continue;
        const n = parseFloat(v);
        if (!isNaN(n)) body[k] = n;
      }
      if (type === "sauna") {
        body.did_breathing = breathing;
        body.did_devotions = devotions;
      }

      const endpoint =
        type === "activity"
          ? `/api/activity-logs/${id}`
          : type === "sleep"
          ? `/api/sleep/${id}`
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
            {numField("Duration", "duration_mins", fields.duration_mins ?? "", set, "e.g. 45", "1", "min")}
            {numField("Distance", "distance_km", fields.distance_km ?? "", set, "e.g. 5.2", "0.01", "km")}
            {numField("Avg Pace", "avg_pace_secs", fields.avg_pace_secs ?? "", set, "e.g. 330", "1", "sec/km")}
            {numField("Avg HR", "avg_hr", fields.avg_hr ?? "", set, "e.g. 145", "1", "bpm")}
            {numField("Min HR", "min_hr", fields.min_hr ?? "", set, "e.g. 110", "1", "bpm")}
            {numField("Max HR", "max_hr", fields.max_hr ?? "", set, "e.g. 175", "1", "bpm")}
            {numField("Calories burned", "calories_burned", fields.calories_burned ?? "", set, "e.g. 520", "1", "kcal")}
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
