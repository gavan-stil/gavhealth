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
import type { NutritionPoint } from "@/hooks/useTrendsData";

const PROTEIN_TARGET = 180;

interface Props {
  nutrition: NutritionPoint[];
}

function weekLabel(weekStart: string): string {
  // "2026-03-02" → "Mar 2"
  const d = new Date(weekStart + "T00:00:00");
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

interface TooltipPayload {
  value: number;
  payload: NutritionPoint;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const over = d.avg_protein_g >= PROTEIN_TARGET;
  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      padding: "6px 10px",
      fontSize: 12,
    }}>
      <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>{weekLabel(d.week_start)}</div>
      <div style={{ color: over ? "var(--signal-good)" : "var(--ochre)", fontWeight: 600 }}>
        {Math.round(d.avg_protein_g)}g protein
      </div>
      <div style={{ color: "var(--text-muted)" }}>
        {Math.round(d.avg_calories)} kcal · {Math.round(d.avg_carbs_g)}g carbs · {Math.round(d.avg_fat_g)}g fat
      </div>
    </div>
  );
}

export default function NutritionTrendsChart({ nutrition }: Props) {
  if (!nutrition.length) {
    return (
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
      }}>
        <div className="label-text" style={{ color: "var(--text-muted)", marginBottom: "var(--space-sm)" }}>
          PROTEIN
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", paddingTop: "var(--space-md)" }}>
          No nutrition data yet
        </div>
      </div>
    );
  }

  // Only show last 12 weeks, most recent right-most
  const sliced = nutrition.slice(-12);

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-lg)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-md)" }}>
        <span className="label-text" style={{ color: "var(--text-muted)" }}>PROTEIN</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          target <span style={{ color: "var(--gold)" }}>{PROTEIN_TARGET}g</span> / day avg
        </span>
      </div>

      {/* Chart */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: Math.max(sliced.length * 36, 280), height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sliced} barSize={20} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="week_start"
                tickFormatter={weekLabel}
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax * 1.15, PROTEIN_TARGET * 1.2)]} />
              <ReferenceLine
                y={PROTEIN_TARGET}
                stroke="var(--gold)"
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="avg_protein_g" radius={[3, 3, 0, 0]}>
                {sliced.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.avg_protein_g >= PROTEIN_TARGET ? "var(--signal-good)" : "var(--ochre)"}
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
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>≥ {PROTEIN_TARGET}g</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--ochre)" }} />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>under target</span>
        </div>
      </div>
    </div>
  );
}
