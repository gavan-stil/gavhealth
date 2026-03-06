import type { CalendarData, CategoryName } from "@/types/calendar";

type Props = {
  data: CalendarData;
  year: number;
  month: number;
  activeCategories: Set<CategoryName>;
};

function cardStyle(): React.CSSProperties {
  return {
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    padding: "var(--space-sm) var(--space-md)",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  };
}

function labelStyle(): React.CSSProperties {
  return {
    font: "500 9px/1 'Inter', sans-serif",
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };
}

function valueStyle(color?: string): React.CSSProperties {
  return {
    font: "600 16px/1.2 'JetBrains Mono', monospace",
    color: color ?? "var(--text-primary)",
  };
}

export default function PatternsSection({ data, year, month, activeCategories }: Props) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build a boolean array: does each day have at least one active category logged?
  const hasData: boolean[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dots = data[key];
    const active = dots
      ? dots.some((dot) => activeCategories.has(dot.category))
      : false;
    hasData.push(active);
  }

  // Active Days %
  const activeDays = hasData.filter(Boolean).length;
  const activePct = daysInMonth > 0 ? Math.round((activeDays / daysInMonth) * 100) : 0;
  const activePctColor =
    activePct > 70 ? "#6abf69" : activePct >= 50 ? "var(--ochre)" : "#c45a4a";

  // Best Streak
  let bestStreak = 0;
  let current = 0;
  for (const has of hasData) {
    if (has) {
      current++;
      if (current > bestStreak) bestStreak = current;
    } else {
      current = 0;
    }
  }

  // Rest Days
  const restDays = hasData.filter((h) => !h).length;

  // Total Time — sum duration strings that contain numbers with 'm' or 'h' suffix
  let totalMinutes = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dots = data[key];
    if (!dots) continue;
    for (const dot of dots) {
      if (!activeCategories.has(dot.category)) continue;
      if (!dot.duration) continue;
      const mMatch = dot.duration.match(/^([\d.]+)m$/);
      if (mMatch) {
        totalMinutes += parseFloat(mMatch[1]);
        continue;
      }
      const hMatch = dot.duration.match(/^([\d.]+)h$/);
      if (hMatch) {
        totalMinutes += parseFloat(hMatch[1]) * 60;
      }
    }
  }
  const totalHrs = totalMinutes / 60;
  const totalTimeStr = totalHrs >= 1 ? `${totalHrs.toFixed(1)}h` : `${Math.round(totalMinutes)}m`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "var(--space-sm)",
      }}
    >
      <div style={cardStyle()}>
        <span style={labelStyle()}>Active Days</span>
        <span style={valueStyle(activePctColor)}>{activePct}%</span>
      </div>
      <div style={cardStyle()}>
        <span style={labelStyle()}>Best Streak</span>
        <span style={valueStyle()}>{bestStreak}d</span>
      </div>
      <div style={cardStyle()}>
        <span style={labelStyle()}>Rest Days</span>
        <span style={valueStyle()}>{restDays}</span>
      </div>
      <div style={cardStyle()}>
        <span style={labelStyle()}>Total Time</span>
        <span style={valueStyle()}>{totalTimeStr}</span>
      </div>
    </div>
  );
}
