import type { CategoryDot } from "@/types/calendar";
import { CATEGORY_LABELS } from "@/types/calendar";

type Props = {
  date: string | null;
  dots: CategoryDot[];
  onClose: () => void;
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

export default function DayDetailSheet({ date, dots, onClose }: Props) {
  if (!date) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 90,
          animation: "fadeIn var(--duration-fast) var(--ease-settle)",
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 91,
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          padding: "var(--space-lg)",
          maxHeight: "60vh",
          overflowY: "auto",
          animation: "slideUp var(--duration-slow) var(--ease-settle)",
        }}
      >
        {/* Grab handle */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: "var(--border-default)",
            margin: "0 auto var(--space-md)",
          }}
        />

        {/* Date header */}
        <h3
          style={{
            font: "600 14px/1.3 'Inter', sans-serif",
            letterSpacing: "-0.3px",
            color: "var(--text-primary)",
            margin: "0 0 var(--space-md)",
          }}
        >
          {formatDate(date)}
        </h3>

        {/* Category sections */}
        {dots.length === 0 ? (
          <p
            style={{
              font: "400 12px/1.4 'Inter', sans-serif",
              color: "var(--text-muted)",
            }}
          >
            No data logged for this day.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {dots.map((dot) => (
              <div key={dot.category}>
                {/* Category header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-sm)",
                    marginBottom: "var(--space-xs)",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: dot.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      font: "600 12px/1 'Inter', sans-serif",
                      color: "var(--text-primary)",
                      letterSpacing: "0.2px",
                    }}
                  >
                    {CATEGORY_LABELS[dot.category]}
                  </span>
                  {dot.duration && (
                    <span
                      style={{
                        font: "400 11px/1 'JetBrains Mono', monospace",
                        color: "var(--text-muted)",
                        marginLeft: "auto",
                      }}
                    >
                      {dot.duration}
                    </span>
                  )}
                  {dot.isLetsGo !== undefined && (
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 600,
                        letterSpacing: "0.5px",
                        textTransform: "uppercase" as const,
                        padding: "2px 6px",
                        borderRadius: "var(--radius-pill)",
                        background: dot.isLetsGo ? "var(--ochre)" : "transparent",
                        border: `1px solid ${dot.isLetsGo ? "var(--ochre)" : "var(--border-default)"}`,
                        color: dot.isLetsGo ? "var(--bg-base)" : "var(--text-muted)",
                        marginLeft: dot.duration ? "0" : "auto",
                      }}
                    >
                      {dot.isLetsGo ? "Let's Go" : "Mid"}
                    </span>
                  )}
                </div>

                {/* Sub-metrics */}
                {dot.subMetrics && (
                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-md)",
                      flexWrap: "wrap",
                      paddingLeft: 16,
                    }}
                  >
                    {Object.entries(dot.subMetrics).map(([key, val]) => (
                      <div key={key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span
                          style={{
                            font: "500 9px/1 'Inter', sans-serif",
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {key}
                        </span>
                        <span
                          style={{
                            font: "500 12px/1 'JetBrains Mono', monospace",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {dot.category === "sauna" && dot.saunaHasDevotion && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 16 }}>
                    <span style={{ fontSize: 9, color: "var(--ember)" }}>▲</span>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Devotions</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
