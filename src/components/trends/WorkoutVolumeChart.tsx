import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import type { StrengthSession } from "@/types/trends";

/* ── Types ── */

type Metric = "load" | "duration" | "sets" | "avg_hr";

interface WeekBucket {
  weekKey: string;
  label: string;
  sessions: StrengthSession[];
  totalLoad: number;
  totalSets: number;
  totalReps: number;
  avgDuration: number | null;
  avgHr: number | null;
}

/* ── Helpers ── */

function getISOWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week = Math.ceil(
    ((thursday.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7
  );
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function weekLabel(weekKey: string): string {
  // "2026-W09" → "W9"
  const parts = weekKey.split("-W");
  return `W${parseInt(parts[1], 10)}`;
}

function aggregateWeeks(sessions: StrengthSession[]): WeekBucket[] {
  const map = new Map<string, StrengthSession[]>();
  for (const s of sessions) {
    const key = getISOWeekKey(s.session_date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekKey, slist]) => {
      const durations = slist.map((s) => s.duration_mins).filter((d): d is number => d != null);
      const hrs = slist.map((s) => s.avg_hr).filter((h): h is number => h != null);
      return {
        weekKey,
        label: weekLabel(weekKey),
        sessions: slist,
        totalLoad: slist.reduce((sum, s) => sum + (s.total_load_kg ?? 0), 0),
        totalSets: slist.reduce((sum, s) => sum + s.total_sets, 0),
        totalReps: slist.reduce((sum, s) => sum + s.total_reps, 0),
        avgDuration: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
        avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
      };
    });
}

function metricValue(bucket: WeekBucket, metric: Metric): number {
  switch (metric) {
    case "load": return bucket.totalLoad;
    case "sets": return bucket.totalSets;
    case "avg_hr": return bucket.avgHr ?? 0;
    case "duration": return bucket.avgDuration ?? 0;
  }
}

function metricLabel(metric: Metric, value: number): string {
  switch (metric) {
    case "load": return value >= 1000 ? `${(value / 1000).toFixed(1)}t` : `${Math.round(value)}kg`;
    case "sets": return `${value}`;
    case "avg_hr": return value ? `${value}bpm` : "—";
    case "duration": return value ? `${value}m` : "—";
  }
}

/* ── Skeleton ── */

const pulseStyle: React.CSSProperties = {
  background:
    "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-card-hover) 50%, var(--bg-card) 75%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-pulse 1.5s ease-in-out infinite",
  borderRadius: "var(--radius-sm)",
};

function SkeletonBlock({ w, h }: { w: string; h: number }) {
  return <div style={{ ...pulseStyle, width: w, height: h }} />;
}

/* ── Component ── */

interface Props {
  sessions: StrengthSession[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  days: number;
}

const METRICS: { key: Metric; label: string }[] = [
  { key: "load", label: "Load" },
  { key: "duration", label: "Duration" },
  { key: "sets", label: "Sets" },
  { key: "avg_hr", label: "Avg HR" },
];

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-lg)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-md)",
};

