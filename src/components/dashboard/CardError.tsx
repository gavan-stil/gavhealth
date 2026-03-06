import { AlertTriangle } from "lucide-react";

interface CardErrorProps {
  section: string;
  onRetry: () => void;
}

export default function CardError({ section, onRetry }: CardErrorProps) {
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
      <AlertTriangle size={16} style={{ color: "var(--signal-poor)" }} />
      <span className="body-text" style={{ color: "var(--text-muted)" }}>
        Couldn't load {section}
      </span>
      <span
        className="label-text"
        style={{ color: "var(--ochre)", cursor: "pointer" }}
        onClick={onRetry}
      >
        Tap to retry
      </span>
    </div>
  );
}
