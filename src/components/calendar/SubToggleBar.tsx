import type { CategoryName } from "@/types/calendar";
import { CATEGORY_COLORS, SUB_TOGGLE_DEFS } from "@/types/calendar";

type Props = {
  category: CategoryName;
  subToggles: Record<string, boolean>;
  onToggleSub: (id: string) => void;
};

export default function SubToggleBar({ category, subToggles, onToggleSub }: Props) {
  const defs = SUB_TOGGLE_DEFS[category];
  const color = CATEGORY_COLORS[category];

  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {defs.map((d) => {
        const active = subToggles[d.id] !== false; // default true
        return (
          <button
            key={d.id}
            onClick={() => onToggleSub(d.id)}
            style={{
              borderRadius: "var(--radius-pill)",
              padding: "var(--space-xs) var(--space-md)",
              border: active ? `1px solid ${color}` : "1px solid var(--border-default)",
              background: active ? `${color}20` : "transparent",
              color: active ? color : "var(--text-muted)",
              font: "600 11px/1 'Inter', sans-serif",
              letterSpacing: "0.3px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all var(--duration-fast) var(--ease-settle)",
            }}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
