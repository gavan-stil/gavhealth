import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MomentumSignalsData, MomentumDay } from "@/hooks/useMomentumSignals";
import type { MomentumSignal } from "@/hooks/useMomentum";
import GoalDetailSheet from "./GoalDetailSheet";

interface Props {
  data: MomentumSignalsData;
}

// Weight goal is to GAIN — higher toward target is better
const PROGRESS_SIGNALS = ["weight_kg", "rhr_bpm", "calories_in", "calories_out"] as const;
type ProgressSignalKey = typeof PROGRESS_SIGNALS[number];

const SIGNAL_META: Record<ProgressSignalKey, { label: string; unit: string; direction: "higher" | "lower" | "range" }> = {
  weight_kg:    { label: "Weight",     unit: "kg",   direction: "higher" }, // gaining toward goal
  rhr_bpm:      { label: "Resting HR", unit: "bpm",  direction: "lower"  },
  calories_in:  { label: "Cal in",     unit: "kcal", direction: "range"  },
  calories_out: { label: "Cal burned", unit: "kcal", direction: "range"  },
};

function fmtValue(key: ProgressSignalKey, v: number | null): string {
  if (v === null) return "—";
  if (key === "weight_kg") return v.toFixed(1);
  return String(Math.round(v));
}

function fmtDelta(key: ProgressSignalKey, today: number | null, baseline: number | null): string {
  if (today === null || baseline === null) return "";
  const dev = today - baseline;
  const prefix = dev >= 0 ? "+" : "";
  if (key === "weight_kg") return `${prefix}${dev.toFixed(1)} vs avg`;
  return `${prefix}${Math.round(dev)} vs avg`;
}

function trendColor(key: ProgressSignalKey, today: number | null, baseline: number | null): string {
  if (today === null || baseline === null) return "#7a7060";
  const up = today > baseline;
  if (key === "weight_kg") return up ? "#e8c47a" : "#7FAABC";
  if (key === "rhr_bpm")   return up ? "#7FAABC" : "#e8c47a";
  return "#b0a890";
}

function trendArrow(_key: ProgressSignalKey, today: number | null, baseline: number | null): string {
  if (today === null || baseline === null) return "→";
  const diff = today - baseline;
  if (Math.abs(diff) < 0.5) return "→";
  return diff > 0 ? "↑" : "↓";
}

