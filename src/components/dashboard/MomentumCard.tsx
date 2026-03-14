import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MomentumData, MomentumSignal } from "@/hooks/useMomentum";
import useMomentumSignals from "@/hooks/useMomentumSignals";
import type { MomentumDay } from "@/hooks/useMomentumSignals";
import GoalDetailSheet from "./GoalDetailSheet";

interface Props {
  data: MomentumData;
}

function statusColor(status: string) {
  if (status === "on_track") return "#e8c47a";
  if (status === "improving") return "#d4a04a";
  return "#7FAABC";
}

function fmtValue(signal: MomentumSignal) {
  if (signal.today === null) return "—";
  const v = signal.today;
  if (signal.unit === "hrs") return v.toFixed(1);
  if (signal.unit === "bpm") return String(Math.round(v));
  if (signal.unit === "kg") return v.toFixed(1);
  if (signal.unit === "kcal") return String(Math.round(v));
  if (signal.unit === "g") return String(Math.round(v));
  if (signal.unit === "ml") return String(Math.round(v));
  return String(v);
}

function unitLabel(unit: string) {
  if (unit === "hrs") return "hr";
  return unit;
}

function fmtDeviation(signal: MomentumSignal) {
  if (signal.today === null || signal.baseline_28d === null) return "";
  const dev = signal.today - signal.baseline_28d;
  const prefix = dev >= 0 ? "+" : "";
  if (signal.unit === "hrs") return `${prefix}${dev.toFixed(1)} vs avg`;
  if (signal.unit === "bpm") return `${prefix}${Math.round(dev)} vs avg`;
  if (signal.unit === "kg") return `${prefix}${dev.toFixed(1)} vs avg`;
  return `${prefix}${Math.round(dev)} vs avg`;
}

// Fixed absolute scales per signal:
// Recovery: ±this value from target midpoint = full swing (contrib ±1)
// Strain:   this value = maximum expected load (contrib 1 = maximum drag)
const SIGNAL_ABS_SCALE: Record<keyof MomentumDay, number | undefined> = {
  date:             undefined,
  sleep_hrs:        2.0,   // recovery: ±2 hrs from target midpoint (8.25h)
  protein_g:        150,   // recovery: ±150g from target midpoint
  water_ml:         2000,  // recovery: ±2000ml from target midpoint
  calorie_balance:  600,   // recovery: ±600 kcal from target midpoint
  sleep_deficit:    2,     // strain: 0–2h range (2h = max drag)
  calorie_deficit:  800,   // strain: 0–800 kcal range
  non_exercise_hr:  20,    // strain: 0–20 bpm above ideal daytime HR
  // legacy fields — not used in chart
  rhr_bpm:          undefined,
  weight_kg:        undefined,
  calories_in:      undefined,
  calories_out:     undefined,
};

// Recovery: compare value to TARGET MIDPOINT (not 28d baseline).
// Baseline is pulled down by bad stretches — using it makes any decent night look exceptional.
// Target midpoint gives a stable, goal-anchored reference.
// Falls back to baseline when no target is configured.
function recSignalContrib(
  v: number,
  b: number | null,
  tMin: number | null,
  tMax: number | null,
  key: keyof MomentumDay
): number | null {
  const absScale = SIGNAL_ABS_SCALE[key];
  if (absScale === undefined || absScale === 0) return null;
  const ref = (tMin !== null && tMax !== null) ? (tMin + tMax) / 2 : b;
  if (ref === null) return null;
  return Math.max(-1, Math.min(1, (v - ref) / absScale));
}

// Strain: absolute load model — lower is always better, no baseline or user goal needed.
// 0 = no load (no drag on momentum), abs_scale = maximum expected value (full drag).
function strainAbsContrib(v: number, key: keyof MomentumDay): number {
  const absScale = SIGNAL_ABS_SCALE[key];
  if (!absScale) return 0;
  return Math.max(0, Math.min(1, v / absScale));
}

const RECOVERY_TOTAL    = 4;  // sleep_hrs, protein_g, water_ml, calorie_balance
const STRAIN_TOTAL      = 3;  // sleep_deficit, calorie_deficit, non_exercise_hr
const CHART_MULT        = 50; // recovery: all 4 signals maxed → score 100, none → 50
const CHART_STRAIN_MULT = 40; // strain: all 3 maxed → score 10, none → 50

