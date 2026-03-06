import type { CategoryName } from "@/types/calendar";
import { CATEGORY_COLORS, CATEGORY_ORDER, CATEGORY_LABELS } from "@/types/calendar";

type Props = {
  activeCategories: Set<CategoryName>;
  onToggleCategory: (c: CategoryName) => void;
  onResetAll: () => void;
  showDuration: boolean;
  onToggleDuration: () => void;
  showStats: boolean;
  onToggleStats: () => void;
  showPatterns: boolean;
  onTogglePatterns: () => void;
};

function Pill({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
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
      {label}
    </button>
  );
}

export default function ToggleBar({
  activeCategories,
  onToggleCategory,
  onResetAll,
  showDuration,
  onToggleDuration,
  showStats,
  onToggleStats,
  showPatterns,
  onTogglePatterns,
}: Props) {
  const allActive = activeCategories.size === CATEGORY_ORDER.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      {/* Category toggles */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Pill
          label="All"
          active={allActive}
          color="var(--ochre)"
          onClick={onResetAll}
        />
        {CATEGORY_ORDER.map((c) => (
          <Pill
            key={c}
            label={CATEGORY_LABELS[c]}
            active={activeCategories.has(c)}
            color={CATEGORY_COLORS[c]}
            onClick={() => onToggleCategory(c)}
          />
        ))}
      </div>

      {/* Meta toggles */}
      <div style={{ display: "flex", gap: "6px" }}>
        <Pill label="Dur" active={showDuration} color="var(--ochre)" onClick={onToggleDuration} />
        <Pill label="Stats" active={showStats} color="var(--ochre)" onClick={onToggleStats} />
        <Pill label="Pat" active={showPatterns} color="var(--ochre)" onClick={onTogglePatterns} />
      </div>
    </div>
  );
}
