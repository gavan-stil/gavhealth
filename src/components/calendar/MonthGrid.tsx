import type { CalendarData, CategoryName, CategoryDot } from "@/types/calendar";
import { CATEGORY_ORDER } from "@/types/calendar";

type Props = {
  year: number;
  month: number; // 0-indexed
  data: CalendarData;
  activeCategories: Set<CategoryName>;
  showDuration: boolean;
  subToggles: Record<string, boolean>;
  singleCategory: CategoryName | null;
  onDaySelect: (date: string) => void;
};

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** Return YYYY-MM-DD for a Date */
function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Build week rows for the month grid. Each row = 7 day slots + summary. */
function buildWeeks(year: number, month: number) {
  // First day of month
  const first = new Date(year, month, 1);
  // dayOfWeek: Mon=0 .. Sun=6
  const startDow = (first.getDay() + 6) % 7;
  const weeks: { date: Date; inMonth: boolean }[][] = [];
  let current = new Date(year, month, 1 - startDow);

  while (true) {
    const week: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(current);
      week.push({
        date: d,
        inMonth: d.getMonth() === month && d.getFullYear() === year,
      });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    // Stop after we've passed the last day of the month
    if (current.getMonth() !== month || current.getFullYear() !== year) {
      // Check if we started a new month
      if (weeks.length >= 4) break;
    }
    if (weeks.length >= 6) break;
  }
  return weeks;
}

function todayKey(): string {
  return toKey(new Date());
}

/** Aggregate weekly summary: count of entries per category for the week */
function weekSummary(
  week: { date: Date; inMonth: boolean }[],
  data: CalendarData,
  activeCategories: Set<CategoryName>,
): { category: CategoryName; color: string; count: number }[] {
  const counts = new Map<CategoryName, { color: string; count: number }>();

  for (const { date, inMonth } of week) {
    if (!inMonth) continue;
    const key = toKey(date);
    const dots = data[key];
    if (!dots) continue;
    for (const dot of dots) {
      if (!activeCategories.has(dot.category)) continue;
      const existing = counts.get(dot.category);
      if (existing) {
        existing.count++;
      } else {
        counts.set(dot.category, { color: dot.color, count: 1 });
      }
    }
  }

  return CATEGORY_ORDER
    .filter((c) => counts.has(c))
    .map((c) => ({ category: c, ...counts.get(c)! }));
}

export default function MonthGrid({
  year,
  month,
  data,
  activeCategories,
  showDuration,
  subToggles,
  singleCategory,
  onDaySelect,
}: Props) {
  const weeks = buildWeeks(year, month);
  const today = todayKey();

  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr) 56px",
          gap: "1px",
        }}
      >
        {DAY_LABELS.map((l, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
              font: "600 10px/1 'Inter', sans-serif",
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              padding: "var(--space-xs) 0",
            }}
          >
            {l}
          </div>
        ))}
        <div
          style={{
            textAlign: "center",
            font: "600 10px/1 'Inter', sans-serif",
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            padding: "var(--space-xs) 0",
          }}
        >
          Wk
        </div>
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => {
        const summary = weekSummary(week, data, activeCategories);
        return (
          <div
            key={wi}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr) 56px",
              gap: "1px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            {week.map(({ date, inMonth }, di) => {
              const key = toKey(date);
              const isToday = key === today;
              const dots = (data[key] ?? []).filter((d) =>
                activeCategories.has(d.category),
              );
              return (
                <DayCell
                  key={di}
                  dayNum={date.getDate()}
                  inMonth={inMonth}
                  isToday={isToday}
                  dots={dots}
                  showDuration={showDuration}
                  singleCategory={singleCategory}
                  subToggles={subToggles}
                  onClick={() => inMonth && onDaySelect(key)}
                />
              );
            })}
            {/* Weekly summary */}
            <div
              style={{
                background: "var(--bg-card)",
                padding: "2px 4px",
                display: "flex",
                flexDirection: "column",
                gap: "1px",
                justifyContent: "center",
                minHeight: 48,
              }}
            >
              {summary.map((s) => (
                <div
                  key={s.category}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: s.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      font: "500 8px/1 'JetBrains Mono', monospace",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── DayCell ── */

function DayCell({
  dayNum,
  inMonth,
  isToday,
  dots,
  showDuration,
  singleCategory,
  subToggles,
  onClick,
}: {
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
  dots: CategoryDot[];
  showDuration: boolean;
  singleCategory: CategoryName | null;
  subToggles: Record<string, boolean>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: "3px 2px",
        cursor: inMonth ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2px",
        minHeight: 48,
        opacity: inMonth ? 1 : 0.3,
      }}
    >
      {/* Day number */}
      <span
        style={{
          font: "600 14px/1 'JetBrains Mono', monospace",
          letterSpacing: "-0.5px",
          color: isToday
            ? "var(--ochre)"
            : inMonth
            ? "var(--text-secondary)"
            : "var(--text-muted)",
          borderBottom: isToday ? "2px solid var(--ochre)" : "none",
          paddingBottom: isToday ? "1px" : "0",
        }}
      >
        {dayNum}
      </span>

      {/* Dots / sub-metrics */}
      {singleCategory && dots.length > 0
        ? /* Single-category mode: show sub-metric values */
          dots
            .filter((d) => d.category === singleCategory)
            .map((d) => (
              <div key={d.category} style={{ display: "flex", flexDirection: "column", gap: "1px", alignItems: "center" }}>
                {d.subMetrics &&
                  Object.entries(d.subMetrics)
                    .filter(([id]) => subToggles[id] !== false)
                    .map(([id, val]) => (
                      <span
                        key={id}
                        style={{
                          font: "500 8px/1 'JetBrains Mono', monospace",
                          color: d.color,
                        }}
                      >
                        {val}
                      </span>
                    ))}
              </div>
            ))
        : /* Normal mode: dots + optional duration + markers */
          dots.map((d) => (
            <div
              key={d.category}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: d.color,
                    flexShrink: 0,
                  }}
                />
                {showDuration && d.duration && (
                  <span
                    style={{
                      font: "500 9px/1 'JetBrains Mono', monospace",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {d.duration}
                  </span>
                )}
              </div>
              {(d.isLetsGo || d.isInterval || d.saunaHasDevotion) && (
                <span style={{ fontSize: 6, color: d.color, lineHeight: 1 }}>▲</span>
              )}
            </div>
          ))}
    </button>
  );
}
