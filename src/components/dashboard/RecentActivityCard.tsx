interface Activity {
  type: string;
  name: string;
  distance_km?: number;
  sets?: number;
  date: string;
}

function dotColor(type: string): string {
  switch (type) {
    case "run":
      return "var(--sand)";
    case "strength":
      return "var(--rust)";
    default:
      return "var(--text-muted)";
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function statLabel(a: Activity): string {
  if (a.distance_km != null) return `${a.distance_km}km`;
  if (a.sets != null) return `${a.sets} sets`;
  return "";
}

export default function RecentActivityCard({
  activities,
}: {
  activities: Activity[];
}) {
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
        RECENT ACTIVITY
      </span>

      <div style={{ marginTop: "var(--space-md)" }}>
        {activities.map((a, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              padding: "var(--space-sm) 0",
              borderBottom:
                i < activities.length - 1
                  ? "1px solid var(--border-subtle)"
                  : "none",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: dotColor(a.type),
                flexShrink: 0,
              }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="body-text" style={{ color: "var(--text-primary)" }}>
                {a.name}
              </div>
              <div className="label-text" style={{ color: "var(--text-muted)", marginTop: 2 }}>
                {formatDate(a.date)}
              </div>
            </div>

            <span className="small-number" style={{ color: "var(--text-secondary)", flexShrink: 0 }}>
              {statLabel(a)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
