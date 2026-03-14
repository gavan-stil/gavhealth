import {
  AreaChart,
  Area,
  ReferenceLine,
  ReferenceArea,
  XAxis,
  Tooltip,
  ResponsiveContainer,
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

  const height = compact ? 60 : 100;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="sdcGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e8c47a" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#e8c47a" stopOpacity={0.04} />
          </linearGradient>
        </defs>

        {/* Target zone band */}
        {baseline !== null && tMin !== null && tMax !== null && (
          <ReferenceArea
            y1={+(tMin - baseline).toFixed(2)}
            y2={+(tMax - baseline).toFixed(2)}
            fill="rgba(232,196,122,0.08)"
            stroke="rgba(232,196,122,0.2)"
            strokeDasharray="3 3"
          />
        )}

        {/* Zero line = 28d baseline */}
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

        <Area
          type="monotone"
          dataKey="dev"
          stroke="#e8c47a"
          strokeWidth={1.5}
          fill="url(#sdcGrad)"
          dot={false}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
