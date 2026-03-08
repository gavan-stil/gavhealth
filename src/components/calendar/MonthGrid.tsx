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
  showWk: boolean;
  onDaySelect: (date: string) => void;
};

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildWeeks(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7;
  const weeks: { date: Date; inMonth: boolean }[][] = [];
  let current = new Date(year, month, 1 - startDow);

  while (true) {
    const week: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(current);
      week.push({ date: d, inMonth: d.getMonth() === month && d.getFullYear() === year });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    if (current.getMonth() !== month || current.getFullYear() !== year) {
      if (weeks.length >= 4) break;
    }
    if (weeks.length >= 6) break;
  }
  return weeks;
}

function todayKey(): string {
  return toKey(new Date());
}

/** Text inside an activity bar */
function barText(dot: CategoryDot, showDuration: boolean): string {
  if (!showDuration) return "";
  if (dot.category === "strength") {
    const icon =
      dot.workoutSplit === "push" ? "▲"
      : dot.workoutSplit === "pull" ? "▼"
      : dot.workoutSplit === "legs" ? "//"
      : "";
    const dur = dot.duration ?? "";
    return icon ? `${icon} ${dur}`.trim() : dur;
  }
  return dot.duration ?? "";
}

/** Aggregate text for WK outline pills */
function wkPillText(category: CategoryName, dots: CategoryDot[]): string {
  if (dots.length === 0) return "";

  if (category === "strength" || category === "sauna") {
    let total = 0;
    for (const d of dots) {
      const n = parseInt(d.duration ?? "0", 10);
      if (!isNaN(n)) total += n;
    }
    if (total === 0) return `${dots.length}×`;
    if (total >= 60) return `${Math.floor(total / 60)}h${total % 60 > 0 ? `${total % 60}m` : ""}`;
    return `${total}m`;
  }

  if (category === "running" || category === "ride") {
    let total = 0;
    for (const d of dots) {
      const dist = parseFloat(d.subMetrics?.dist ?? d.subMetrics?.distance ?? "0");
      if (!isNaN(dist)) total += dist;
    }
    if (total === 0) return `${dots.length}×`;
    return `${Math.round(total)}km`;
  }

  if (category === "sleep") {
    let sum = 0;
    for (const d of dots) {
      const h = parseFloat(d.duration ?? "0");
      if (!isNaN(h)) sum += h;
    }
    const avg = sum / dots.length;
    return `${avg.toFixed(1)}h`;
  }

  return `${dots.length}×`;
}

/** Aggregate weekly summary: dots per category */
function weekSummary(
  week: { date: Date; inMonth: boolean }[],
  data: CalendarData,
  activeCategories: Set<CategoryName>,
): { category: CategoryName; color: string; dots: CategoryDot[] }[] {
  const map = new Map<CategoryName, { color: string; dots: CategoryDot[] }>();

  for (const { date, inMonth } of week) {
    if (!inMonth) continue;
    const key = toKey(date);
    const dots = data[key];
    if (!dots) continue;
    for (const dot of dots) {
      if (!activeCategories.has(dot.category)) continue;
      const existing = map.get(dot.category);
      if (existing) {
        existing.dots.push(dot);
      } else {
        map.set(dot.category, { color: dot.color, dots: [dot] });
      }
    }
  }

  return CATEGORY_ORDER
    .filter((c) => map.has(c))
    .map((c) => ({ category: c, ...map.get(c)! }));
}

export default function MonthGrid({
  year,
  month,
  data,
  activeCategories,
  showDuration,
  subToggles,
  singleCategory,
  showWk,
  onDaySelect,
}: Props) {
  const weeks = buildWeeks(year, month);
  const today = todayKey();
  const cols = showWk ? "repeat(7, 1fr) 56px" : "repeat(7, 1fr)";

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: "1px" }}>
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
        {showWk && (
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
        )}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => {
        const summary = weekSummary(week, data, activeCategories);
        return (
          <div
            key={wi}
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              gap: "1px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            {week.map(({ date, inMonth }, di) => {
              const key = toKey(date);
              const isToday = key === today;
              const dots = (data[key] ?? []).filter((d) => activeCategories.has(d.category));
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

            {/* Weekly summary column */}
            {showWk && (
              <div
                style={{
                  background: "var(--bg-card)",
                  padding: "4px 3px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  justifyContent: "center",
                  minHeight: 72,
                }}
              >
                {summary.map((s) => {
                  const text = wkPillText(s.category, s.dots);
                  return (
                    <div
                      key={s.category}
                      style={{
                        height: 14,
                        borderRadius: 3,
                        border: `1px solid ${s.color}`,
                        background: "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingInline: 2,
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          font: "700 7px/1 'JetBrains Mono', monospace",
                          color: s.color,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {text}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
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
        width: "100%",
        cursor: inMonth ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: "2px",
        minHeight: 72,
        opacity: inMonth ? 1 : 0.3,
      }}
    >
      {/* Day number */}
      <span
        style={{
          font: "600 14px/1 'JetBrains Mono', monospace",
          letterSpacing: "-0.5px",
          color: isToday ? "var(--ochre)" : inMonth ? "var(--text-secondary)" : "var(--text-muted)",
          borderBottom: isToday ? "2px solid var(--ochre)" : "none",
          paddingBottom: isToday ? "1px" : "0",
          alignSelf: "center",
        }}
      >
        {dayNum}
      </span>

      {/* Bars / sub-metrics */}
      {singleCategory && dots.length > 0
        ? /* Single-category mode: sub-metric values */
          dots
            .filter((d) => d.category === singleCategory)
            .map((d) => (
              <div
                key={d.category}
                style={{ display: "flex", flexDirection: "column", gap: "1px", alignItems: "center" }}
              >
                {d.subMetrics &&
                  Object.entries(d.subMetrics)
                    .filter(([id]) => subToggles[id] !== false)
                    .map(([id, val]) => (
                      <span
                        key={id}
                        style={{ font: "500 8px/1 'JetBrains Mono', monospace", color: d.color }}
                      >
                        {val}
                      </span>
                    ))}
              </div>
            ))
        : /* Normal mode: full-width bars */
          dots.map((d) => {
            const text = barText(d, showDuration);
            const hasMarker = d.isLetsGo || d.isInterval || d.saunaHasDevotion;
            return (
              <div
                key={d.category}
                style={{
                  height: 14,
                  borderRadius: 3,
                  background: d.color,
                  display: "flex",
                  alignItems: "center",
                  position: "relative",
                  paddingInline: 3,
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    font: "700 7px/1 'JetBrains Mono', monospace",
                    color: "#fff",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flex: 1,
                  }}
                >
                  {text}
                </span>
                {hasMarker && (
                  <span
                    style={{
                      font: "700 6px/1 'JetBrains Mono', monospace",
                      color: "rgba(255,255,255,0.85)",
                      flexShrink: 0,
                    }}
                  >
                    ▲
                  </span>
                )}
              </div>
            );
          })}
    </button>
  );
}
