import type { CalendarData, CategoryName } from "@/types/calendar";
import { CATEGORY_COLORS, CATEGORY_ORDER, CATEGORY_LABELS } from "@/types/calendar";

type Props = {
  data: CalendarData;
  year: number;
  month: number;
  activeCategories: Set<CategoryName>;
};

export default function StatsSection({ data, year, month, activeCategories }: Props) {
  // Count days in displayed month that have each category
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const counts: Record<string, number> = {};

  for (const cat of CATEGORY_ORDER) {
    if (!activeCategories.has(cat)) continue;
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dots = data[key];
      if (dots && dots.some((dot) => dot.category === cat)) {
        count++;
      }
    }
    counts[cat] = count;
  }

  const cats = CATEGORY_ORDER.filter((c) => activeCategories.has(c));
  if (cats.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {cats.map((cat) => (
        <span
          key={cat}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            borderRadius: "var(--radius-pill)",
            padding: "var(--space-xs) var(--space-sm)",
            background: `${CATEGORY_COLORS[cat]}18`,
            border: `1px solid ${CATEGORY_COLORS[cat]}40`,
            font: "500 11px/1 'Inter', sans-serif",
            color: CATEGORY_COLORS[cat],
            letterSpacing: "0.2px",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: CATEGORY_COLORS[cat],
              flexShrink: 0,
            }}
          />
          {CATEGORY_LABELS[cat]}: {counts[cat] ?? 0}d
        </span>
      ))}
    </div>
  );
}
