import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { rollingAverage, normalize } from "@/lib/correlation";
import type { TrendsData } from "@/hooks/useTrendsData";

interface Props {
  data: TrendsData;
}

interface ChartRow {
  date: string;
  label: string;
  recovery: number | null;
  runDistance: number | null;
  strengthCount: number | null;
}

function buildChartData(data: TrendsData): ChartRow[] {
  // Collect all dates
  const allDates = new Set<string>();
  data.sleep.forEach((d) => allDates.add(d.date));
  data.rhr.forEach((d) => allDates.add(d.date));
  data.sauna.forEach((d) => allDates.add(d.date));
  data.runs.forEach((d) => allDates.add(d.date));
  data.strength.forEach((d) => allDates.add(d.date));

  const sortedDates = Array.from(allDates).sort();
  if (sortedDates.length === 0) return [];

  // Build lookup maps
  const sleepMap = new Map(data.sleep.map((s) => [s.date, s.duration_hrs]));
  const deepMap = new Map(data.sleep.map((s) => [s.date, s.deep_pct]));
  const rhrMap = new Map(data.rhr.map((r) => [r.date, r.rhr_bpm]));
  const saunaMap = new Map(data.sauna.map((s) => [s.date, s.count]));
  const runMap = new Map<string, number>();
  for (const r of data.runs) {
    runMap.set(r.date, (runMap.get(r.date) || 0) + r.distance_km);
  }
  const strMap = new Map(data.strength.map((s) => [s.date, s.count]));

  // Build raw arrays aligned to sortedDates
  const sleepArr = sortedDates.map((d) => sleepMap.get(d) ?? 0);
  const deepArr = sortedDates.map((d) => deepMap.get(d) ?? 0);
  const rhrArr = sortedDates.map((d) => rhrMap.get(d) ?? 0);
  const saunaArr = sortedDates.map((d) => saunaMap.get(d) ?? 0);
  const runArr = sortedDates.map((d) => runMap.get(d) ?? 0);
  const strArr = sortedDates.map((d) => strMap.get(d) ?? 0);

  // Normalize each recovery signal
  const nSleep = normalize(sleepArr);
  const nDeep = normalize(deepArr);
  // RHR: invert (lower is better)
  const maxRhr = Math.max(...rhrArr.filter((v) => v > 0), 1);
  const invertedRhr = rhrArr.map((v) => (v > 0 ? maxRhr - v : 0));
  const nRhr = normalize(invertedRhr);
  const nSauna = normalize(saunaArr);

  // Recovery composite: average of normalized signals
  const recoveryRaw = sortedDates.map((_, i) => {
    const signals = [nSleep[i], nDeep[i], nRhr[i], nSauna[i]];
    return signals.reduce((a, b) => a + b, 0) / signals.length;
  });

  // Apply 7-day rolling averages
  const recoverySmooth = rollingAverage(recoveryRaw, 7);
  const runSmooth = rollingAverage(runArr, 7);
  const strSmooth = rollingAverage(strArr, 7);

  // Format date label
  const fmtDate = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
  };

  return sortedDates.map((date, i) => ({
    date,
    label: fmtDate(date),
    recovery: Math.round(recoverySmooth[i] * 100) / 100,
    runDistance: Math.round(runSmooth[i] * 100) / 100,
    strengthCount: Math.round(strSmooth[i] * 100) / 100,
  }));
}

const legendItems = [
  { color: "#d4a04a", label: "Recovery" },
  { color: "#b8a878", label: "Run (km)" },
  { color: "#b47050", label: "Strength" },
];

export default function PerformanceOverlay({ data }: Props) {
  const chartData = buildChartData(data);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
      }}
    >
      <span
        className="label-text"
        style={{ color: "var(--text-muted)", marginBottom: "var(--space-md)", display: "block" }}
      >
        RECOVERY ↔ PERFORMANCE
      </span>

      {chartData.length > 1 ? (
        <>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ minWidth: 400 }}>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData}>
              <CartesianGrid
                stroke="#222018"
                strokeDasharray="2 4"
                strokeOpacity={0.6}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "#9a9080", fontSize: 10, fontFamily: "Inter" }}
                axisLine={{ stroke: "#222018" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "#1e1d18",
                  border: "1px solid #222018",
                  borderRadius: 10,
                  color: "#f0ece4",
                  fontSize: 12,
                  fontFamily: "Inter",
                }}
                labelStyle={{ color: "#9a9080", fontSize: 10 }}
              />
              <Area
                type="monotone"
                dataKey="recovery"
                stroke="#d4a04a"
                fill="#d4a04a"
                fillOpacity={0.08}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                name="Recovery"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="runDistance"
                stroke="#b8a878"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                name="Run (km)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="strengthCount"
                stroke="#b47050"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                name="Strength"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: "var(--space-lg)",
              justifyContent: "center",
              paddingTop: "var(--space-md)",
            }}
          >
            {legendItems.map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-xs)",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: item.color,
                  }}
                />
                <span className="label-text" style={{ color: "var(--text-muted)" }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div
          style={{
            height: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span className="body-text" style={{ color: "var(--text-muted)" }}>
            Not enough data to chart
          </span>
        </div>
      )}
    </div>
  );
}