/** Construct a synthetic MomentumSignal for GoalDetailSheet. */
function toMomentumSignal(
  key: ProgressSignalKey,
  days: MomentumDay[],
  baselines: Record<string, number | null>,
  targets: Record<string, { min: number | null; max: number | null }>,
): MomentumSignal {
  const meta = SIGNAL_META[key];
  const last7 = days.slice(-7);
  const todayVal = (last7[last7.length - 1]?.[key as keyof MomentumDay] as number | null) ?? null;
  const baseline = baselines[key] ?? null;
  const target = targets[key];
  const tMin = target?.min ?? null;
  const tMax = target?.max ?? null;

  const vals7 = last7
    .map(d => d[key as keyof MomentumDay] as number | null)
    .filter((v): v is number => v !== null);
  const avg7 = vals7.length > 0 ? vals7.reduce((a, b) => a + b, 0) / vals7.length : null;

  let trend_7d: "improving" | "declining" | "stable" = "stable";
  if (avg7 !== null && baseline !== null) {
    if (meta.direction === "higher") trend_7d = avg7 > baseline ? "improving" : "declining";
    else if (meta.direction === "lower") trend_7d = avg7 < baseline ? "improving" : "declining";
  }

  let status: "on_track" | "improving" | "off_track" = "off_track";
  if (todayVal !== null && tMin !== null && tMax !== null) {
    if (todayVal >= tMin && todayVal <= tMax) status = "on_track";
    else if (trend_7d === "improving") status = "improving";
  }

  return {
    signal: key,
    label: meta.label,
    unit: meta.unit,
    group: "progress",
    today: todayVal,
    baseline_28d: baseline,
    avg_7d: avg7,
    trend_7d,
    target_min: tMin,
    target_max: tMax,
    status,
    gap_pct: null,
  };
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

function WeightChart({ days, targetMin, targetMax }: {
  days: MomentumDay[];
  targetMin: number | null;
  targetMax: number | null;
}) {
  const last7 = days.slice(-7);
  const values = last7.map(d => d.weight_kg).filter((v): v is number => v !== null);
  if (values.length < 1) return null;

  // Carry last known weight forward so the line always extends to today
  let lastKnown: number | null = null;
  const filled = last7.map(d => {
    if (d.weight_kg !== null) { lastKnown = d.weight_kg; return { ...d, carried: false }; }
    return lastKnown !== null ? { ...d, weight_kg: lastKnown, carried: true } : { ...d, carried: false };
  });
  // Only render if we have at least 2 data points after filling
  const filledValues = filled.map(d => d.weight_kg).filter((v): v is number => v !== null);
  if (filledValues.length < 2) return null;

  const W = 335, H = 150;
  const padL = 10, padR = 28, padT = 10, padB = 20;
  const cW = W - padL - padR, cH = H - padT - padB;

  const allVals = [...filledValues];
  if (targetMin !== null) allVals.push(targetMin);
  if (targetMax !== null) allVals.push(targetMax);
  const dataMin = Math.min(...allVals) - 1;
  const dataMax = Math.max(...allVals) + 1;
  const range = dataMax - dataMin || 1;

  const sy = (v: number) => padT + cH - ((v - dataMin) / range) * cH;
  const n = filled.length;
  const xOf = (i: number) => padL + (i / (n - 1)) * cW;

  // Split into measured points and carried-forward points for different styling
  const measuredPts = filled
    .map((d, i) => !d.carried && d.weight_kg !== null ? { x: xOf(i), y: sy(d.weight_kg) } : null)
    .filter(Boolean) as Array<{ x: number; y: number }>;

  const allPts = filled
    .map((d, i) => d.weight_kg !== null ? { x: xOf(i), y: sy(d.weight_kg) } : null)
    .filter(Boolean) as Array<{ x: number; y: number }>;

  // Find split point: last measured → carried forward
  const lastMeasuredIdx = filled.reduce((acc, d, i) => !d.carried && d.weight_kg !== null ? i : acc, -1);
  const carriedPts = lastMeasuredIdx >= 0
    ? allPts.slice(allPts.findIndex(p => p.x === xOf(lastMeasuredIdx)))
    : [];

  const linePath = smoothPath(measuredPts);
  const carriedPath = carriedPts.length >= 2 ? smoothPath(carriedPts) : "";
  const areaPath = allPts.length >= 2
    ? `${smoothPath(allPts)} L${allPts[allPts.length - 1].x},${padT + cH} L${allPts[0].x},${padT + cH} Z` : "";

  // Today dot: use actual today point (last in allPts) — glow only if measured today
  const todayPt = allPts.length > 0 ? allPts[allPts.length - 1] : null;
  const todayMeasured = filled[filled.length - 1]?.carried === false && filled[filled.length - 1]?.weight_kg !== null;

  const labels = last7.map((d, i) => {
    const isToday = i === n - 1;
    const [yr, mo, dy] = d.date.split("-").map(Number);
    return { x: xOf(i), label: isToday ? "Today" : DAY_NAMES[new Date(yr, mo - 1, dy).getDay()], isToday };
  });

  const tZoneTop = targetMax !== null ? sy(targetMax) : null;
  const tZoneBot = targetMin !== null ? sy(targetMin) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="pc-wg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7FAABC" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7FAABC" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="pc-wl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7FAABC" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7FAABC" stopOpacity="1" />
        </linearGradient>
        <radialGradient id="pc-tg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7FAABC" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#7FAABC" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#7FAABC" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Goal zone band */}
      {tZoneTop !== null && tZoneBot !== null && (
        <>
          <rect x={padL} y={tZoneTop} width={cW} height={tZoneBot - tZoneTop} fill="rgba(127,170,188,0.06)" />
          <line x1={padL} y1={tZoneTop} x2={padL + cW} y2={tZoneTop} stroke="#7FAABC" strokeOpacity="0.12" strokeWidth="0.5" />
          <line x1={padL} y1={tZoneBot} x2={padL + cW} y2={tZoneBot} stroke="#7FAABC" strokeOpacity="0.10" strokeWidth="0.5" />
        </>
      )}

      {/* Area under full line (measured + carried) */}
      {areaPath && <path d={areaPath} fill="url(#pc-wg)" />}
      {/* Measured segment — solid */}
      {linePath && <path d={linePath} fill="none" stroke="url(#pc-wl)" strokeWidth="1.8" strokeLinecap="round" />}
      {/* Carried-forward segment — dashed, faded */}
      {carriedPath && <path d={carriedPath} fill="none" stroke="#7FAABC" strokeWidth="1.2" strokeDasharray="4 3" strokeOpacity="0.4" strokeLinecap="round" />}

      {/* Dots on measured points only */}
      {measuredPts.slice(0, measuredPts.length - 1).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#7FAABC" opacity="0.5" />
      ))}

      {/* Today glow — full if measured today, faint if carried */}
      {todayPt && todayMeasured && <>
        <circle cx={todayPt.x} cy={todayPt.y} r="8" fill="url(#pc-tg)" />
        <circle cx={todayPt.x} cy={todayPt.y} r="3" fill="#7FAABC" />
        <circle cx={todayPt.x} cy={todayPt.y} r="1.5" fill="#f0ece4" />
      </>}
      {todayPt && !todayMeasured && (
        <circle cx={todayPt.x} cy={todayPt.y} r="2.5" fill="#7FAABC" opacity="0.3" />
      )}

      {labels.map((l) => (
        <text key={l.x} x={l.x} y={H - 3}
          fontFamily="Inter, sans-serif" fontSize="8"
          fill={l.isToday ? "#7FAABC" : "#7a7060"}
          fontWeight={l.isToday ? "600" : "400"}
          opacity={l.isToday ? 1 : 0.6}
          textAnchor="middle"
        >{l.label}</text>
      ))}

      {tZoneTop !== null && (
        <text x={W - 2} y={tZoneTop + 4} fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#7FAABC" opacity="0.35" textAnchor="end">goal</text>
      )}
    </svg>
  );
}

