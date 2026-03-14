import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { MomentumData, MomentumSignal } from "@/hooks/useMomentum";
import GoalDetailSheet from "./GoalDetailSheet";

interface Props {
  data: MomentumData;
}

function trendIcon(trend: string, size = 14) {
  if (trend === "improving") return <TrendingUp size={size} color="#e8c47a" />;
  if (trend === "declining") return <TrendingDown size={size} color="#c47a6a" />;
  return <Minus size={size} color="#7a7060" />;
}

function statusColor(status: string) {
  if (status === "on_track") return "#e8c47a";
  if (status === "improving") return "#d4a04a";
  return "#c47a6a";
}

function fmtValue(signal: MomentumSignal) {
  if (signal.today === null) return "—";
  const v = signal.today;
  if (signal.unit === "hrs") return `${v.toFixed(1)} hrs`;
  if (signal.unit === "bpm") return `${Math.round(v)} bpm`;
  if (signal.unit === "kg") return `${v.toFixed(1)} kg`;
  if (signal.unit === "kcal") return `${Math.round(v)} kcal`;
  if (signal.unit === "g") return `${Math.round(v)} g`;
  if (signal.unit === "ml") return `${Math.round(v)} ml`;
  return `${v}`;
}

function fmtDeviation(signal: MomentumSignal) {
  if (signal.today === null || signal.baseline_28d === null) return "";
  const dev = signal.today - signal.baseline_28d;
  const prefix = dev >= 0 ? "+" : "";
  if (signal.unit === "hrs") return `${prefix}${dev.toFixed(1)}hr vs avg`;
  if (signal.unit === "bpm") return `${prefix}${Math.round(dev)} vs avg`;
  if (signal.unit === "kg") return `${prefix}${dev.toFixed(1)} vs avg`;
  if (signal.unit === "kcal") return `${prefix}${Math.round(dev)} vs avg`;
  if (signal.unit === "g") return `${prefix}${Math.round(dev)}g vs avg`;
  if (signal.unit === "ml") return `${prefix}${Math.round(dev)}ml vs avg`;
  return `${prefix}${dev.toFixed(1)}`;
}

export default function MomentumCard({ data }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [detailSignal, setDetailSignal] = useState<string | null>(null);
  const navigate = useNavigate();

  const isUnderwater = data.signals_on_track < Math.ceil(data.signals_total / 2);

  const cardBg = isUnderwater
    ? "rgba(100,140,200,0.04)"
    : "var(--bg-card)";

  const trendLabel =
    data.overall_trend === "improving"
      ? "Trending toward goals"
      : data.overall_trend === "declining"
      ? "Trending away from goals"
      : "Holding steady";

  return (
    <>
      <div
        style={{
          background: cardBg,
          border: `1px solid ${isUnderwater ? "rgba(100,140,200,0.15)" : "var(--border-default)"}`,
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
          cursor: "pointer",
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div className="label-text" style={{ color: "var(--text-muted)", marginBottom: 4 }}>
              MOMENTUM
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {trendIcon(data.overall_trend, 16)}
              <span className="body-text" style={{ color: "var(--text-secondary)" }}>
                {trendLabel}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate("/goals");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--ochre)",
                fontSize: 12,
                cursor: "pointer",
                padding: 0,
                whiteSpace: "nowrap",
              }}
            >
              Edit Goals →
            </button>
            {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
          </div>
        </div>

        {/* Signal dots + count */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {data.signals.map((s) => (
              <div
                key={s.signal}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: statusColor(s.status),
                  opacity: s.status === "off_track" ? 0.45 : 1,
                }}
              />
            ))}
          </div>
          <span className="body-text" style={{ color: "var(--text-muted)", fontSize: 12 }}>
            {data.signals_on_track} of {data.signals_total} on track
          </span>
        </div>

        {/* Expanded signal rows */}
        {expanded && (
          <div
            style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {data.signals.map((s) => (
              <div
                key={s.signal}
                onClick={() => setDetailSignal(s.signal)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 8px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: "transparent",
                  transition: "background 120ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Status dot */}
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: statusColor(s.status),
                    flexShrink: 0,
                    marginRight: 10,
                  }}
                />
                {/* Label */}
                <span
                  className="body-text"
                  style={{ color: "var(--text-secondary)", width: 80, flexShrink: 0 }}
                >
                  {s.label}
                </span>
                {/* Value */}
                <span
                  className="small-number"
                  style={{ color: "var(--text-primary)", width: 90, flexShrink: 0 }}
                >
                  {fmtValue(s)}
                </span>
                {/* Deviation */}
                <span
                  className="body-text"
                  style={{ color: "var(--text-muted)", fontSize: 11, flex: 1 }}
                >
                  {fmtDeviation(s)}
                </span>
                {/* Trend */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {trendIcon(s.trend_7d)}
                  <span
                    className="body-text"
                    style={{
                      fontSize: 11,
                      color:
                        s.trend_7d === "improving"
                          ? "#e8c47a"
                          : s.trend_7d === "declining"
                          ? "#c47a6a"
                          : "var(--text-muted)",
                    }}
                  >
                    {s.trend_7d === "improving"
                      ? "Improving"
                      : s.trend_7d === "declining"
                      ? "Declining"
                      : "Stable"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detailSignal && (
        <GoalDetailSheet
          signal={detailSignal}
          signals={data.signals}
          onClose={() => setDetailSignal(null)}
        />
      )}
    </>
  );
}
