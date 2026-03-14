import { useState, useEffect, useRef } from "react";
import { EnergyIcon } from "@/components/log/MoodEnergyCard";
import type { CSSProperties } from "react";
import type { CategoryDot } from "@/types/calendar";
import { CATEGORY_LABELS, CATEGORY_COLORS, SUB_TOGGLE_DEFS } from "@/types/calendar";
import { apiFetch } from "@/lib/api";
import ActivityEditSheet from "@/components/ActivityEditSheet";
import type { EditableType, EditInit } from "@/components/ActivityEditSheet";

/* ─── Domain types ───────────────────────────────────────────────────── */
type RawSession = {
  id: number;
  session_date: string;
  session_datetime?: string | null;
  activity_log_id: number | null;
  duration_mins: number | null;
  total_sets: number;
  total_reps: number;
  total_load_kg: number;
  exercises: string[];
};

type RawExercise = { id: number; name: string; uses_bodyweight: boolean };

type HistoryEntry = {
  session_date: string;
  sets: number;
  total_reps: number;
  top_weight_kg: number;
};

type ExRow = {
  name: string;
  sets: number;
  totalReps: number;
  topWeightKg: number;
  usesBodyweight: boolean;
  isPb: boolean;
};

type SessionDetail = {
  id: number;
  activityLogId: number | null;
  sessionDatetime: string | null;
  split: string;
  bodyAreas: string[];
  totalSets: number;
  totalReps: number;
  totalLoadKg: number;
  durationMins: number | null;
  rows: ExRow[];
};

/* ─── Pure helpers ───────────────────────────────────────────────────── */
function parseEx(raw: string): { name: string; catStr: string } {
  const idx = raw.lastIndexOf(" - ");
  return idx === -1
    ? { name: raw, catStr: "" }
    : { name: raw.slice(0, idx), catStr: raw.slice(idx + 3) };
}

const PUSH_CATS = new Set(["chest", "shoulders", "arms", "triceps"]);
const PULL_CATS = new Set(["back", "biceps"]);
const LEG_CATS  = new Set(["legs", "glutes", "quads", "hamstrings", "calves"]);

function deriveSplit(exercises: string[]): string {
  let push = 0, pull = 0, legs = 0;
  exercises.forEach((e) => {
    const c = parseEx(e).catStr.toLowerCase();
    if (PUSH_CATS.has(c)) push++;
    else if (PULL_CATS.has(c)) pull++;
    else if (LEG_CATS.has(c)) legs++;
  });
  if (push >= pull && push >= legs && push > 0) return "Push";
  if (pull > 0 && pull >= legs) return "Pull";
  if (legs > 0) return "Legs";
  return "Session";
}

const AREA_MAP: Record<string, string> = {
  chest: "Chest", back: "Back", shoulders: "Shoulders",
  arms: "Arms", biceps: "Arms", triceps: "Arms",
  legs: "Legs", glutes: "Legs", quads: "Legs", hamstrings: "Legs", calves: "Legs",
  core: "Core", abs: "Core", other: "Other",
};

function deriveBodyAreas(exercises: string[]): string[] {
  const seen = new Set<string>();
  exercises.forEach((e) => {
    const a = AREA_MAP[parseEx(e).catStr.toLowerCase()];
    if (a) seen.add(a);
  });
  return Array.from(seen);
}

function fmtWeight(kg: number, bw: boolean): string {
  if (bw) return kg > 0 ? `BW +${kg}kg` : "BW";
  return kg > 0 ? `${kg}kg` : "–";
}


function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const DAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MON = ["January","February","March","April","May","June","July",
               "August","September","October","November","December"];
  return `${DAY[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")}${ampm}`;
}

/* ─── Style constants ────────────────────────────────────────────────── */
const CARD: CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: "var(--radius-md)",
  border: "1px solid rgba(255,255,255,0.06)",
  overflow: "hidden",
};

const SEP: CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.05)",
  margin: "0 -14px",
};

