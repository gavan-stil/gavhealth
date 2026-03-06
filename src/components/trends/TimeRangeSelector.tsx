import type { TimeRange } from "@/hooks/useTrendsData";

const options: { label: string; value: TimeRange }[] = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
];

interface Props {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
}

export default function TimeRangeSelector({ value, onChange }: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-xs)",
        background: "var(--bg-card)",
        borderRadius: "var(--radius-pill)",
        padding: "var(--space-xs)",
        alignSelf: "flex-start",
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: "var(--space-xs) var(--space-lg)",
            borderRadius: "var(--radius-pill)",
            border: "none",
            background:
              value === opt.value ? "var(--ochre)" : "transparent",
            color:
              value === opt.value ? "var(--bg-base)" : "var(--text-muted)",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: value === opt.value ? 700 : 600,
            cursor: "pointer",
            transition: "background var(--duration-fast) var(--ease-drift)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
