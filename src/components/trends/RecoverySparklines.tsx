import {
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import type { TrendsData } from "@/hooks/useTrendsData";

interface Props {
  data: TrendsData;
}

interface SparkDef {
  label: string;
  color: string;
  getValue: (d: TrendsData) => { points: { value: number }[]; current: string };
}

const sparklines: SparkDef[] = [
  {
    label: "SLEEP",
    color: "#7FAABC",
    getValue: (d) => {
      const pts = d.sleep.map((s) => ({ value: s.duration_hrs }));
      const last = d.sleep[d.sleep.length - 1];
      return { points: pts, current: last ? `${last.duration_hrs.toFixed(1)}h` : "—" };
    },
  },
  {
    label: "DEEP SLEEP",
    color: "rgba(127,170,188,0.6)",
    getValue: (d) => {
      const pts = d.sleep.map((s) => ({ value: s.deep_pct }));
      const last = d.sleep[d.sleep.length - 1];
      return { points: pts, current: last ? `${last.deep_pct}%` : "—" };
    },
  },
  {
    label: "RESTING HR",
    color: "#c4856a",
    getValue: (d) => {
      const pts = d.rhr.map((r) => ({ value: r.rhr_bpm }));
      const last = d.rhr[d.rhr.length - 1];
      return { points: pts, current: last ? `${last.rhr_bpm}` : "—" };
    },
  },
  {
    label: "SAUNA",
    color: "#c45a4a",
    getValue: (d) => {
      // Compute sessions per week: total sessions / (date range in weeks)
      const total = d.sauna.reduce((s, x) => s + x.count, 0);
      const dates = d.sauna.map((s) => s.date).sort();
      let perWk = "—";
      if (dates.length >= 2) {
        const first = new Date(dates[0]).getTime();
        const last = new Date(dates[dates.length - 1]).getTime();
        const weeks = Math.max(1, (last - first) / (7 * 86400000));
        perWk = `${(total / weeks).toFixed(1)}/wk`;
      } else if (dates.length === 1) {
        perWk = `${total}/wk`;
      }
      const pts = d.sauna.map((s) => ({ value: s.count }));
      return { points: pts, current: perWk };
    },
  },
  {
    label: "NUTRITION",
    color: "#e8c47a",
    getValue: (d) => {
      const pts = d.nutrition.map((n) => ({ value: n.consistency_pct }));
      const last = d.nutrition[d.nutrition.length - 1];
      return { points: pts, current: last ? `${last.consistency_pct}%` : "—" };
    },
  },
];

export default function RecoverySparklines({ data }: Props) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <span
        className="label-text"
        style={{ color: "var(--text-muted)", marginBottom: "var(--space-md)", display: "block" }}
      >
        RECOVERY SIGNALS
      </span>

      {sparklines.map((s) => {
        const { points, current } = s.getValue(data);
        return (
          <div
            key={s.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-sm) 0",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="label-text" style={{ color: "var(--text-muted)" }}>
                {s.label}
              </span>
              <span className="small-number" style={{ color: "var(--text-primary)" }}>
                {current}
              </span>
            </div>

            <div style={{ width: 120, height: 32 }}>
              {points.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span className="label-text" style={{ color: "var(--text-muted)" }}>
                    —
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
