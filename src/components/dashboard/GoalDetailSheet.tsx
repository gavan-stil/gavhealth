import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import type { MomentumSignal } from "@/hooks/useMomentum";
import useMomentumSignals from "@/hooks/useMomentumSignals";
import SignalDeviationChart from "./SignalDeviationChart";

interface Props {
  signal: string;
  signals: MomentumSignal[];
  onClose: () => void;
}

function fmtVal(v: number | null, unit: string): string {
  if (v === null) return "—";
  if (unit === "hrs") return v.toFixed(1);
  if (unit === "kg") return v.toFixed(1);
  if (unit === "bpm" || unit === "kcal" || unit === "g" || unit === "ml") return String(Math.round(v));
  return String(v);
}

function unitLabel(unit: string) {
  if (unit === "hrs") return "hr";
  return unit;
}

export default function GoalDetailSheet({ signal, signals, onClose }: Props) {
  const navigate = useNavigate();
  const { data, loading } = useMomentumSignals(7);
  const meta = signals.find(s => s.signal === signal);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const chartDays = data?.days.map(d => ({
    date: d.date,
    value: (d as unknown as Record<string, number | null>)[signal] ?? null,
  })) ?? [];

  const baseline = data?.baselines?.[signal] ?? meta?.baseline_28d ?? null;
  const target = data?.targets?.[signal];
  const tMin = target?.min ?? meta?.target_min ?? null;
  const tMax = target?.max ?? meta?.target_max ?? null;
  const unit = meta?.unit ?? "";

  // Compute GAP: how far baseline is from target
  let gapValue: number | null = null;
  let gapLabel = "";
  let gapColor = "var(--text-secondary)";
  if (baseline !== null) {
    if (tMin !== null && baseline < tMin) {
      gapValue = +(baseline - tMin).toFixed(1);
      gapLabel = "below target";
      gapColor = "#7FAABC";
    } else if (tMax !== null && baseline > tMax) {
      gapValue = +(baseline - tMax).toFixed(1);
      gapLabel = "above target";
      gapColor = "#c4856a";
    } else {
      gapLabel = "on target";
      gapColor = "#e8c47a";
    }
  }

  // Insight text
  let insightText = "";
  let insightDir: "up" | "down" | null = null;
  if (meta && baseline !== null && tMin !== null) {
    const absBelowFloor = tMin - baseline;
    const trend = meta.trend_7d;
    if (absBelowFloor > 0) {
      const improving = trend === "improving";
      insightDir = improving ? "up" : "down";
      insightText = `Baseline ${fmtVal(absBelowFloor, unit)}${unitLabel(unit)} below target floor — ${improving ? "improving" : trend === "declining" ? "declining" : "holding steady"} this week`;
    } else if (tMax !== null && baseline > tMax) {
      const aboveBy = baseline - tMax;
      insightDir = trend === "improving" ? "down" : "up";
      insightText = `Baseline ${fmtVal(aboveBy, unit)}${unitLabel(unit)} above target ceiling — ${trend === "improving" ? "improving" : trend === "declining" ? "declining" : "holding steady"} this week`;
    } else {
      insightText = `Baseline within target range — ${meta.trend_7d === "improving" ? "trending up" : meta.trend_7d === "declining" ? "trending down" : "holding steady"} this week`;
    }
  }

  const isBelow = gapValue !== null && gapValue < 0;
  const insightBg = isBelow ? "rgba(127,170,188,0.08)" : gapValue !== null && gapValue > 0 ? "rgba(196,133,106,0.08)" : "rgba(232,196,122,0.08)";
  const insightFg = isBelow ? "#7FAABC" : gapValue !== null && gapValue > 0 ? "#c4856a" : "#e8c47a";

  return createPortal(
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 110 }} />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
        padding: "20px 20px 0",
        zIndex: 111,
        maxHeight: "80vh",
        overflowY: "auto",
        paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))",
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-default)", margin: "0 auto 16px" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--dawn)" }}>
              {meta?.label ?? signal}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              7-day trend vs your baseline
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => navigate("/goals")}
              style={{ background: "none", border: "none", color: "#a07830", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}
            >
              Edit Target ›
            </button>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Chart */}
        <div style={{ marginTop: 12 }}>
          {loading ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading...</span>
            </div>
          ) : (
            <SignalDeviationChart
              days={chartDays}
              baseline={baseline}
              targetMin={tMin}
              targetMax={tMax}
              unit={unit}
            />
          )}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", padding: "8px 0 12px" }}>
          {[
            { bg: "#d4a04a", opacity: 0.6, dashed: false, label: "Target zone" },
            { bg: "#7a7060", opacity: 0.5, dashed: true,  label: "Baseline (28d)" },
            { bg: "#7FAABC", opacity: 0.5, dashed: false, label: "Below baseline" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 12, height: item.dashed ? 0 : 3, borderRadius: 2,
                background: item.dashed ? "transparent" : item.bg,
                borderTop: item.dashed ? `1px dashed ${item.bg}` : undefined,
                opacity: item.opacity,
              }} />
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Stats row: TARGET / BASELINE / GAP */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 1, background: "var(--border-subtle)",
          borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: 12,
        }}>
          {[
            {
              label: "TARGET",
              value: tMin !== null && tMax !== null ? `${fmtVal(tMin, unit)}–${fmtVal(tMax, unit)}` : "Not set",
              sub: unitLabel(unit),
              color: "#d4a04a",
            },
            {
              label: "BASELINE",
              value: fmtVal(baseline, unit),
              sub: "28-day avg",
              color: "var(--text-secondary)",
            },
            {
              label: "GAP",
              value: gapValue !== null ? (gapValue >= 0 ? `+${fmtVal(gapValue, unit)}` : fmtVal(gapValue, unit)) : "—",
              sub: gapLabel,
              color: gapColor,
            },
          ].map(cell => (
            <div key={cell.label} style={{ background: "var(--bg-card)", padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>
                {cell.label}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, letterSpacing: "-1px", color: cell.color }}>
                {cell.value}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{cell.sub}</div>
            </div>
          ))}
        </div>

        {/* Insight text */}
        {insightText && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderRadius: 8,
            background: insightBg, color: insightFg,
            fontSize: 12, fontWeight: 600, marginBottom: 16,
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 800, lineHeight: 1 }}>
              {insightDir === "up" ? "↑" : insightDir === "down" ? "↓" : "→"}
            </span>
            {insightText}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