export default function WorkoutVolumeChart({ sessions, loading, error, refetch, days: _days }: Props) {
  const [metric, setMetric] = useState<Metric>("load");
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<StrengthSession | null>(null);

  /* Loading */
  if (loading) {
    return (
      <div style={cardStyle}>
        <SkeletonBlock w="50%" h={10} />
        <div style={{ display: "flex", gap: "var(--space-xs)" }}>
          {[1, 2, 3, 4].map((i) => <SkeletonBlock key={i} w="60px" h={26} />)}
        </div>
        <SkeletonBlock w="100%" h={160} />
      </div>
    );
  }

  /* Error */
  if (error && !sessions) {
    return (
      <div style={{ ...cardStyle, alignItems: "center", justifyContent: "center", minHeight: 100 }}>
        <AlertTriangle size={16} style={{ color: "var(--signal-poor)" }} />
        <span className="body-text" style={{ color: "var(--text-muted)" }}>
          Couldn't load workout data
        </span>
        <span
          className="label-text"
          style={{ color: "var(--ochre)", cursor: "pointer" }}
          onClick={refetch}
        >
          Tap to retry
        </span>
      </div>
    );
  }

  const weeks = sessions ? aggregateWeeks(sessions) : [];

  /* Empty */
  if (!weeks.length) {
    return (
      <div style={{ ...cardStyle, alignItems: "center", justifyContent: "center", minHeight: 100 }}>
        <span className="label-text" style={{ color: "var(--text-muted)" }}>
          WORKOUT VOLUME
        </span>
        <span className="body-text" style={{ color: "var(--text-muted)" }}>
          No workouts logged yet
        </span>
      </div>
    );
  }

  const weekSessions = selectedWeek
    ? (sessions ?? []).filter((s) => getISOWeekKey(s.session_date) === selectedWeek)
    : [];

  const chartData = weeks.map((w) => ({
    label: w.label,
    weekKey: w.weekKey,
    value: metricValue(w, metric),
  }));

  return (
    <div style={cardStyle}>
      {/* Header */}
      <span className="label-text" style={{ color: "var(--text-muted)" }}>
        WORKOUT VOLUME
      </span>

      {/* Metric toggle pills */}
      <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            style={{
              padding: "4px 12px",
              borderRadius: "var(--radius-pill)",
              border: "1px solid",
              borderColor: metric === m.key ? "var(--ochre)" : "var(--border-default)",
              background: metric === m.key ? "rgba(212,160,74,0.15)" : "transparent",
              color: metric === m.key ? "var(--ochre)" : "var(--text-muted)",
              fontSize: 11,
              fontFamily: "inherit",
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Bar chart — scrollable */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: Math.max(weeks.length * 40, 300) }}>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={(d: any) => {
                if (d?.activePayload?.[0]) {
                  const wk = d.activePayload[0].payload.weekKey as string;
                  if (selectedWeek === wk) {
                    setSelectedWeek(null);
                    setSelectedSession(null);
                  } else {
                    setSelectedWeek(wk);
                    setSelectedSession(null);
                  }
                }
              }}
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "inherit" }}
                axisLine={false}
                tickLine={false}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} cursor="pointer">
                {chartData.map((entry) => (
                  <Cell
                    key={entry.weekKey}
                    fill={
                      entry.weekKey === selectedWeek
                        ? "var(--ochre)"
                        : "var(--rust, #c45a4a)"
                    }
                    fillOpacity={entry.weekKey === selectedWeek ? 1 : 0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Drill-down: session chips for selected week */}
      {selectedWeek && weekSessions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <span className="label-text" style={{ color: "var(--text-muted)" }}>
            {selectedWeek} — {weekSessions.length} session{weekSessions.length > 1 ? "s" : ""}
          </span>
          <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
            {weekSessions.map((s) => (
              <button
                key={s.id}
                onClick={() =>
                  setSelectedSession(selectedSession?.id === s.id ? null : s)
                }
                style={{
                  padding: "5px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid",
                  borderColor:
                    selectedSession?.id === s.id
                      ? "var(--ochre)"
                      : "var(--border-default)",
                  background:
                    selectedSession?.id === s.id
                      ? "rgba(212,160,74,0.12)"
                      : "var(--bg-elevated)",
                  color:
                    selectedSession?.id === s.id
                      ? "var(--ochre)"
                      : "var(--text-primary)",
                  fontSize: 11,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                {s.session_date.slice(5)} · {metricLabel(metric, metricValue({ totalLoad: s.total_load_kg, totalSets: s.total_sets, totalReps: s.total_reps, avgDuration: s.duration_mins, avgHr: s.avg_hr, sessions: [s], weekKey: "", label: "" }, metric))}
              </button>
            ))}
          </div>

          {/* Session detail panel */}
          {selectedSession && (
            <div
              style={{
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-md)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-sm)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="label-text" style={{ color: "var(--text-muted)" }}>
                  {selectedSession.session_date}
                </span>
                {selectedSession.avg_hr && (
                  <span className="label-text" style={{ color: "var(--text-muted)" }}>
                    ♥ {selectedSession.avg_hr} bpm
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "var(--space-lg)" }}>
                <div>
                  <span className="label-text" style={{ color: "var(--text-muted)", display: "block" }}>
                    LOAD
                  </span>
                  <span className="small-number" style={{ color: "var(--ochre)" }}>
                    {metricLabel("load", selectedSession.total_load_kg)}
                  </span>
                </div>
                <div>
                  <span className="label-text" style={{ color: "var(--text-muted)", display: "block" }}>
                    SETS
                  </span>
                  <span className="small-number" style={{ color: "var(--text-primary)" }}>
                    {selectedSession.total_sets}
                  </span>
                </div>
                <div>
                  <span className="label-text" style={{ color: "var(--text-muted)", display: "block" }}>
                    AVG/SET
                  </span>
                  <span className="small-number" style={{ color: "var(--text-primary)" }}>
                    {metricLabel("load", selectedSession.avg_load_per_set_kg)}
                  </span>
                </div>
                {selectedSession.duration_mins && (
                  <div>
                    <span className="label-text" style={{ color: "var(--text-muted)", display: "block" }}>
                      TIME
                    </span>
                    <span className="small-number" style={{ color: "var(--text-primary)" }}>
                      {Math.round(selectedSession.duration_mins)}m
                    </span>
                  </div>
                )}
              </div>
              {selectedSession.exercises.length > 0 && (
                <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                  {selectedSession.exercises.map((ex) => (
                    <span
                      key={ex}
                      style={{
                        padding: "2px 8px",
                        borderRadius: "var(--radius-pill)",
                        background: "rgba(212,160,74,0.1)",
                        color: "var(--ochre)",
                        fontSize: 10,
                        letterSpacing: "0.04em",
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      {ex}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