function computeChartPoints(
  days: MomentumDay[],
  baselines: Record<string, number | null>,
  targets: Record<string, { min: number | null; max: number | null }>
) {
  return days.map((d) => {
    const recoveryFields = ["sleep_hrs", "protein_g", "water_ml", "calorie_balance"] as const;
    const strainFields   = ["sleep_deficit", "calorie_deficit", "non_exercise_hr"] as const;

    // Recovery: each signal scored vs target midpoint (falls back to baseline if no target)
    let recSum = 0;
    for (const key of recoveryFields) {
      const v = d[key];
      if (v === null) continue;
      const t = targets[key];
      const c = recSignalContrib(v, baselines[key] ?? null, t?.min ?? null, t?.max ?? null, key);
      if (c !== null) recSum += c;
    }

    // Strain: absolute load — 0=no drag, abs_scale=maximum drag. Null days are skipped.
    let strainSum = 0;
    let strainCount = 0;
    for (const key of strainFields) {
      const v = d[key];
      if (v === null) continue;
      strainSum += strainAbsContrib(v, key);
      strainCount++;
    }

    // Recovery: divide by TOTAL_SIGNALS so no single signal dominates
    const recovery = Math.max(0, Math.min(100, Math.round(50 + (recSum / RECOVERY_TOTAL) * CHART_MULT)));
    // Strain: null when no data at all; otherwise drag from 50 toward 0
    const strain = strainCount === 0
      ? null
      : Math.max(0, Math.min(100, Math.round(50 - (strainSum / STRAIN_TOTAL) * CHART_STRAIN_MULT)));
    return { date: d.date, recovery, strain };
  });
}

function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i - 1].x + pts[i].x) / 2;
    d += ` C${cx},${pts[i - 1].y} ${cx},${pts[i].y} ${pts[i].x},${pts[i].y}`;
  }
  return d;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MomentumChart({ points }: { points: Array<{ date: string; recovery: number | null; strain: number | null }> }) {
  if (points.length < 2) return null;

  const W = 335, H = 150;
  const padL = 10, padR = 28, padT = 10, padB = 20;
  const cW = W - padL - padR, cH = H - padT - padB;

  // score 0–100 → Y (0=bottom, 100=top)
  const sy = (s: number) => padT + cH - (s / 100) * cH;
  const baseline = sy(50);
  const targetTop = sy(85);
  const targetBot = sy(70);

  const n = points.length;
  const xOf = (i: number) => padL + (i / (n - 1)) * cW;

  const recPts = points
    .map((p, i) => p.recovery !== null ? { x: xOf(i), y: sy(Math.max(0, Math.min(100, p.recovery))) } : null)
    .filter(Boolean) as Array<{ x: number; y: number }>;

  const strPts = points
    .map((p, i) => p.strain !== null ? { x: xOf(i), y: sy(Math.max(0, Math.min(100, p.strain))) } : null)
    .filter(Boolean) as Array<{ x: number; y: number }>;

  const recPath = smoothPath(recPts);
  const strPath = smoothPath(strPts);
  const recArea = recPts.length >= 2
    ? `${recPath} L${recPts[recPts.length - 1].x},${baseline} L${recPts[0].x},${baseline} Z` : "";
  const strArea = strPts.length >= 2
    ? `${strPath} L${strPts[strPts.length - 1].x},${baseline} L${strPts[0].x},${baseline} Z` : "";

  const todayRec = recPts.length > 0 ? recPts[recPts.length - 1] : null;

  const labels = points.map((p, i) => {
    const isToday = i === n - 1;
    const [yr, mo, dy] = p.date.split("-").map(Number);
    return { x: xOf(i), label: isToday ? "Today" : DAY_NAMES[new Date(yr, mo - 1, dy).getDay()], isToday };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="mc-rg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4a04a" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#d4a04a" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#d4a04a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mc-sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7FAABC" stopOpacity="0" />
          <stop offset="30%" stopColor="#7FAABC" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#7FAABC" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id="mc-rl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#d4a04a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#e8c47a" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="mc-sl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c4856a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#c4856a" stopOpacity="1" />
        </linearGradient>
        <radialGradient id="mc-tg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e8c47a" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#e8c47a" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#e8c47a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Target zone */}
      <rect x={padL} y={targetTop} width={cW} height={targetBot - targetTop} fill="rgba(212,160,74,0.06)" />
      <line x1={padL} y1={targetTop} x2={padL + cW} y2={targetTop} stroke="#d4a04a" strokeOpacity="0.10" strokeWidth="0.5" />
      <line x1={padL} y1={targetBot} x2={padL + cW} y2={targetBot} stroke="#d4a04a" strokeOpacity="0.12" strokeWidth="0.5" />

      {/* Baseline */}
      <line x1={padL} y1={baseline} x2={padL + cW} y2={baseline} stroke="#7a7060" strokeDasharray="3 3" strokeWidth="0.6" opacity="0.4" />
      {/* Below-baseline cool tint */}
      <rect x={padL} y={baseline} width={cW} height={padT + cH - baseline} fill="rgba(74,122,138,0.04)" />

      {/* Recovery area + line */}
      {recArea && <path d={recArea} fill="url(#mc-rg)" />}
      {recPath && <path d={recPath} fill="none" stroke="url(#mc-rl)" strokeWidth="1.8" strokeLinecap="round" />}

      {/* Strain area + line */}
      {strArea && <path d={strArea} fill="url(#mc-sg)" />}
      {strPath && <path d={strPath} fill="none" stroke="url(#mc-sl)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 2" />}

      {/* Recovery dots (not today) */}
      {recPts.slice(0, -1).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#d4a04a" opacity="0.5" />
      ))}
      {/* Strain dots (not today) */}
      {strPts.slice(0, -1).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2" fill="#c4856a" opacity="0.4" />
      ))}

      {/* Today glow */}
      {todayRec && <>
        <circle cx={todayRec.x} cy={todayRec.y} r="8" fill="url(#mc-tg)" />
        <circle cx={todayRec.x} cy={todayRec.y} r="3" fill="#e8c47a" />
        <circle cx={todayRec.x} cy={todayRec.y} r="1.5" fill="#f0ece4" />
      </>}

      {/* Day labels */}
      {labels.map((l) => (
        <text key={l.x} x={l.x} y={H - 3}
          fontFamily="Inter, sans-serif" fontSize="8"
          fill={l.isToday ? "#e8c47a" : "#7a7060"}
          fontWeight={l.isToday ? "600" : "400"}
          opacity={l.isToday ? 1 : 0.6}
          textAnchor="middle"
        >{l.label}</text>
      ))}

      {/* Right-side axis labels */}
      <text x={W - 2} y={targetTop + 4} fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#d4a04a" opacity="0.35" textAnchor="end">goal</text>
      <text x={W - 2} y={baseline + 3} fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#7a7060" opacity="0.35" textAnchor="end">avg</text>
    </svg>
  );
}

