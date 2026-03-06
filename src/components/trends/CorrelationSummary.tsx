import { rollingAverage, pearsonR } from "@/lib/correlation";
import type { TrendsData } from "@/hooks/useTrendsData";

interface Props {
  data: TrendsData;
}

interface CorrelationRow {
  label: string;
  r: number | null;
}

function alignByDate(
  seriesA: { date: string; value: number }[],
  seriesB: { date: string; value: number }[]
): { a: number[]; b: number[] } {
  const mapB = new Map(seriesB.map((d) => [d.date, d.value]));
  const a: number[] = [];
  const b: number[] = [];
  for (const pt of seriesA) {
    const bVal = mapB.get(pt.date);
    if (bVal !== undefined) {
      a.push(pt.value);
      b.push(bVal);
    }
  }
  return { a, b };
}

function computeCorrelations(data: TrendsData): CorrelationRow[] {
  const results: CorrelationRow[] = [];

  // 1. Sleep duration → Run distance
  {
    const sleepSeries = data.sleep.map((s) => ({ date: s.date, value: s.duration_hrs }));
    // Aggregate runs by date (sum distance)
    const runByDate = new Map<string, number>();
    for (const r of data.runs) {
      runByDate.set(r.date, (runByDate.get(r.date) || 0) + r.distance_km);
    }
    const runSeries = Array.from(runByDate, ([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const { a, b } = alignByDate(sleepSeries, runSeries);
    if (a.length >= 3) {
      const ra = rollingAverage(a, 7);
      const rb = rollingAverage(b, 7);
      results.push({ label: "Sleep → Run Performance", r: pearsonR(ra, rb) });
    } else {
      results.push({ label: "Sleep → Run Performance", r: null });
    }
  }

  // 2. RHR (inverted) → Strength frequency
  {
    const rhrSeries = data.rhr.map((r) => ({ date: r.date, value: r.rhr_bpm }));
    const maxRhr = Math.max(...rhrSeries.map((r) => r.value), 1);
    const invertedRhr = rhrSeries.map((r) => ({ date: r.date, value: maxRhr - r.value }));

    const strSeries = data.strength.map((s) => ({ date: s.date, value: s.count }));

    const { a, b } = alignByDate(invertedRhr, strSeries);
    if (a.length >= 3) {
      const ra = rollingAverage(a, 7);
      const rb = rollingAverage(b, 7);
      results.push({ label: "RHR → Strength", r: pearsonR(ra, rb) });
    } else {
      results.push({ label: "RHR → Strength", r: null });
    }
  }

  // 3. Recovery composite → total activity volume (minutes)
  {
    // Build recovery composite per date (sleep + deep% + inverted rhr + sauna)
    const allDates = new Set<string>();
    data.sleep.forEach((d) => allDates.add(d.date));
    data.rhr.forEach((d) => allDates.add(d.date));

    const sleepMap = new Map(data.sleep.map((s) => [s.date, s.duration_hrs]));
    const deepMap = new Map(data.sleep.map((s) => [s.date, s.deep_pct]));
    const rhrMap = new Map(data.rhr.map((r) => [r.date, r.rhr_bpm]));
    const saunaMap = new Map(data.sauna.map((s) => [s.date, s.count]));

    const sortedDates = Array.from(allDates).sort();
    const recoverySeries = sortedDates.map((d) => {
      const sl = sleepMap.get(d) ?? 0;
      const dp = deepMap.get(d) ?? 0;
      const rh = rhrMap.get(d) ?? 0;
      const sa = saunaMap.get(d) ?? 0;
      // Simple composite: sum of normalized-ish values (just average raw for correlation purposes)
      return { date: d, value: sl + dp / 100 + (rh > 0 ? 100 / rh : 0) + sa };
    });

    // Total activity minutes per day
    const actMinsByDate = new Map<string, number>();
    for (const r of data.runs) {
      actMinsByDate.set(r.date, (actMinsByDate.get(r.date) || 0) + r.duration_mins);
    }
    // Add strength (estimate 45 min per session)
    for (const s of data.strength) {
      actMinsByDate.set(s.date, (actMinsByDate.get(s.date) || 0) + s.count * 45);
    }
    const actSeries = Array.from(actMinsByDate, ([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const { a, b } = alignByDate(recoverySeries, actSeries);
    if (a.length >= 3) {
      const ra = rollingAverage(a, 7);
      const rb = rollingAverage(b, 7);
      results.push({ label: "Recovery → Activity Volume", r: pearsonR(ra, rb) });
    } else {
      results.push({ label: "Recovery → Activity Volume", r: null });
    }
  }

  return results;
}

function getStrength(r: number): { color: string; text: string } {
  const abs = Math.abs(r);
  const dir = r >= 0 ? "positive" : "negative";
  if (abs > 0.5)
    return { color: "var(--signal-good)", text: `Strong ${dir}` };
  if (abs >= 0.3)
    return { color: "var(--signal-caution)", text: "Moderate" };
  return { color: "var(--text-muted)", text: "Weak" };
}

export default function CorrelationSummary({ data }: Props) {
  const correlations = computeCorrelations(data);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
      }}
    >
      <span
        className="label-text"
        style={{ color: "var(--text-muted)", marginBottom: "var(--space-md)", display: "block" }}
      >
        CORRELATION INSIGHTS
      </span>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
        {correlations.map((c) => {
          if (c.r === null) {
            return (
              <div
                key={c.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span className="body-text" style={{ color: "var(--text-secondary)" }}>
                  {c.label}
                </span>
                <span className="label-text" style={{ color: "var(--text-muted)" }}>
                  Insufficient data
                </span>
              </div>
            );
          }

          const { color, text } = getStrength(c.r);
          return (
            <div
              key={c.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "var(--space-xs)",
              }}
            >
              <span className="body-text" style={{ color: "var(--text-secondary)", flex: 1 }}>
                {c.label}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                <span className="small-number" style={{ color }}>
                  r = {c.r.toFixed(2)}
                </span>
                <span className="label-text" style={{ color }}>
                  {text}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