/* ─── Props ──────────────────────────────────────────────────────────── */
type Props = {
  date: string | null;
  dots: CategoryDot[];
  onClose: () => void;
  onSessionDeleted?: () => void;
  onNavigate?: (date: string) => void;
};

/* ─── Navigation helpers ─────────────────────────────────────────────── */
function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

/* ─── Component ──────────────────────────────────────────────────────── */
export default function DayDetailSheet({ date, dots, onClose, onSessionDeleted, onNavigate }: Props) {
  const [sessions, setSessions]               = useState<SessionDetail[]>([]);
  const [loadingStrength, setLoadingStrength] = useState(false);
  const [expandedKey, setExpandedKey]         = useState<string | null>(null);
  const [unlinking, setUnlinking]             = useState<number | null>(null);
  const [deletingId, setDeletingId]           = useState<number | null>(null);

  const touchStartX = useRef<number | null>(null);

  type EditTarget = { type: EditableType; id: number; label: string; init: EditInit } | null;
  const [editTarget, setEditTarget] = useState<EditTarget>(null);

  const hasStrength = dots.some((d) => d.category === "strength");

  /* Reset state + auto-expand first card when date changes */
  useEffect(() => {
    setSessions([]);
    setLoadingStrength(false);
    if (!hasStrength && dots.length > 0) {
      setExpandedKey(`d-${dots[0].category}`);
    } else {
      setExpandedKey(null);
    }
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Fetch strength sessions + exercise detail */
  useEffect(() => {
    if (!date || !hasStrength) return;
    let cancelled = false;
    (async () => {
      setLoadingStrength(true);
      try {
        const [rawSessions, allEx] = await Promise.all([
          apiFetch<RawSession[]>(
            `/api/strength/sessions?start_date=${date}&end_date=${date}&limit=10`
          ),
          apiFetch<RawExercise[]>("/api/exercises"),
        ]);
        if (cancelled) return;

        /* name → exercise lookup */
        const exMap = new Map<string, RawExercise>();
        allEx.forEach((e) => exMap.set(e.name.toLowerCase(), e));

        /* API date filter is unreliable — enforce client-side.
           Then prefer sessions that have exercises logged. */
        const onDate = rawSessions.filter((s) => s.session_date === date);
        const pool = onDate.length > 0 ? onDate : rawSessions;
        const withEx = pool.filter((s) => s.exercises.length > 0);
        const sessionsToUse = withEx.length > 0 ? withEx : pool;

        /* collect unique exercise IDs across sessions to show */
        const ids = new Set<number>();
        sessionsToUse.forEach((s) =>
          s.exercises.forEach((r) => {
            // Use full name (e.g. "ring skull crush - arms") — matches exMap key format
            const ex = exMap.get(r.toLowerCase());
            if (ex) ids.add(ex.id);
          })
        );

        /* fetch per-exercise histories in parallel */
        const histMap = new Map<number, HistoryEntry[]>();
        await Promise.all(
          Array.from(ids).map(async (id) => {
            const h = await apiFetch<HistoryEntry[]>(
              `/api/strength/exercise/${id}/history?days=90`
            );
            histMap.set(id, h);
          })
        );
        if (cancelled) return;

        /* build SessionDetail objects */
        const details: SessionDetail[] = sessionsToUse.map((s) => {
          const rows: ExRow[] = [];
          s.exercises.forEach((r) => {
            // Full name for lookup (matches exMap key); parseEx only for display name
            const ex = exMap.get(r.toLowerCase());
            if (!ex) return;
            const { name } = parseEx(r);
            const hist = histMap.get(ex.id) ?? [];
            const entry = hist.find((h) => h.session_date.slice(0, 10) === date);
            if (!entry) return;
            const allTimeMax = hist.reduce((m, h) => Math.max(m, h.top_weight_kg), 0);
            const isPb = !ex.uses_bodyweight && entry.top_weight_kg > 0 && entry.top_weight_kg >= allTimeMax;
            rows.push({
              name,
              sets: entry.sets,
              totalReps: entry.total_reps,
              topWeightKg: entry.top_weight_kg,
              usesBodyweight: ex.uses_bodyweight,
              isPb,
            });
          });
          return {
            id: s.id,
            activityLogId: s.activity_log_id,
            sessionDatetime: s.session_datetime ?? null,
            split: deriveSplit(s.exercises),
            bodyAreas: deriveBodyAreas(s.exercises),
            totalSets: s.total_sets,
            totalReps: s.total_reps,
            totalLoadKg: s.total_load_kg,
            durationMins: s.duration_mins ?? null,
            rows,
          };
        });

        setSessions(details);
        if (details.length > 0) setExpandedKey(`s-${details[0].id}`);
      } catch (err) {
        console.error("[DayDetailSheet] fetch error:", err);
      } finally {
        if (!cancelled) setLoadingStrength(false);
      }
    })();
    return () => { cancelled = true; };
  }, [date, hasStrength]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!date) return null;

  const toggle = (key: string) =>
    setExpandedKey((prev) => (prev === key ? null : key));

  const handleUnlink = async (sessionId: number) => {
    setUnlinking(sessionId);
    try {
      await apiFetch(`/api/strength/sessions/${sessionId}/unlink`, { method: "PATCH" });
      setSessions((prev) =>
        prev.map((s) => s.id === sessionId ? { ...s, activityLogId: null } : s)
      );
    } catch (err) {
      console.error("[DayDetailSheet] unlink error:", err);
    } finally {
      setUnlinking(null);
    }
  };

  const handleDelete = async (sessionId: number) => {
    if (!window.confirm('Delete this strength session?')) return;
    setDeletingId(sessionId);
    try {
      await apiFetch(`/api/strength/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      onSessionDeleted?.();
    } catch (err) {
      console.error('[DayDetailSheet] delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const SCOL = CATEGORY_COLORS.strength;
  const nonStrengthDots = dots.filter((d) => d.category !== "strength");

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 110,
          animation: "fadeInDD 200ms ease",
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          zIndex: 111,
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          padding: "12px 16px 56px",
          maxHeight: "82vh",
          overflowY: "auto",
          animation: "slideUpDD 300ms cubic-bezier(0.34,1.4,0.64,1)",
        }}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null || !onNavigate || !date) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(dx) < 60) return;
          onNavigate(offsetDate(date, dx < 0 ? 1 : -1));
        }}
      >
        {/* Grab handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 14px" }} />

        {/* Date header with navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          {onNavigate && date && (
            <button
              onClick={() => onNavigate(offsetDate(date, -1))}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", fontSize: 18, padding: "0 4px",
                lineHeight: 1, flexShrink: 0,
              }}
            >
              ‹
            </button>
          )}
          <h3 style={{ font: "600 14px/1.3 'Inter',sans-serif", letterSpacing: "-0.3px", color: "var(--text-primary)", margin: 0, flex: 1 }}>
            {formatDate(date)}
          </h3>
          {onNavigate && date && (
            <button
              onClick={() => onNavigate(offsetDate(date, 1))}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", fontSize: 18, padding: "0 4px",
                lineHeight: 1, flexShrink: 0,
              }}
            >
              ›
            </button>
          )}
        </div>

        {/* Card stack */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

          {/* ── Strength loading placeholder ── */}
          {hasStrength && loadingStrength && (
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                <div style={{ width: 3, height: 32, borderRadius: 2, background: SCOL, flexShrink: 0 }} />
                <span style={{ font: "700 10px/1 'Inter',sans-serif", letterSpacing: "1.2px", textTransform: "uppercase", color: SCOL }}>
                  Strength
                </span>
                <span style={{ font: "400 11px/1 'Inter',sans-serif", color: "var(--text-muted)", marginLeft: 8 }}>
                  Loading…
                </span>
              </div>
            </div>
          )}

          {/* ── Strength session cards ── */}
          {sessions.map((s) => {
            const key = `s-${s.id}`;
            const expanded = expandedKey === key;
            const TOTALS = [
              { val: String(s.totalSets), lbl: "Sets" },
              { val: String(s.totalReps), lbl: "Reps" },
              { val: Math.round(s.totalLoadKg).toLocaleString(), lbl: "Volume" },
            ];

            return (
              <div key={key} style={CARD}>

                {/* Card header */}
                <div
                  onClick={() => toggle(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: expanded ? "12px 14px 10px" : "11px 14px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ width: 3, alignSelf: "stretch", minHeight: 20, borderRadius: 2, background: SCOL, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ font: "700 10px/1 'Inter',sans-serif", letterSpacing: "1.2px", textTransform: "uppercase", color: SCOL, flexShrink: 0 }}>
                      Strength
                    </span>
                    <span style={{
                      font: "600 9px/1 'Inter',sans-serif", letterSpacing: "0.5px", textTransform: "uppercase",
                      padding: "3px 7px", borderRadius: 20,
                      border: `1px solid ${SCOL}`, color: SCOL, opacity: 0.85, flexShrink: 0,
                    }}>
                      {s.split}
                    </span>
                    {s.sessionDatetime && (
                      <span style={{ font: "500 10px/1 'JetBrains Mono',monospace", color: "var(--text-muted)", flexShrink: 0 }}>
                        {formatTime(s.sessionDatetime)}
                      </span>
                    )}
                  </div>
                  {!expanded && (
                    <span style={{ font: "500 10px/1 'JetBrains Mono',monospace", color: "var(--text-muted)", flexShrink: 0 }}>
                      {s.totalSets} sets
                    </span>
                  )}
                  <span style={{
                    fontSize: 11, color: "var(--text-muted)",
                    display: "inline-block",
                    transform: expanded ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                    flexShrink: 0, marginLeft: 4,
                  }}>▾</span>
                </div>

                {/* Expanded body */}
                {expanded && (
                  <div style={{ padding: "0 14px 14px" }}>
                    <div style={SEP} />

                    {/* Area chips */}
                    {s.bodyAreas.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
                        {s.bodyAreas.map((a) => (
                          <span key={a} style={{
                            font: "500 9px/1 'Inter',sans-serif", letterSpacing: "0.4px", textTransform: "uppercase",
                            padding: "3px 8px", borderRadius: 100,
                            background: "rgba(180,112,80,0.15)",
                            border: "1px solid rgba(180,112,80,0.25)",
                            color: "var(--rust)",
                          }}>
                            {a}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      {s.activityLogId !== null && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const splitKey = s.split === "Push" ? "push"
                              : s.split === "Pull" ? "pull"
                              : s.split === "Legs" ? "legs"
                              : null;
                            setEditTarget({
                              type: "workout",
                              id: s.activityLogId!,
                              label: "Workout",
                              init: {
                                workout_split: splitKey as "push" | "pull" | "legs" | null,
                                duration_mins: s.durationMins,
                                started_at: s.sessionDatetime,
                                activity_date: date,
                              },
                            });
                          }}
                          style={{
                            flex: 1,
                            font: "500 10px/1 'Inter',sans-serif",
                            letterSpacing: "0.3px",
                            padding: "7px 10px",
                            borderRadius: 6,
                            border: "1px solid var(--border-default)",
                            background: "transparent",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(s.id);
                        }}
                        disabled={deletingId === s.id}
                        style={{
                          flex: 1,
                          font: "500 10px/1 'Inter',sans-serif",
                          letterSpacing: "0.3px",
                          padding: "7px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--signal-bad)",
                          background: "transparent",
                          color: "var(--signal-bad)",
                          cursor: deletingId === s.id ? "wait" : "pointer",
                          opacity: deletingId === s.id ? 0.5 : 1,
                        }}
                      >
                        {deletingId === s.id ? "Deleting…" : "Delete session"}
                      </button>
                      {s.activityLogId !== null && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnlink(s.id);
                          }}
                          disabled={unlinking === s.id}
                          style={{
                            flex: 1,
                            font: "500 10px/1 'Inter',sans-serif",
                            letterSpacing: "0.3px",
                            padding: "7px 10px",
                            borderRadius: 6,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(255,255,255,0.04)",
                            color: "var(--text-muted)",
                            cursor: unlinking === s.id ? "wait" : "pointer",
                            opacity: unlinking === s.id ? 0.5 : 1,
                          }}
                        >
                          {unlinking === s.id ? "Unlinking…" : "Unlink Withings"}
                        </button>
                      )}
                    </div>

                    {/* Totals row */}
                    <div style={{
                      display: "flex",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      overflow: "hidden",
                      marginTop: 12,
                    }}>
                      {TOTALS.map(({ val, lbl }, i) => (
                        <div key={lbl} style={{
                          flex: 1, padding: "9px 10px",
                          display: "flex", flexDirection: "column", gap: 3,
                          borderLeft: i > 0 ? "1px solid var(--border-default)" : undefined,
                        }}>
                          <span style={{ font: "700 15px/1 'JetBrains Mono',monospace", letterSpacing: "-0.5px", color: "var(--text-primary)" }}>{val}</span>
                          <span style={{ font: "500 9px/1 'Inter',sans-serif", letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--text-muted)" }}>{lbl}</span>
                        </div>
                      ))}
                    </div>

                    {/* Exercise table */}
                    {s.rows.length > 0 && (
                      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ font: "600 9px/1 'Inter',sans-serif", letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--text-muted)", padding: "0 0 6px", textAlign: "left", borderBottom: "1px solid var(--border-default)" }}>Exercise</th>
                            <th style={{ font: "600 9px/1 'Inter',sans-serif", letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--text-muted)", padding: "0 0 6px", textAlign: "right", width: 28, borderBottom: "1px solid var(--border-default)" }}>Sets</th>
                            <th style={{ font: "600 9px/1 'Inter',sans-serif", letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--text-muted)", padding: "0 0 6px", textAlign: "right", width: 32, borderBottom: "1px solid var(--border-default)" }}>Reps</th>
                            <th style={{ font: "600 9px/1 'Inter',sans-serif", letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--text-muted)", padding: "0 0 6px", textAlign: "right", width: 52, borderBottom: "1px solid var(--border-default)" }}>Top</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.rows.map((r, ri) => (
                            <tr key={r.name}>
                              <td style={{ padding: "7px 0", borderBottom: ri < s.rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : undefined, verticalAlign: "middle" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: r.isPb ? "var(--ochre)" : "transparent" }} />
                                  <span style={{
                                    font: "400 12px/1.3 'Inter',sans-serif",
                                    color: r.isPb ? "var(--ochre)" : "var(--text-secondary)",
                                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                    maxWidth: 155,
                                  }}>
                                    {r.name}
                                  </span>
                                </div>
                              </td>
                              <td style={{ font: "500 11px/1 'JetBrains Mono',monospace", color: "var(--text-muted)", textAlign: "right", padding: "7px 0 7px 4px", width: 28, borderBottom: ri < s.rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
                                {r.sets}×
                              </td>
                              <td style={{ font: "500 11px/1 'JetBrains Mono',monospace", color: "var(--text-secondary)", textAlign: "right", width: 32, padding: "7px 0", borderBottom: ri < s.rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
                                {r.totalReps}
                              </td>
                              <td style={{ font: "500 11px/1 'JetBrains Mono',monospace", color: "var(--text-secondary)", textAlign: "right", width: 52, padding: "7px 0", borderBottom: ri < s.rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
                                {fmtWeight(r.topWeightKg, r.usesBodyweight)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Non-strength dot cards ── */}
          {nonStrengthDots.map((dot) => {
            const key = `d-${dot.category}`;
            const alwaysOpen = dot.category === "sauna";
            const expanded = alwaysOpen || expandedKey === key;
            const color = CATEGORY_COLORS[dot.category] ?? "#888";
            const label = CATEGORY_LABELS[dot.category] ?? dot.category;

            // Sub-metric entries from SUB_TOGGLE_DEFS
            const subDefs = SUB_TOGGLE_DEFS[dot.category] ?? [];
            const subEntries = subDefs
              .map(({ id, label: lbl }) => ({ lbl, val: dot.subMetrics?.[id] }))
              .filter((e): e is { lbl: string; val: string } => Boolean(e.val));

            // Stat block groups for running/ride (horizontal bordered layout)
            const isRunRide = dot.category === "running" || dot.category === "ride";
            const statGroups: Array<Array<{ val: string; lbl: string }>> = isRunRide
              ? (dot.category === "running"
                ? [
                    [
                      ...(dot.subMetrics?.dist ? [{ val: dot.subMetrics.dist, lbl: "dist" }] : []),
                      ...(dot.subMetrics?.pace ? [{ val: dot.subMetrics.pace, lbl: "pace" }] : []),
                    ],
                    [
                      ...(dot.subMetrics?.time ? [{ val: dot.subMetrics.time, lbl: "time" }] : []),
                      ...(dot.subMetrics?.bpm ? [{ val: dot.subMetrics.bpm, lbl: "bpm" }] : []),
                    ],
                  ].filter(g => g.length > 0)
                : [
                    [
                      ...(dot.subMetrics?.dist  ? [{ val: dot.subMetrics.dist,  lbl: "dist"  }] : []),
                      ...(dot.subMetrics?.speed ? [{ val: dot.subMetrics.speed, lbl: "speed" }] : []),
                    ],
                  ].filter(g => g.length > 0))
              : [];

            return (
              <div key={key} style={CARD}>
                {/* Card header */}
                <div
                  onClick={alwaysOpen ? undefined : () => toggle(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px",
                    cursor: alwaysOpen ? "default" : "pointer",
                  }}
                >
                  {/* Color stripe */}
                  <div style={{ width: 3, height: 36, borderRadius: 2, background: color, flexShrink: 0 }} />

                  {/* Label */}
                  <span style={{
                    font: "600 10px/1 'Inter',sans-serif",
                    letterSpacing: "0.6px",
                    textTransform: "uppercase",
                    color,
                    flexShrink: 0,
                  }}>
                    {label}
                  </span>

                  {/* Effort icon */}
                  {dot.isLetsGo && <EnergyIcon value={5} size={13} />}

                  {/* Interval badge */}
                  {dot.isInterval && (
                    <span style={{
                      font: "500 10px/1 'Inter',sans-serif",
                      padding: "3px 7px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.05)",
                      color: "var(--text-muted)",
                      flexShrink: 0,
                    }}>
                      Intervals
                    </span>
                  )}

                  {/* Sauna devotion badge */}
                  {dot.saunaHasDevotion && (
                    <span style={{
                      font: "500 10px/1 'Inter',sans-serif",
                      padding: "3px 7px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.05)",
                      color: "var(--text-muted)",
                      flexShrink: 0,
                    }}>
                      Devotions ✓
                    </span>
                  )}

                  <div style={{ flex: 1 }} />

                  {/* Primary value (collapsed only) */}
                  {!expanded && dot.duration && (
                    <span style={{
                      font: "500 11px/1 'JetBrains Mono',monospace",
                      color: "var(--text-muted)",
                      marginRight: 6,
                    }}>
                      {dot.duration}
                    </span>
                  )}

                  {/* Chevron — hidden for always-open cards */}
                  {!alwaysOpen && (
                    <span style={{
                      fontSize: 13,
                      color: "var(--text-muted)",
                      display: "inline-block",
                      transform: expanded ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s",
                    }}>▾</span>
                  )}
                </div>

                {/* Expanded body */}
                {expanded && (subEntries.length > 0 || dot.duration) && (
                  <div style={{ padding: "0 14px 14px" }}>
                    <div style={SEP} />

                    {/* Primary duration value (if no sub-metrics) */}
                    {dot.duration && subEntries.length === 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{
                          font: "500 9px/1 'Inter',sans-serif",
                          letterSpacing: "0.4px",
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          marginBottom: 3,
                        }}>Duration</div>
                        <div style={{ font: "600 18px/1 'Inter',sans-serif", color: "var(--text-primary)" }}>
                          {dot.duration}
                        </div>
                      </div>
                    )}

                    {/* Sub-metric blocks (running/ride) or grid (everything else) */}
                    {subEntries.length > 0 && (
                      isRunRide ? (
                        <div style={{ marginTop: 12 }}>
                          {statGroups.map((stats, gi) => (
                            <div key={gi} style={{
                              display: "flex",
                              marginBottom: gi < statGroups.length - 1 ? 8 : 0,
                              background: "var(--bg-card)",
                              borderRadius: "var(--radius-md)",
                              border: "1px solid var(--border-default)",
                              overflow: "hidden",
                            }}>
                              {stats.map((stat, i) => (
                                <div key={stat.lbl} style={{
                                  flex: 1, padding: "10px 14px",
                                  borderLeft: i > 0 ? "1px solid var(--border-default)" : "none",
                                  display: "flex", flexDirection: "column", gap: 3,
                                }}>
                                  <span style={{
                                    font: "700 15px/1 'JetBrains Mono',monospace",
                                    letterSpacing: "-0.5px", color: "var(--text-primary)",
                                  }}>{stat.val}</span>
                                  <span style={{
                                    font: "600 9px/1 'Inter',sans-serif",
                                    letterSpacing: "1px", textTransform: "uppercase",
                                    color: "var(--text-muted)",
                                  }}>{stat.lbl}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "10px 12px",
                          marginTop: 12,
                        }}>
                          {subEntries.map(({ lbl, val }) => (
                            <div key={lbl}>
                              <div style={{
                                font: "500 9px/1 'Inter',sans-serif",
                                letterSpacing: "0.4px",
                                textTransform: "uppercase",
                                color: "var(--text-muted)",
                                marginBottom: 3,
                              }}>
                                {lbl}
                              </div>
                              <div style={{
                                font: "600 14px/1 'Inter',sans-serif",
                                color: "var(--text-primary)",
                              }}>
                                {val}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}

                    {/* Edit button — only for categories with a record ID */}
                    {dot.recordId != null && (dot.category === "running" || dot.category === "ride" || dot.category === "strength" || dot.category === "sleep" || dot.category === "sauna") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const editType: EditableType =
                            dot.category === "sleep" ? "sleep"
                            : dot.category === "sauna" ? "sauna"
                            : "activity";
                          setEditTarget({
                            type: editType,
                            id: dot.recordId!,
                            label: CATEGORY_LABELS[dot.category],
                            init: {},
                          });
                        }}
                        style={{
                          marginTop: 12,
                          width: "100%",
                          font: "500 11px/1 'Inter',sans-serif",
                          letterSpacing: "0.3px",
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--border-default)",
                          background: "transparent",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        Edit details
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {dots.length === 0 && (
            <p style={{
              font: "400 13px/1.5 'Inter',sans-serif",
              color: "var(--text-muted)",
              textAlign: "center",
              padding: "32px 0",
              margin: 0,
            }}>
              No activity logged for this day.
            </p>
          )}
        </div>{/* card stack */}
      </div>{/* sheet */}

      {/* Edit sheet — renders above DayDetailSheet */}
      {editTarget && (
        <ActivityEditSheet
          type={editTarget.type}
          id={editTarget.id}
          label={editTarget.label}
          init={editTarget.init}
          onSave={() => { setEditTarget(null); onSessionDeleted?.(); }}
          onClose={() => setEditTarget(null)}
        />
      )}

      <style>{`
        @keyframes fadeInDD {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes slideUpDD {
          from { transform: translateY(100%) }
          to   { transform: translateY(0) }
        }
      `}</style>
    </>
  );
}
