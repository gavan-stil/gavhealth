import type { CalendarData, CategoryName, CategoryDot } from "@/types/calendar";
import { CATEGORY_ORDER } from "@/types/calendar";

type Props = {
  year: number;
  month: number; // 0-indexed
  data: CalendarData;
  activeCategories: Set<CategoryName>;
  subToggles: Record<string, boolean>;
  singleCategory: CategoryName | null;
  showWk: boolean;
  onDaySelect: (date: string) => void;
};

/** Active sub-metric values to display below bar, one per line */
function buildSubLines(dot: CategoryDot, subToggles: Record<string, boolean>): string[] {
  if (!dot.subMetrics || Object.keys(subToggles).length === 0) return [];
  return Object.entries(subToggles)
    .filter(([, active]) => active)
    .map(([k]) => dot.subMetrics?.[k])
    .filter((v): v is string => !!v && v !== "—");
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildWeeks(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
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

/** Split icon(s) for a strength bar.
 *  Pull/push: explicit or auto-detected from exercise majority.
 *  Leg ●: any exercise in session is legs — shown independently alongside pull/push.
 *  Abs ◆: session is tagged abs/core.
 */
function barIcon(dot: CategoryDot): string {
  if (dot.category !== "strength") return "";
  const splitIcon =
    dot.workoutSplit === "push" ? "▶"
    : dot.workoutSplit === "pull" ? "▼"
    : "";
  const legDot = dot.hasLegExercise ? "●" : "";
  const absDot = dot.hasAbsSession ? "◆" : "";
  return splitIcon + legDot + absDot;
}

/** Duration label inside an activity bar */
function barLabel(dot: CategoryDot): string {
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
    return `${(sum / dots.length).toFixed(1)}h`;
  }

  return `${dots.length}×`;
}

/** Aggregate weekly summary: dots per active category, ordered by CATEGORY_ORDER */
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
  subToggles,
  singleCategory,
  showWk,
  onDaySelect,
}: Props) {
  void singleCategory; // available for future single-cat layout tweaks
  const weeks = buildWeeks(year, month);
  const today = todayKey();
  const cols = showWk ? "repeat(7, 1fr) 50px" : "repeat(7, 1fr)";

  return (
    <div>
      {/* ── Header: M T W T F S S | Wk ── */}
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

      {/* ── Week blocks ── */}
      {weeks.map((week, wi) => {
        const summary = weekSummary(week, data, activeCategories);
        return (
          <div key={wi} style={{ borderBottom: "1px solid var(--border-subtle)" }}>

            {/* Day-number row */}
            <div style={{ display: "grid", gridTemplateColumns: cols }}>
              {week.map(({ date, inMonth }, di) => {
                const key = toKey(date);
                const isToday = key === today;
                return (
                  <button
                    key={di}
                    onClick={() => inMonth && onDaySelect(key)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "4px 1px 3px",
                      width: "100%",
                      cursor: inMonth ? "pointer" : "default",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: inMonth ? 1 : 0.2,
                    }}
                  >
                    <span
                      style={{
                        font: "600 13px/1 'JetBrains Mono', monospace",
                        color: isToday ? "var(--ochre)" : "var(--text-secondary)",
                        borderBottom: isToday ? "2px solid var(--ochre)" : "none",
                        paddingBottom: isToday ? "1px" : "0",
                      }}
                    >
                      {date.getDate()}
                    </span>
                  </button>
                );
              })}
              {showWk && <div />}
            </div>

            {/* ── Activity rows — one per category, full-width across all 7 days ── */}
            {summary.map((s) => {
              const pillText = wkPillText(s.category, s.dots);
              return (
                <div
                  key={s.category}
                  style={{
                    display: "grid",
                    gridTemplateColumns: cols,
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  {/* Seven day cells for this category — may show multiple stacked bars */}
                  {week.map(({ date, inMonth }, di) => {
                    const key = toKey(date);
                    const sessionDots = inMonth
                      ? (data[key] ?? []).filter(
                          (d) => d.category === s.category && activeCategories.has(d.category)
                        )
                      : [];

                    return (
                      <div
                        key={di}
                        style={{
                          padding: "3px 1px",
                          minHeight: 22,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          paddingTop: 3,
                        }}
                      >
                        {sessionDots.map((dot, si) => {
                          const icon = barIcon(dot);
                          const label = barLabel(dot);
                          const hasMarker = dot.category !== "strength"
                            ? !!(dot.isLetsGo || dot.isInterval || dot.saunaHasDevotion)
                            : false;
                          const subLines = buildSubLines(dot, subToggles);
                          return (
                            <div key={si} style={{ width: "100%", marginTop: si > 0 ? 2 : 0 }}>
                              {/* Coloured activity bar */}
                              <div
                                style={{
                                  width: "calc(100% - 2px)",
                                  height: 14,
                                  borderRadius: 3,
                                  background: dot.color,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 2,
                                  paddingInline: 3,
                                  overflow: "hidden",
                                }}
                              >
                                {label && (
                                  <span style={{ font: "500 8px/1 'Inter', sans-serif", color: "rgba(255,255,255,0.88)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, textAlign: "center" }}>
                                    {label}
                                  </span>
                                )}
                                {(icon || hasMarker) && (
                                  <span style={{ font: "700 8px/1 monospace", color: "rgba(255,255,255,0.95)", flexShrink: 0 }}>
                                    {icon || "▲"}
                                  </span>
                                )}
                              </div>
                              {/* Sub-metrics — one line per active metric */}
                              {subLines.map((line, li) => (
                                <div
                                  key={li}
                                  style={{
                                    font: "400 7px/1.3 'JetBrains Mono', monospace",
                                    color: "var(--text-muted)",
                                    marginTop: li === 0 ? 2 : 0,
                                    width: "calc(100% - 2px)",
                                    textAlign: "center",
                                  }}
                                >
                                  {line}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* WK outline pill — Option A: transparent bg, coloured border + text */}
                  {showWk && (
                    <div
                      style={{
                        padding: "3px 4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "var(--bg-card)",
                        borderLeft: "1px solid var(--border-subtle)",
                        minHeight: 22,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: 16,
                          borderRadius: 3,
                          background: "transparent",
                          border: `1px solid ${s.color}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          paddingInline: 3,
                          overflow: "hidden",
                        }}
                      >
                        <span
                          style={{
                            font: "700 8px/1 'Inter', sans-serif",
                            color: s.color,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {pillText}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          </div>
        );
      })}
    </div>
  );
}
