import type { VitalsData } from "@/hooks/useDashboard";

export default function VitalsCard({ data }: { data: VitalsData }) {
  const cells = [
    {
      label: "SLEEP",
      value: data.total_sleep_hrs.toFixed(1),
      unit: "hrs",
      color: "var(--dawn)",
    },
    {
      label: "DEEP SLEEP",
      value: `${data.deep_sleep_pct}`,
      unit: "%",
      color: "color-mix(in srgb, var(--dawn) 60%, transparent)",
    },
    {
      label: "RHR",
      value: `${data.rhr_bpm}`,
      unit: "bpm",
      color: "var(--clay)",
    },
    {
      label: "WEIGHT",
      value: data.weight_kg.toFixed(1),
      unit: "kg",
      color: "var(--gold)",
    },
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
        TODAY'S VITALS
      </span>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-md)",
          marginTop: "var(--space-md)",
        }}
      >
        {cells.map((cell) => (
          <div key={cell.label}>
            <div
              className="label-text"
              style={{ color: "var(--text-muted)" }}
            >
              {cell.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-xs)", marginTop: "var(--space-xs)" }}>
              <span className="stat-number" style={{ color: cell.color }}>
                {cell.value}
              </span>
              <span className="body-text" style={{ color: "var(--text-muted)" }}>
                {cell.unit}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
