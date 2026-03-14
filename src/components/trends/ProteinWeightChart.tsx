import { useState, useEffect } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { AlertTriangle, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnergyDay {
  date: string;
  protein_g: number;
  weight_kg: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// proteinTarget is now a prop; fallback 180 used inline

function shortLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface PayloadEntry {
  dataKey: string;
  payload: EnergyDay;
}

function CustomTooltip({
  active,
  payload,
  target = 180,
}: {
  active?: boolean;
  payload?: PayloadEntry[];
  target?: number;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const hit = d.protein_g >= target;

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: "8px 12px",
        fontSize: 12,
        minWidth: 120,
      }}
    >
      <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>{dayLabel(d.date)}</div>
      <div>
        <span style={{ color: "var(--text-muted)" }}>Protein: </span>
        <span style={{ color: hit ? "var(--signal-good)" : "var(--ochre)", fontWeight: 700 }}>
          {Math.round(d.protein_g)}g
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 10, marginLeft: 4 }}>
          / {target}g
        </span>
      </div>
      {d.weight_kg != null && (
        <div style={{ color: "var(--ember)", marginTop: 4 }}>
          Weight: {d.weight_kg.toFixed(1)} kg
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary row
// ---------------------------------------------------------------------------

function SummaryRow({ days, target = 180 }: { days: EnergyDay[]; target?: number }) {
  if (!days.length) return null;

  const proteinDays = days.filter((d) => d.protein_g > 0);
  const weightDays = days.filter((d) => d.weight_kg != null);
  const daysOnTarget = proteinDays.filter((d) => d.protein_g >= target).length;

  const avgProtein =
    proteinDays.length > 0
      ? Math.round(proteinDays.reduce((s, d) => s + d.protein_g, 0) / proteinDays.length)
      : 0;

  const firstWeight = weightDays[0]?.weight_kg ?? null;
  const lastWeight = weightDays[weightDays.length - 1]?.weight_kg ?? null;
  const weightDelta =
    firstWeight != null && lastWeight != null ? lastWeight - firstWeight : null;

  const proteinOk = avgProtein >= target;

  const cellStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };
  const valueStyle = (c?: string): React.CSSProperties => ({
    fontSize: 13,
    fontWeight: 700,
    color: c ?? "var(--text-primary)",
  });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-around",
        paddingTop: "var(--space-md)",
        borderTop: "1px solid var(--border-default)",
        marginTop: "var(--space-sm)",
      }}
    >
      <div style={cellStyle}>
        <span style={labelStyle}>Avg protein</span>
        <span style={valueStyle(proteinOk ? "var(--signal-good)" : "var(--ochre)")}>
          {avgProtein}g
        </span>
        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>/ {target}g</span>
      </div>

      {proteinDays.length > 0 && (
        <div style={cellStyle}>
          <span style={labelStyle}>On target</span>
          <span
            style={valueStyle(
              daysOnTarget === proteinDays.length ? "var(--signal-good)" : "var(--ochre)"
            )}
          >
            {daysOnTarget}/{proteinDays.length}
          </span>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>days</span>
        </div>
      )}

      {weightDelta != null && (
        <div style={cellStyle}>
          <span style={labelStyle}>Weight Δ</span>
          <span
            style={valueStyle(
              weightDelta < 0 ? "var(--signal-good)" : weightDelta > 0 ? "var(--ember)" : "var(--text-primary)"
            )}
          >
            {weightDelta > 0 ? "+" : ""}
            {weightDelta.toFixed(1)}
          </span>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>kg</span>
        </div>
      )}

      {weightDays.length > 0 && (
        <div style={cellStyle}>
          <span style={labelStyle}>Latest</span>
          <span style={valueStyle("var(--ember)")}>
            {weightDays[weightDays.length - 1]?.weight_kg?.toFixed(1)}
          </span>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>kg</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Range = 7 | 30;

export default function ProteinWeightChart({ proteinTarget = 180 }: { proteinTarget?: number } = {}) {
  const [range, setRange] = useState<Range>(7);
  const [data, setData] = useState<EnergyDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    apiFetch<EnergyDay[]>(`/api/energy-balance?days=${range}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [range]);

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-lg)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-md)",
  };

  if (data === null && !error) {
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)" }}>
          <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13 }}>Loading protein data…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={14} color="var(--rust)" />
          <span style={{ fontSize: 12, color: "var(--rust)" }}>{error}</span>
        </div>
      </div>
    );
  }

  const days = (data ?? []).filter((d) => d.protein_g > 0 || d.weight_kg != null);

  if (days.length < 2) {
    return (
      <div style={cardStyle}>
        <div className="label-text" style={{ color: "var(--text-muted)" }}>
          PROTEIN vs WEIGHT
        </div>
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
            textAlign: "center",
            padding: "var(--space-xl) 0",
          }}
        >
          Keep logging food to see your protein trend
        </div>
      </div>
    );
  }

  // Weight scale (right y-axis)
  const weightVals = days.filter((d) => d.weight_kg != null).map((d) => d.weight_kg as number);
  const weightMin = weightVals.length ? Math.floor(Math.min(...weightVals) - 1) : 60;
  const weightMax = weightVals.length ? Math.ceil(Math.max(...weightVals) + 1) : 110;

  // Protein scale (left y-axis) — always include target + some headroom
  const maxProtein = Math.max(...days.map((d) => d.protein_g), proteinTarget);
  const proteinMax = Math.ceil(maxProtein * 1.2 / 20) * 20;

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="label-text" style={{ color: "var(--text-muted)" }}>
          PROTEIN vs WEIGHT
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {([7, 30] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-default)",
                background: range === r ? "var(--ochre)" : "transparent",
                color: range === r ? "var(--bg-base)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {r === 7 ? "Week" : "Month"}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 10, height: 10, borderRadius: 2,
              background: "var(--ochre)", display: "inline-block",
            }}
          />
          <span style={{ color: "var(--text-muted)" }}>Protein</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 10, height: 2,
              background: "var(--ember)", display: "inline-block",
            }}
          />
          <span style={{ color: "var(--text-muted)" }}>Weight</span>
        </span>
      </div>

      {/* Chart */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: Math.max(days.length * 28, 280) }}>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart
              data={days}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="proteinGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d4a04a" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#d4a04a" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                tickFormatter={shortLabel}
                axisLine={false}
                tickLine={false}
                interval={range === 7 ? 0 : Math.floor(days.length / 6)}
              />
              {/* Left y-axis: protein */}
              <YAxis
                yAxisId="prot"
                orientation="left"
                domain={[0, proteinMax]}
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}g`}
                width={36}
              />
              {/* Right y-axis: weight */}
              <YAxis
                yAxisId="wt"
                orientation="right"
                domain={[weightMin, weightMax]}
                tick={{ fill: "var(--ember)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}kg`}
                width={40}
              />
              <Tooltip content={<CustomTooltip target={proteinTarget} />} />
              {/* 180g target reference line */}
              <ReferenceLine
                yAxisId="prot"
                y={proteinTarget}
                stroke="rgba(255,255,255,0.2)"
                strokeDasharray="4 3"
              />
              {/* Protein area */}
              <Area
                yAxisId="prot"
                dataKey="protein_g"
                stroke="#e8c47a"
                strokeWidth={1.5}
                fill="url(#proteinGrad)"
                dot={false}
                connectNulls
                type="monotone"
                name="Protein"
              />
              {/* Weight line */}
              <Line
                yAxisId="wt"
                dataKey="weight_kg"
                stroke="var(--ember)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--ember)", strokeWidth: 0 }}
                connectNulls
                type="monotone"
                name="Weight"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <SummaryRow days={days} target={proteinTarget} />
    </div>
  );
}
