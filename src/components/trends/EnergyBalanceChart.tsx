import { useState, useEffect } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { AlertTriangle, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnergyDay {
  date: string;
  calories_in: number;
  protein_g: number;
  calories_burned_total: number | null;
  weight_kg: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROTEIN_TARGET = 180; // grams

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function shortLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface PayloadEntry {
  name: string;
  value: number;
  dataKey: string;
  payload: EnergyDay;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: PayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const net =
    d.calories_burned_total != null
      ? d.calories_in - d.calories_burned_total
      : null;

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: "8px 12px",
        fontSize: 12,
        minWidth: 130,
      }}
    >
      <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>
        {label ? dayLabel(label) : ""}
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 6 }}>
        Protein:{" "}
        <span
          style={{
            color:
              d.protein_g >= PROTEIN_TARGET
                ? "var(--signal-good)"
                : "var(--ochre)",
            fontWeight: 700,
          }}
        >
          {Math.round(d.protein_g)}g
        </span>
      </div>
      {d.calories_in > 0 && (
        <div style={{ color: "var(--ochre)", marginBottom: 2 }}>
          In: {d.calories_in.toLocaleString()} kcal
        </div>
      )}
      {d.calories_burned_total != null && (
        <div style={{ color: "var(--dawn)", marginBottom: 2 }}>
          Burn: {d.calories_burned_total.toLocaleString()} kcal
        </div>
      )}
      {net != null && (
        <div
          style={{
            color: net > 0 ? "var(--rust)" : "var(--signal-good)",
            fontWeight: 600,
            marginTop: 4,
          }}
        >
          Net: {net > 0 ? "+" : ""}
          {net.toLocaleString()} kcal
        </div>
      )}
      {d.weight_kg != null && (
        <div style={{ color: "var(--clay)", marginTop: 4 }}>
          Weight: {d.weight_kg.toFixed(1)} kg
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary row
// ---------------------------------------------------------------------------

function SummaryRow({ days }: { days: EnergyDay[] }) {
  if (!days.length) return null;

  const foodDays = days.filter((d) => d.calories_in > 0);
  const burnDays = days.filter((d) => d.calories_burned_total != null);
  const weightDays = days.filter((d) => d.weight_kg != null);

  const avgProtein =
    foodDays.length > 0
      ? Math.round(foodDays.reduce((s, d) => s + d.protein_g, 0) / foodDays.length)
      : 0;
  const avgIn =
    foodDays.length > 0
      ? Math.round(foodDays.reduce((s, d) => s + d.calories_in, 0) / foodDays.length)
      : 0;
  const avgBurn =
    burnDays.length > 0
      ? Math.round(
          burnDays.reduce((s, d) => s + (d.calories_burned_total ?? 0), 0) /
            burnDays.length
        )
      : null;
  const avgNet = avgBurn != null ? avgIn - avgBurn : null;

  const firstWeight = weightDays[0]?.weight_kg ?? null;
  const lastWeight = weightDays[weightDays.length - 1]?.weight_kg ?? null;
  const weightDelta =
    firstWeight != null && lastWeight != null ? lastWeight - firstWeight : null;

  const proteinOk = avgProtein >= PROTEIN_TARGET;

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
      {/* Protein — primary metric */}
      <div style={cellStyle}>
        <span style={labelStyle}>Protein</span>
        <span style={valueStyle(proteinOk ? "var(--signal-good)" : "var(--ochre)")}>
          {avgProtein}g
        </span>
        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
          / {PROTEIN_TARGET}g
        </span>
      </div>

      <div style={cellStyle}>
        <span style={labelStyle}>Avg In</span>
        <span style={valueStyle("var(--ochre)")}>{avgIn.toLocaleString()}</span>
        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>kcal</span>
      </div>

      {avgBurn != null && (
        <div style={cellStyle}>
          <span style={labelStyle}>Avg Burn</span>
          <span style={valueStyle("var(--dawn)")}>{avgBurn.toLocaleString()}</span>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>kcal</span>
        </div>
      )}

      {avgNet != null && (
        <div style={cellStyle}>
          <span style={labelStyle}>Net</span>
          <span
            style={valueStyle(avgNet > 0 ? "var(--rust)" : "var(--signal-good)")}
          >
            {avgNet > 0 ? "+" : ""}
            {avgNet.toLocaleString()}
          </span>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>kcal</span>
        </div>
      )}

      {weightDelta != null && (
        <div style={cellStyle}>
          <span style={labelStyle}>Weight Δ</span>
          <span
            style={valueStyle(
              weightDelta < 0 ? "var(--signal-good)" : "var(--rust)"
            )}
          >
            {weightDelta > 0 ? "+" : ""}
            {weightDelta.toFixed(1)}
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

export default function EnergyBalanceChart() {
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

  // ── Outer card shell ──
  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-lg)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-md)",
  };

  // ── Loading ──
  if (data === null && !error) {
    return (
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--text-muted)",
          }}
        >
          <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13 }}>Loading energy data…</span>
        </div>
      </div>
    );
  }

  // ── Error ──
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

  const days = data ?? [];

  // ── Graceful: < 3 days of data ──
  if (days.length < 3) {
    return (
      <div style={cardStyle}>
        <div className="label-text" style={{ color: "var(--text-muted)" }}>
          ENERGY BALANCE
        </div>
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
            textAlign: "center",
            padding: "var(--space-xl) 0",
          }}
        >
          Keep logging food to see your trend
        </div>
      </div>
    );
  }

  // ── Weight scale (right y-axis) ──
  const weightVals = days.filter((d) => d.weight_kg != null).map((d) => d.weight_kg as number);
  const weightMin = weightVals.length ? Math.floor(Math.min(...weightVals) - 1) : 60;
  const weightMax = weightVals.length ? Math.ceil(Math.max(...weightVals) + 1) : 110;

  // ── Cal scale (left y-axis) — ensure bars don't overlap weight line ──
  const allCals = [
    ...days.map((d) => d.calories_in),
    ...days.filter((d) => d.calories_burned_total != null).map((d) => d.calories_burned_total as number),
  ];
  const calMax = allCals.length ? Math.ceil(Math.max(...allCals) * 1.15 / 100) * 100 : 3500;

  // ── Tracking label ──
  const hasTrackingLabel = days.length > 0;
  const firstDate = days[0]?.date
    ? new Date(days[0].date + "T00:00:00").toLocaleDateString("en-AU", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div style={cardStyle}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div className="label-text" style={{ color: "var(--text-muted)" }}>
            ENERGY BALANCE
          </div>
          {hasTrackingLabel && firstDate && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              Tracking food from {firstDate}
            </div>
          )}
        </div>

        {/* Week / Month toggle */}
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

      {/* Legend row */}
      <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: "var(--ochre)",
              display: "inline-block",
            }}
          />
          <span style={{ color: "var(--text-muted)" }}>Intake</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: "var(--dawn)",
              display: "inline-block",
            }}
          />
          <span style={{ color: "var(--text-muted)" }}>Burn (TDEE)</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 10,
              height: 2,
              background: "var(--clay)",
              display: "inline-block",
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
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
              barGap={2}
            >
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                tickFormatter={shortLabel}
                axisLine={false}
                tickLine={false}
                interval={range === 7 ? 0 : Math.floor(days.length / 6)}
              />
              {/* Left y-axis: calories */}
              <YAxis
                yAxisId="cal"
                orientation="left"
                domain={[0, calMax]}
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(v < 1000 ? 1 : 0)}k`}
                width={30}
              />
              {/* Right y-axis: weight */}
              <YAxis
                yAxisId="wt"
                orientation="right"
                domain={[weightMin, weightMax]}
                tick={{ fill: "var(--clay)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}kg`}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Calories in bars */}
              <Bar
                yAxisId="cal"
                dataKey="calories_in"
                fill="var(--ochre)"
                opacity={0.85}
                radius={[2, 2, 0, 0]}
                maxBarSize={18}
                name="Intake"
              />
              {/* Burn bars — only rendered when non-null */}
              <Bar
                yAxisId="cal"
                dataKey="calories_burned_total"
                fill="var(--dawn)"
                opacity={0.7}
                radius={[2, 2, 0, 0]}
                maxBarSize={18}
                name="Burn"
              />
              {/* Weight line */}
              <Line
                yAxisId="wt"
                dataKey="weight_kg"
                stroke="var(--clay)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--clay)", strokeWidth: 0 }}
                connectNulls
                type="monotone"
                name="Weight"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary row */}
      <SummaryRow days={days} />
    </div>
  );
}
