import type { IntradayHRData } from "@/hooks/useIntradayHR";

interface Props {
  data: IntradayHRData | null;
  loading: boolean;
}

/** Map a BPM value to a colour on the dawn→clay→ochre scale. */
function hrToColor(bpm: number): string {
  if (bpm <= 50) return "#7FAABC";  // dawn — excellent
  if (bpm <= 60) return "#8B95C0";  // dawn-purple
  if (bpm <= 70) return "#A884A0";  // mauve
  if (bpm <= 80) return "#c4856a";  // clay
  return "#D4A04A";                 // ochre — elevated
}

const HOUR_LABELS = [
  "12a", "", "", "3a", "", "", "6a", "", "", "9a", "", "",
  "12p", "", "", "3p", "", "", "6p", "", "", "9p", "", "",
];

const BAR_HEIGHT = 72;
const STEPS_HEIGHT = 36;
const CHART_WIDTH = 240; // nominal SVG width — scales via viewBox

export default function IntradayHRChart({ data, loading }: Props) {
  if (loading) {
    return (
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
        }}
      >
        <div className="label-text" style={{ color: "var(--text-muted)", marginBottom: "var(--space-sm)" }}>
          HR THROUGH THE DAY
        </div>
        <div
          style={{
            height: 80,
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    );
  }

  const buckets = data?.buckets ?? [];
  const hasBuckets = buckets.some((b) => b.hr_avg !== null);

  if (!hasBuckets) {
    return (
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
        }}
      >
        <div className="label-text" style={{ color: "var(--text-muted)", marginBottom: "var(--space-sm)" }}>
          HR THROUGH THE DAY
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No intraday HR data yet</p>
      </div>
    );
  }

  // Build full 24-hour grid with gaps for missing hours
  const byHour = new Map(buckets.map((b) => [b.hour, b]));

  const maxHr = Math.max(
    ...buckets.filter((b) => b.hr_avg !== null).map((b) => b.hr_avg as number),
    100,
  );
  const minHr = Math.min(
    ...buckets.filter((b) => b.hr_avg !== null).map((b) => b.hr_avg as number),
    40,
  );
  const hrRange = maxHr - minHr || 1;

  // Steps line — compute scale
  const stepValues = buckets
    .filter((b) => b.steps_count !== null && b.steps_count! > 0)
    .map((b) => b.steps_count as number);
  const hasSteps = stepValues.length > 0;
  const maxSteps = hasSteps ? Math.max(...stepValues) : 0;
  const totalSteps = stepValues.reduce((a, b) => a + b, 0);

  const colWidth = CHART_WIDTH / 24;

  // Build smooth bezier path for steps using Catmull-Rom interpolation
  function catmullRomPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x},${p2.y}`;
    }
    return d;
  }

  const stepsPathData = hasSteps
    ? (Array.from({ length: 24 }, (_, hour) => {
        const b = byHour.get(hour);
        const s = b?.steps_count ?? null;
        if (!s || s === 0) return null;
        return {
          x: hour * colWidth + colWidth / 2,
          y: STEPS_HEIGHT - Math.round((s / maxSteps) * (STEPS_HEIGHT - 4)),
        };
      }).filter(Boolean) as { x: number; y: number }[])
    : [];

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "var(--space-md)",
        }}
      >
        <span className="label-text" style={{ color: "var(--text-muted)" }}>
          HR THROUGH THE DAY
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          {hasSteps && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {totalSteps.toLocaleString()} steps
            </span>
          )}
          {buckets.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {Math.round(minHr)}–{Math.round(maxHr)} bpm
            </span>
          )}
        </div>
      </div>

      {/* Steps line chart — only render if there's data */}
      {hasSteps && stepsPathData.length > 0 && (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${STEPS_HEIGHT}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: STEPS_HEIGHT, display: "block", marginBottom: 2 }}
        >
          {/* Smooth connecting path */}
          <path
            d={catmullRomPath(stepsPathData)}
            fill="none"
            stroke="#7FAABC"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.85}
          />
          {/* Dots for each data point */}
          {stepsPathData.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={3}
              fill="#7FAABC"
              strokeWidth={0}
            />
          ))}
        </svg>
      )}

      {/* HR bar chart */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 2,
          height: BAR_HEIGHT,
          overflow: "hidden",
        }}
      >
        {Array.from({ length: 24 }, (_, hour) => {
          const bucket = byHour.get(hour);
          const hr = bucket?.hr_avg ?? null;

          if (hr === null) {
            return (
              <div
                key={hour}
                style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }}
              >
                <div
                  style={{
                    width: "100%",
                    height: 4,
                    background: "var(--border-default)",
                    borderRadius: 2,
                    opacity: 0.4,
                  }}
                />
              </div>
            );
          }

          const barPct = Math.max(0.08, (hr - minHr) / hrRange);
          const barHeight = Math.round(barPct * BAR_HEIGHT);
          const color = hrToColor(hr);
          const steps = bucket?.steps_count ?? null;

          return (
            <div
              key={hour}
              title={`${hour}:00 — ${Math.round(hr)} bpm${steps ? ` · ${steps.toLocaleString()} steps` : ""}`}
              style={{
                flex: 1,
                height: "100%",
                display: "flex",
                alignItems: "flex-end",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: barHeight,
                  background: color,
                  borderRadius: "2px 2px 0 0",
                  transition: "height 0.3s ease",
                  minHeight: 4,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Hour labels — only show 12a/3a/6a/9a/12p/3p/6p/9p */}
      <div
        style={{
          display: "flex",
          marginTop: 4,
        }}
      >
        {HOUR_LABELS.map((label, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              textAlign: "left",
              fontSize: 9,
              color: label ? "var(--text-muted)" : "transparent",
              userSelect: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {label || "."}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-md)",
          marginTop: "var(--space-sm)",
          flexWrap: "wrap",
        }}
      >
        {([
          ["≤50", "#7FAABC"],
          ["51–60", "#8B95C0"],
          ["61–70", "#A884A0"],
          ["71–80", "#c4856a"],
          [">80", "#D4A04A"],
        ] as [string, string][]).map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</span>
          </div>
        ))}
        {hasSteps && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 16,
                height: 2,
                background: "#7FAABC",
                borderRadius: 1,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>steps</span>
          </div>
        )}
      </div>
    </div>
  );
}