function MiniSparkline({ data, color }: { data: (number | null)[]; color: string }) {
  const valid = data.map((v, i) => v !== null ? { i, v } : null).filter(Boolean) as Array<{ i: number; v: number }>;
  if (valid.length < 2) return <div style={{ width: 52, height: 24 }} />;
  const vMin = Math.min(...valid.map(p => p.v));
  const vMax = Math.max(...valid.map(p => p.v));
  const range = vMax - vMin || 1;
  const W = 52, H = 24, pad = 2;
  const pts = valid.map(p => ({
    x: pad + ((p.i / (data.length - 1)) * (W - pad * 2)),
    y: pad + (H - pad * 2) - ((p.v - vMin) / range) * (H - pad * 2),
  }));
  const path = smoothPath(pts);
  const areaPath = `${path} L${pts[pts.length - 1].x},${H - pad} L${pts[0].x},${H - pad} Z`;
  const id = `psp-${color.replace(/[^a-z0-9]/gi, "")}`;
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

export default function ProgressCard({ data }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [detailSignal, setDetailSignal] = useState<string | null>(null);
  const navigate = useNavigate();

  const last7 = data.days.slice(-7);
  const today = last7[last7.length - 1];

  const weightTarget = data.targets?.["weight_kg"];
  const targetMin = weightTarget?.min ?? null;
  const targetMax = weightTarget?.max ?? null;
  const weightBaseline = data.baselines?.["weight_kg"] ?? null;
  const weightToday = today?.weight_kg ?? null;

  let headline = "Tracking body composition";
  let headlineArrow = "→";
  let arrowColor = "#7a7060";
  if (weightToday !== null && targetMin !== null) {
    const gap = targetMin - weightToday;
    if (gap <= 0) {
      headline = "At goal weight";
      headlineArrow = "✓";
      arrowColor = "#e8c47a";
    } else if (weightBaseline !== null && weightToday > weightBaseline) {
      headline = "Weight trending toward goal";
      headlineArrow = "↑";
      arrowColor = "#7FAABC";
    } else {
      headline = `${gap.toFixed(1)} kg below goal weight`;
      headlineArrow = "↑";
      arrowColor = "#7a7060";
    }
  }

  const calIn = today?.calories_in ?? null;
  const calOut = today?.calories_out ?? null;
  const netBalance = calIn !== null && calOut !== null ? Math.round(calIn - calOut) : null;

  // Build synthetic MomentumSignal list for GoalDetailSheet
  const progressSignals: MomentumSignal[] = PROGRESS_SIGNALS.map(key =>
    toMomentumSignal(key, data.days, data.baselines ?? {}, data.targets ?? {})
  );

  return (
    <>
      <div
        style={{
          background: "linear-gradient(180deg, rgba(127,170,188,0.05) 0%, var(--bg-card) 40%)",
          border: "1px solid rgba(127,170,188,0.10)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0" }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#5a8a9a" }}>
            PROGRESS
          </span>
          <button
            onClick={e => { e.stopPropagation(); navigate("/goals"); }}
            style={{ background: "none", border: "none", color: "#5a8a9a", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, letterSpacing: "0.3px" }}
          >
            Edit Goals ›
          </button>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 20px 0" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 800, color: arrowColor, lineHeight: 1 }}>
            {headlineArrow}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "-0.3px" }}>
            {headline}
          </span>
        </div>

        {/* Weight chart */}
        <div style={{ marginTop: 8 }}>
          <WeightChart days={data.days} targetMin={targetMin} targetMax={targetMax} />
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 20px" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {netBalance !== null
              ? netBalance >= 0
                ? `+${netBalance} kcal surplus`
                : `${netBalance} kcal deficit`
              : ""}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Goal: {targetMin ?? "—"}–{targetMax ?? "—"} kg
          </span>
        </div>

        {/* Expanded rows */}
        {expanded && (
          <div
            style={{ borderTop: "1px solid rgba(255,255,255,0.03)", margin: "0 20px", paddingBottom: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 0 4px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7FAABC" }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#5a8a9a" }}>
                Tracking
              </span>
            </div>

            {PROGRESS_SIGNALS.map(key => {
              const meta = SIGNAL_META[key];
              const todayVal = (today?.[key as keyof MomentumDay] as number | null) ?? null;
              const baseline = data.baselines?.[key] ?? null;
              const col = trendColor(key, todayVal, baseline);
              const arrow = trendArrow(key, todayVal, baseline);
              const sparkData = data.days.slice(-7).map(d => (d[key as keyof MomentumDay] as number | null) ?? null);

              return (
                <div
                  key={key}
                  onClick={() => setDetailSignal(key)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr auto 52px",
                    alignItems: "center",
                    padding: "8px 0",
                    gap: 6,
                    borderBottom: "1px solid rgba(255,255,255,0.02)",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
                    {meta.label}
                  </span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, letterSpacing: "-0.5px", color: col, minWidth: 36 }}>
                      {fmtValue(key, todayVal)}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{meta.unit}</span>
                    {fmtDelta(key, todayVal, baseline) && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>
                        {fmtDelta(key, todayVal, baseline)}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 100,
                    background: "rgba(127,170,188,0.07)", color: col, whiteSpace: "nowrap",
                  }}>
                    {arrow}
                  </span>
                  <MiniSparkline data={sparkData} color={col} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detailSignal && (
        <GoalDetailSheet
          signal={detailSignal}
          signals={progressSignals}
          onClose={() => setDetailSignal(null)}
        />
      )}
    </>
  );
}
