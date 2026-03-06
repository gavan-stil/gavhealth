interface CardEmptyProps {
  section: string;
}

export default function CardEmpty({ section }: CardEmptyProps) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-sm)",
        minHeight: 120,
      }}
    >
      <span className="body-text" style={{ color: "var(--text-muted)" }}>
        No {section} data yet
      </span>
      <span className="label-text" style={{ color: "var(--text-tertiary)" }}>
        Check back after your next sync
      </span>
    </div>
  );
}
