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

const CHART_H = 90;
const NOMINAL_W = 240;
const COL_W = NOMINAL_W / 24; // 10px per column

const STEPS_COLOR = "#c05540"; // rust-terracotta — legible over dark bg and HR bars

export default function IntradayHRChart({ data, loading }: Props) {
  if (loading) {
    return (
      <div
        className="goe-card"
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
        className="goe-card"
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
  const hrMid = Math.round((maxHr + minHr) / 2);

  const stepValues = buckets
    .filter((b) => b.steps_count !== null && b.steps_count! > 0)
    .map((b) => b.steps_count as number);
  const hasSteps = stepValues.length > 0;
  const maxSteps = hasSteps ? Math.max(...stepValues) : 0;
  const totalSteps = stepValues.reduce((a, b) => a + b, 0);
  const stepsAxisMax = hasSteps ? Math.ceil(maxSteps / 500) * 500 : 1000;
  const stepsMid = Math.round(stepsAxisMax / 2);

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
          x: hour * COL_W + COL_W / 2,
          y: CHART_H - Math.round((s / stepsAxisMax) * CHART_H),
        };
      }).filter(Boolean) as { x: number; y: number }[])
    : [];

  const axisLabelStyle: React.CSSProperties = {
    fontSize: 9,
    lineHeight: 1,
    color: "var(--text-muted)",
    textAlign: "right" as const,
  };

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

      {/* Chart layout: left-axis | plot | right-axis */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 4 }}>

        {/* Left axis: HR bpm */}
        <div
          style={{
            width: 26,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            paddingBottom: 18, // matches x-axis label row height
          }}
        >
          {[maxHr, hrMid, minHr].map((v) => (
            <div key={v} style={axisLabelStyle}>
              {Math.round(v)}
            </div>
          ))}
        </div>

        {/* Plot area */}
        <div style={{ flex: 1 }}>
          <svg
            viewBox={`0 0 ${NOMINAL_W} ${CHART_H}`}
            preserveAspectRatio="none"
            style={{ width: "100%", height: CHART_H, display: "block", overflow: "visible" }}
          >
            {/* HR bars */}
            {Array.from({ length: 24 }, (_, hour) => {
              const bucket = byHour.get(hour);
              const hr = bucket?.hr_avg ?? null;
              if (hr === null) {
                // Stub for missing hours
                return (
                  <rect
                    key={hour}
                    x={hour * COL_W + 0.5}
                    y={CHART_H - 4}
                    width={COL_W - 1}
                    height={4}
                    fill="var(--border-default)"
                    rx={2}
                    opacity={0.4}
                  />
                );
              }
              const barPct = Math.max(0.06, (hr - minHr) / hrRange);
              const barH = Math.round(barPct * CHART_H);
              const color = hrToColor(hr);
              return (
                <rect
                  key={hour}
                  x={hour * COL_W + 0.5}
                  y={CHART_H - barH}
                  width={COL_W - 1}
                  height={barH}
                  fill={color}
                  rx={2}
                />
              );
            })}

            {/* Steps line overlay */}
            {hasSteps && stepsPathData.length > 1 && (
              <path
                d={catmullRomPath(stepsPathData)}
                fill="none"
                stroke={STEPS_COLOR}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.9}
              />
            )}
          </svg>

          {/* X-axis hour labels */}
          <div style={{ display: "flex", marginTop: 3 }}>
            {HOUR_LABELS.map((label, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  fontSize: 9,
                  color: label ? "var(--text-muted)" : "transparent",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  userSelect: "none",
                }}
              >
                {label || "."}
              </div>
            ))}
          </div>
        </div>

        {/* Right axis: Steps */}
        {hasSteps && (
          <div
            style={{
              width: 26,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              paddingBottom: 18,
            }}
          >
            {[stepsAxisMax, stepsMid, 0].map((v, i) => (
              <div
                key={i}
                style={{
                  fontSize: 9,
                  lineHeight: 1,
                  color: STEPS_COLOR,
                  textAlign: "left",
                }}
              >
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              </div>
            ))}
          </div>
        )}
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
        {(
          [
            ["≤50", "#7FAABC"],
            ["51–60", "#8B95C0"],
            ["61–70", "#A884A0"],
            ["71–80", "#c4856a"],
            [">80", "#D4A04A"],
          ] as [string, string][]
        ).map(([label, color]) => (
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
                background: STEPS_COLOR,
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
