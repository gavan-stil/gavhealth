import type { ReadinessData } from "@/hooks/useDashboard";

function scoreColor(score: number): string {
  if (score >= 70) return "var(--signal-good)";
  if (score >= 40) return "var(--signal-caution)";
  return "var(--signal-poor)";
}

function componentColor(v: number): string {
  if (v > 0) return "var(--signal-good)";
  if (v < 0) return "var(--signal-poor)";
  return "var(--text-tertiary)";
}

function formatComponent(v: number): string {
  if (v > 0) return `+${v}`;
  return `${v}`;
}

export default function ReadinessCard({ data }: { data: ReadinessData }) {
  const breakdownItems = [
    { label: "SLEEP", value: data.components.sleep },
    { label: "RHR", value: data.components.rhr },
    { label: "LOAD", value: data.components.load },
    { label: "REST", value: data.components.rest },
  ];

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
      }}
    >
      <span className="label-text" style={{ color: "var(--text-muted)" }}>
        READINESS
      </span>

      <div
        className="hero-value"
        style={{
          color: scoreColor(data.score),
          marginTop: "var(--space-xs)",
        }}
      >
        {data.score}
      </div>

      <p
        className="body-text"
        style={{
          color: "var(--text-secondary)",
          marginTop: "var(--space-sm)",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {data.narrative}
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "var(--space-md)",
          paddingTop: "var(--space-md)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        {breakdownItems.map((item) => (
          <div key={item.label} style={{ textAlign: "center" }}>
            <div
              className="small-number"
              style={{ color: componentColor(item.value) }}
            >
              {formatComponent(item.value)}
            </div>
            <div
              className="label-text"
              style={{
                color: "var(--text-muted)",
                marginTop: "var(--space-xs)",
              }}
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
