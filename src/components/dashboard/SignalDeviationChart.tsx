import {
  BarChart,
  Bar,
  ReferenceLine,
  ReferenceArea,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface DayValue {
  date: string;
  value: number | null;
}

interface Props {
  days: DayValue[];
  baseline: number | null;
  targetMin?: number | null;
  targetMax?: number | null;
  unit: string;
  compact?: boolean;
}

function fmtDate(d: unknown): string {
  if (typeof d !== "string") return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
}

export default function SignalDeviationChart({
  days,
  baseline,
  targetMin,
  targetMax,
  unit,
  compact = false,
}: Props) {
  const chartData = days.map((d) => {
    const dev =
      d.value !== null && baseline !== null ? +(d.value - baseline).toFixed(2) : null;
    return { date: d.date, value: d.value, dev };
  });

  const tMin = targetMin ?? null;
  const tMax = targetMax ?? null;

  const underwater =
    baseline !== null && tMin !== null && baseline < tMin;

  const height = compact ? 60 : 100;

  // Compute y-domain with a little padding
  const devs = chartData.map((d) => d.dev).filter((v): v is number => v !== null);
  const minDev = devs.length ? Math.min(...devs) : -1;
  const pad = Math.max(0.5, Math.abs((devs.length ? Math.max(...devs) : 1) - minDev) * 0.2);
  const yMin = minDev - pad;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        {/* Target zone band (deviation space: shift to baseline-relative coords) */}
        {baseline !== null && tMin !== null && tMax !== null && (
          <ReferenceArea
            y1={+(tMin - baseline).toFixed(2)}
            y2={+(tMax - baseline).toFixed(2)}
            fill="rgba(232,196,122,0.10)"
            stroke="rgba(232,196,122,0.25)"
            strokeDasharray="3 3"
          />
        )}
        {/* Underwater zone: below target min */}
        {underwater && baseline !== null && tMin !== null && (
          <ReferenceArea
            y1={yMin}
            y2={+(tMin - baseline).toFixed(2)}
            fill="rgba(100,140,200,0.08)"
          />
        )}
        {/* Zero line = baseline */}
        <ReferenceLine y={0} stroke="#7a7060" strokeDasharray="3 3" strokeWidth={1} />

        {!compact && (
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fill: "#8a8070", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
        )}

        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(val: any, _name: any, props: any) => {
            const abs = props?.payload?.value;
            const numVal = typeof val === "number" ? val : 0;
            return [
              abs !== null && abs !== undefined
                ? `${abs} ${unit} (${numVal >= 0 ? "+" : ""}${numVal.toFixed(1)} vs avg)`
                : "No data",
              "",
            ];
          }}
          contentStyle={{
            background: "#1a1a14",
            border: "1px solid #2a2a20",
            borderRadius: 8,
            fontSize: 12,
            color: "#f0ece4",
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(label: any) => fmtDate(label)}
        />

        <Bar dataKey="dev" radius={[2, 2, 0, 0]} maxBarSize={20}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={
                entry.dev === null
                  ? "#2a2a20"
                  : entry.dev >= 0
                  ? "#e8c47a"
                  : "rgba(100,140,200,0.6)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
