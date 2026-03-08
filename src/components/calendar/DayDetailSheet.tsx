import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import type { CategoryDot } from "@/types/calendar";
import { CATEGORY_LABELS, CATEGORY_COLORS, SUB_TOGGLE_DEFS } from "@/types/calendar";
import { apiFetch } from "@/lib/api";

/* ─── Domain types ───────────────────────────────────────────────────── */
type RawSession = {
  id: number;
  session_date: string;
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
};

type SessionDetail = {
  id: number;
  split: string;
  bodyAreas: string[];
  totalSets: number;
  totalReps: number;
  totalLoadKg: number;
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

function fmtLoad(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const DAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MON = ["January","February","March","April","May","June","July",
               "August","September","October","November","December"];
  return `${DAY[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`;
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
};

/* ─── Component ──────────────────────────────────────────────────────── */
export default function DayDetailSheet({ date, dots, onClose }: Props) {
  const [sessions, setSessions]               = useState<SessionDetail[]>([]);
  const [loadingStrength, setLoadingStrength] = useState(false);
  const [expandedKey, setExpandedKey]         = useState<string | null>(null);
  const [showEx, setShowEx]                   = useState<Record<number, boolean>>({});

  const hasStrength = dots.some((d) => d.category === "strength");

  /* Reset state + auto-expand first card when date changes */
  useEffect(() => {
    setSessions([]);
    setShowEx({});
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

        /* Prefer sessions with exercises logged; fall back to all.
           (activity_log_id is null for all sessions currently, so can't use that.) */
        const withEx = rawSessions.filter((s) => s.exercises.length > 0);
        const sessionsToUse = withEx.length > 0 ? withEx : rawSessions;

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
            const entry = histMap.get(ex.id)?.find(
              (h) => h.session_date.slice(0, 10) === date
            );
            if (!entry) return;
            rows.push({
              name,
              sets: entry.sets,
              totalReps: entry.total_reps,
              topWeightKg: entry.top_weight_kg,
              usesBodyweight: ex.uses_bodyweight,
            });
          });
          return {
            id: s.id,
            split: deriveSplit(s.exercises),
            bodyAreas: deriveBodyAreas(s.exercises),
            totalSets: s.total_sets,
            totalReps: s.total_reps,
            totalLoadKg: s.total_load_kg,
            rows,
          };
        });

        setSessions(details);
        if (details.length > 0) {
          setExpandedKey(`s-${details[0].id}`);
          setShowEx({ [details[0].id]: true });
        }
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
      >
        {/* Grab handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 14px" }} />

        {/* Date header */}
        <h3 style={{ font: "600 14px/1.3 'Inter',sans-serif", letterSpacing: "-0.3px", color: "var(--text-primary)", margin: "0 0 16px" }}>
          {formatDate(date)}
        </h3>

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
            const exVisible = showEx[s.id] ?? false;
            const TOTALS = [
              { val: String(s.totalSets), lbl: "Sets" },
              { val: String(s.totalReps), lbl: "Reps" },
              { val: fmtLoad(s.totalLoadKg), lbl: "Load" },
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

                    {/* Body area pills */}
                    {s.bodyAreas.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
                        {s.bodyAreas.map((a) => (
                          <span key={a} style={{
                            font: "500 9px/1 'Inter',sans-serif", letterSpacing: "0.3px", textTransform: "uppercase",
                            padding: "3px 7px", borderRadius: 20,
                            background: "rgba(255,255,255,0.05)",
                            color: "var(--text-secondary)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}>
                            {a}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Session totals */}
                    <div style={{ display: "flex", alignItems: "center", marginTop: 12 }}>
                      {TOTALS.map(({ val, lbl }, i) => (
                        <div key={lbl} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                          {i > 0 && (
                            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)", marginRight: 12, flexShrink: 0 }} />
                          )}
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{ font: "600 15px/1 'JetBrains Mono',monospace", color: "var(--text-primary)" }}>{val}</span>
                            <span style={{ font: "400 9px/1 'Inter',sans-serif", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>{lbl}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Exercise toggle + rows */}
                    {s.rows.length > 0 && (
                      <>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEx((p) => ({ ...p, [s.id]: !p[s.id] }));
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            cursor: "pointer",
                            borderTop: "1px solid rgba(255,255,255,0.05)",
                            marginTop: 12, paddingTop: 10,
                          }}
                        >
                          <span style={{
                            fontSize: 11, color: "var(--text-muted)",
                            display: "inline-block",
                            transform: exVisible ? "rotate(180deg)" : "none",
                            transition: "transform 0.2s",
                          }}>▾</span>
                          <span style={{ font: "500 10px/1 'Inter',sans-serif", letterSpacing: "0.3px", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            Exercises ({s.rows.length})
                          </span>
                        </div>

                        {exVisible && (
                          <div style={{ marginTop: 6 }}>
                            {s.rows.map((r, ri) => (
                              <div key={r.name} style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 28px 36px 54px",
                                gap: 4,
                                padding: "7px 0",
                                borderBottom: ri < s.rows.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                                alignItems: "center",
                              }}>
                                <span style={{ font: "400 11px/1.3 'Inter',sans-serif", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {r.name}
                                </span>
                                <span style={{ font: "500 10px/1 'JetBrains Mono',monospace", color: "var(--text-muted)", textAlign: "right" }}>
                                  {r.sets}×
                                </span>
                                <span style={{ font: "500 10px/1 'JetBrains Mono',monospace", color: "var(--text-primary)", textAlign: "right" }}>
                                  {r.totalReps}
                                </span>
                                <span style={{ font: "500 10px/1 'JetBrains Mono',monospace", color: "var(--text-primary)", textAlign: "right" }}>
                                  {fmtWeight(r.topWeightKg, r.usesBodyweight)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
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

                  {/* Effort pill */}
                  {dot.isLetsGo && (
                    <span style={{
                      font: "500 10px/1 'Inter',sans-serif",
                      padding: "3px 7px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.07)",
                      color: "var(--text-secondary)",
                      flexShrink: 0,
                    }}>
                      Let&rsquo;s Go
                    </span>
                  )}

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

                    {/* Sub-metric grid */}
                    {subEntries.length > 0 && (
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
