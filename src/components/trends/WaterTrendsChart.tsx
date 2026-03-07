import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { WaterPoint } from "@/hooks/useTrendsData";

const WATER_TARGET_ML = 3000;

interface Props {
  water: WaterPoint[];
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

interface TooltipPayload {
  value: number;
  payload: WaterPoint;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const met = d.total_ml >= WATER_TARGET_ML;
  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      padding: "6px 10px",
      fontSize: 12,
    }}>
      <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>{dayLabel(d.date)}</div>
      <div style={{ color: met ? "var(--signal-good)" : "var(--ochre)", fontWeight: 600 }}>
        {(d.total_ml / 1000).toFixed(1)}L
      </div>
    </div>
  );
}

export default function WaterTrendsChart({ water }: Props) {
  if (!water.length) {
    return (
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
      }}>
        <div className="label-text" style={{ color: "var(--text-muted)", marginBottom: "var(--space-sm)" }}>
          WATER
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", paddingTop: "var(--space-md)" }}>
          No water data yet
        </div>
      </div>
    );
  }

  const sliced = water.slice(-28);

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-lg)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-md)" }}>
        <span className="label-text" style={{ color: "var(--text-muted)" }}>WATER</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          target <span style={{ color: "var(--gold)" }}>3L</span> / day
        </span>
      </div>

      {/* Chart */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: Math.max(sliced.length * 22, 280), height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sliced} barSize={14} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={dayLabel}
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
                interval={3}
              />
              <YAxis
                hide
                domain={[0, (dataMax: number) => Math.max(dataMax * 1.15, WATER_TARGET_ML * 1.2)]}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}L`}
              />
              <ReferenceLine
                y={WATER_TARGET_ML}
                stroke="var(--gold)"
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="total_ml" radius={[3, 3, 0, 0]}>
                {sliced.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.total_ml >= WATER_TARGET_ML ? "var(--signal-good)" : "var(--ochre)"}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-sm)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--signal-good)" }} />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>≥ 3L</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--ochre)" }} />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>under target</span>
        </div>
      </div>
    </div>
  );
}
