import { useState } from "react";
import type { CategoryName } from "@/types/calendar";
import { CATEGORY_COLORS, CATEGORY_ORDER, CATEGORY_LABELS } from "@/types/calendar";

const PRIMARY_CATEGORIES: CategoryName[] = ["running", "strength", "ride", "sauna"];
const SECONDARY_CATEGORIES: CategoryName[] = ["weight", "sleep", "heart"];

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
  const [showMore, setShowMore] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      {/* Primary category toggles + More disclosure */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
        <Pill label="All" active={allActive} color="var(--ochre)" onClick={onResetAll} />
        {PRIMARY_CATEGORIES.map((c) => (
          <Pill
            key={c}
            label={CATEGORY_LABELS[c]}
            active={activeCategories.has(c)}
            color={CATEGORY_COLORS[c]}
            onClick={() => onToggleCategory(c)}
          />
        ))}
        <Pill
          label={showMore ? "Less ▴" : "More ▾"}
          active={showMore}
          color="var(--text-muted)"
          onClick={() => setShowMore((p) => !p)}
        />
      </div>

      {/* Secondary categories (weight, sleep, heart) — revealed by More */}
      {showMore && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          {SECONDARY_CATEGORIES.map((c) => (
            <Pill
              key={c}
              label={CATEGORY_LABELS[c]}
              active={activeCategories.has(c)}
              color={CATEGORY_COLORS[c]}
              onClick={() => onToggleCategory(c)}
            />
          ))}
        </div>
      )}

      {/* Meta toggles */}
      <div style={{ display: "flex", gap: "6px" }}>
        <Pill label="Dur" active={showDuration} color="var(--ochre)" onClick={onToggleDuration} />
        <Pill label="Icons" active={showStats} color="var(--ochre)" onClick={onToggleStats} />
        <Pill label="Pat" active={showPatterns} color="var(--ochre)" onClick={onTogglePatterns} />
      </div>
    </div>
  );
}