function MiniSparkline({ data, color }: { data: (number | null)[]; color: string }) {
  const valid = data.map((v, i) => v !== null ? { i, v } : null).filter(Boolean) as Array<{ i: number; v: number }>;
  if (valid.length < 2) return <div style={{ width: 52, height: 24 }} />;

  const vMin = Math.min(...valid.map(p => p.v));
  const vMax = Math.max(...valid.map(p => p.v));
  const range = vMax - vMin;
  const W = 52, H = 24, pad = 2;
  const innerH = H - pad * 2;
  const centerY = pad + innerH / 2;

  const pts = valid.map(p => ({
    x: pad + ((p.i / (data.length - 1)) * (W - pad * 2)),
    // When all values are identical (e.g., all zeros), render at center not bottom edge
    y: range === 0 ? centerY : pad + innerH - ((p.v - vMin) / range) * innerH,
  }));

  const path = smoothPath(pts);
  const areaPath = `${path} L${pts[pts.length - 1].x},${H - pad} L${pts[0].x},${H - pad} Z`;
  const id = `sp-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity="0.4" />
          <stop offset="95%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function MomentumCard({ data }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [detailSignal, setDetailSignal] = useState<string | null>(null);
  const navigate = useNavigate();
  const { data: signals7d } = useMomentumSignals(14);

  const chartPoints = signals7d ? computeChartPoints(signals7d.days, signals7d.baselines, signals7d.targets) : [];
  const last7 = chartPoints.slice(-7);

  // Dynamic headline: compare avg recovery vs strain score
  const recVals = last7.map(p => p.recovery).filter(v => v !== null) as number[];
  const strVals = last7.map(p => p.strain).filter(v => v !== null) as number[];
  const avgRec = recVals.length > 0 ? recVals.reduce((a, b) => a + b, 0) / recVals.length : null;
  const avgStr = strVals.length > 0 ? strVals.reduce((a, b) => a + b, 0) / strVals.length : null;

  let trendText = "In balance this week";
  let trendDir: "up" | "down" | "flat" = "flat";
  if (avgRec !== null && avgStr !== null) {
    const diff = avgRec - avgStr;
    if (diff < -3) { trendText = "Recovery trailing strain this week"; trendDir = "down"; }
    else if (diff > 3) { trendText = "Recovery leading strain this week"; trendDir = "up"; }
  } else if (data.overall_trend === "improving") {
    trendText = "Trending toward goals"; trendDir = "up";
  } else if (data.overall_trend === "declining") {
    trendText = "Trending away from goals"; trendDir = "down";
  }

  const arrowColor = trendDir === "up" ? "#e8c47a" : trendDir === "down" ? "#7FAABC" : "#7a7060";
  const arrow = trendDir === "up" ? "↑" : trendDir === "down" ? "↓" : "→";

  // Group signals by signal.group
  const groups: Record<string, MomentumSignal[]> = {};
  for (const s of data.signals) {
    const g = s.group || "other";
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  }
  const groupOrder = ["recovery", "strain", "other"];
  const groupStyle: Record<string, { color: string; dimColor: string }> = {
    recovery: { color: "#d4a04a", dimColor: "#a07830" },
    strain:   { color: "#c4856a", dimColor: "#a05840" },
    other:    { color: "#7a7060", dimColor: "#5a5040" },
  };

  return (
    <>
      <div
        style={{
          background: "linear-gradient(180deg, rgba(90,130,160,0.05) 0%, var(--bg-card) 40%)",
          border: "1px solid rgba(127,170,188,0.10)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0" }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--text-muted)" }}>
            MOMENTUM
          </span>
          <button
            onClick={e => { e.stopPropagation(); navigate("/goals"); }}
            style={{ background: "none", border: "none", color: "#a07830", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, letterSpacing: "0.3px" }}
          >
            Edit Goals ›
          </button>
        </div>

        {/* Trend headline */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 20px 0" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 800, color: arrowColor, lineHeight: 1 }}>
            {arrow}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "-0.3px" }}>
            {trendText}
          </span>
        </div>

        {/* Chart */}
        <div style={{ marginTop: 8 }}>
          <MomentumChart points={last7} />
        </div>

        {/* Footer legend */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 20px" }}>
          <div style={{ display: "flex", gap: 16 }}>
            {groupOrder.filter(g => groups[g]?.length).slice(0, 2).map(g => {
              const gs = groupStyle[g] ?? groupStyle.other;
              return (
                <div key={g} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: gs.color }} />
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: gs.dimColor }}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </span>
                </div>
              );
            })}
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {data.signals_on_track} of {data.signals_total} on track
          </span>
        </div>

        {/* Expanded: grouped signal rows */}
        {expanded && (
          <div
            style={{ borderTop: "1px solid rgba(255,255,255,0.03)", margin: "0 20px", paddingBottom: 20 }}
            onClick={e => e.stopPropagation()}
          >
            {groupOrder.filter(g => groups[g]?.length).map(g => {
              const gs = groupStyle[g] ?? groupStyle.other;
              return (
                <div key={g}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 0 4px" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: gs.color }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: gs.dimColor }}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </span>
                  </div>
                  {groups[g].map(s => {
                    const col = statusColor(s.status);
                    const sparkData = signals7d?.days.map(d =>
                      (d as unknown as Record<string, number | null>)[s.signal] ?? null
                    ) ?? [];
                    return (
                    <div
                      key={s.signal}
                      onClick={() => setDetailSignal(s.signal)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "68px 1fr auto 52px",
                        alignItems: "center",
                        padding: "8px 0",
                        gap: 6,
                        borderBottom: "1px solid rgba(255,255,255,0.02)",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
                        {s.label}
                      </span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, letterSpacing: "-0.5px", color: col, minWidth: 36 }}>
                          {fmtValue(s)}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{unitLabel(s.unit)}</span>
                        {fmtDeviation(s) && (
                          <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>{fmtDeviation(s)}</span>
                        )}
                      </div>
                      <span style={{
                        fontSize: 9, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase",
                        padding: "3px 7px", borderRadius: 100, whiteSpace: "nowrap",
                        background: s.status === "on_track" ? "rgba(232,196,122,0.1)" : s.status === "improving" ? "rgba(212,160,74,0.08)" : "rgba(127,170,188,0.1)",
                        color: s.status === "on_track" ? "#e8c47a" : s.status === "improving" ? "#d4a04a" : "#7FAABC",
                      }}>
                        {s.status === "on_track" ? "On track" : s.status === "improving" ? "Improving" : "Off track"}
                      </span>
                      <MiniSparkline data={sparkData} color={col} />
                    </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detailSignal && (
        <GoalDetailSheet signal={detailSignal} signals={data.signals} onClose={() => setDetailSignal(null)} />
      )}
    </>
  );
}
