import { useState, useEffect } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { StrengthSession } from "@/types/trends";

// ── Types ──────────────────────────────────────────────────────────────────

type Split = "push" | "pull" | "legs" | "abs";

interface ActivityRecord {
  id: number;
  activity_type: string;
  workout_split: string | null;
}

interface ChartPoint {
  sessionDate: string;
  label: string;
  sets: number;
  volume: number;
  intensity: number;
  setsN: number;
  volumeN: number;
  intensityN: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SPLITS: { key: Split; label: string }[] = [
  { key: "push", label: "Push" },
  { key: "pull", label: "Pull" },
  { key: "legs", label: "Legs" },
  { key: "abs",  label: "Abs" },
];

// Fetch sessions over a long window so historical trends are visible
const SESSION_DAYS = 120;
// Backend caps limit at 200; 200 records covers the full SESSION_DAYS window
const ACTIVITY_LIMIT = 200;

// ── Helpers ────────────────────────────────────────────────────────────────

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function sessionLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function resolveSessionSplit(
  s: StrengthSession,
  lookup: Map<number, string | null>
): string | null {
  if (s.activity_log_id != null) {
    const ws = lookup.get(s.activity_log_id);
    if (ws) return ws;
  }
  // fall back to the session's own computed category
  return s.category ?? null;
}

function buildChartData(
  sessions: StrengthSession[],
  split: Split,
  lookup: Map<number, string | null>
): ChartPoint[] {
  const filtered = sessions
    .filter((s) => resolveSessionSplit(s, lookup) === split)
    .sort((a, b) => a.session_date.localeCompare(b.session_date));

  if (!filtered.length) return [];

  const maxSets = Math.max(...filtered.map((s) => s.total_sets), 1);
  const maxVol  = Math.max(...filtered.map((s) => s.total_load_kg), 1);
  const maxInt  = Math.max(...filtered.map((s) => s.avg_load_per_set_kg), 1);

  return filtered.map((s) => ({
    sessionDate: s.session_date,
    label: shortDate(s.session_date),
    sets:       s.total_sets,
    volume:     Math.round(s.total_load_kg),
    intensity:  Math.round(s.avg_load_per_set_kg),
    setsN:      Math.round((s.total_sets / maxSets) * 100),
    volumeN:    Math.round((s.total_load_kg / maxVol) * 100),
    intensityN: Math.round((s.avg_load_per_set_kg / maxInt) * 100),
  }));
}

// ── Tooltip ────────────────────────────────────────────────────────────────

interface TooltipPayload {
  payload?: ChartPoint;
}

function SplitTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: "8px 12px",
        fontSize: 12,
        minWidth: 130,
      }}
    >
      <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>
        {sessionLabel(d.sessionDate)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span>
          <span style={{ color: "var(--text-muted)" }}>Volume: </span>
          <span style={{ color: "var(--ochre)", fontWeight: 700 }}>
            {d.volume >= 1000 ? `${(d.volume / 1000).toFixed(1)}t` : `${d.volume}kg`}
          </span>
        </span>
        <span>
          <span style={{ color: "var(--text-muted)" }}>Sets: </span>
          <span style={{ color: "var(--dawn)", fontWeight: 700 }}>{d.sets}</span>
        </span>
        <span>
          <span style={{ color: "var(--text-muted)" }}>Intensity: </span>
          <span style={{ color: "var(--clay)", fontWeight: 700 }}>{d.intensity}kg/set</span>
        </span>
      </div>
    </div>
  );
}

// ── Summary row ────────────────────────────────────────────────────────────

function SummaryRow({ data }: { data: ChartPoint[] }) {
  if (data.length < 2) return null;

  const first = data[0];
  const last  = data[data.length - 1];

  const volDelta = last.volume - first.volume;
  const setsDelta = last.sets - first.sets;
  const intDelta = last.intensity - first.intensity;

  const deltaColor = (v: number) =>
    v > 0 ? "var(--signal-good)" : v < 0 ? "var(--ember)" : "var(--text-muted)";
  const fmt = (v: number) => (v > 0 ? `+${v}` : `${v}`);

  const cellStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-around",
        paddingTop: "var(--space-md)",
        borderTop: "1px solid var(--border-default)",
        marginTop: "var(--space-sm)",
      }}
    >
      <div style={cellStyle}>
        <span style={labelStyle}>Volume Δ</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: deltaColor(volDelta) }}>
          {fmt(volDelta)}kg
        </span>
        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
          latest {last.volume >= 1000 ? `${(last.volume / 1000).toFixed(1)}t` : `${last.volume}kg`}
        </span>
      </div>
      <div style={cellStyle}>
        <span style={labelStyle}>Sets Δ</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: deltaColor(setsDelta) }}>
          {fmt(setsDelta)}
        </span>
        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>latest {last.sets}</span>
      </div>
      <div style={cellStyle}>
        <span style={labelStyle}>Intensity Δ</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: deltaColor(intDelta) }}>
          {fmt(intDelta)}kg
        </span>
        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
          {last.intensity}kg/set
        </span>
      </div>
      <div style={cellStyle}>
        <span style={labelStyle}>Sessions</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
          {data.length}
        </span>
        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>total</span>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-lg)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-md)",
};

const pulseStyle: React.CSSProperties = {
  background:
    "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-card-hover) 50%, var(--bg-card) 75%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-pulse 1.5s ease-in-out infinite",
  borderRadius: "var(--radius-sm)",
};

// ── Component ──────────────────────────────────────────────────────────────

export default function SplitProgressChart() {
  const [split, setSplit] = useState<Split>("push");
  const [sessions, setSessions] = useState<StrengthSession[] | null>(null);
  const [lookup, setLookup] = useState<Map<number, string | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch<StrengthSession[]>(`/api/strength/sessions?days=${SESSION_DAYS}`),
      apiFetch<unknown>(`/api/activity?days=${SESSION_DAYS}&limit=${ACTIVITY_LIMIT}`),
    ])
      .then(([sessionData, activityRaw]) => {
        setSessions(sessionData);

        // Activity endpoint returns { data: [...], total, limit, offset }
        const activityList: ActivityRecord[] = Array.isArray(activityRaw)
          ? (activityRaw as ActivityRecord[])
          : ((activityRaw as { data?: ActivityRecord[] }).data ?? []);

        const map = new Map<number, string | null>();
        for (const a of activityList) {
          if (a.activity_type === "workout") {
            map.set(a.id, a.workout_split);
          }
        }
        setLookup(map);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const refetch = () => {
    setSessions(null);
    setLookup(new Map());
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<StrengthSession[]>(`/api/strength/sessions?days=${SESSION_DAYS}`),
      apiFetch<unknown>(`/api/activity?days=${SESSION_DAYS}&limit=${ACTIVITY_LIMIT}`),
    ])
      .then(([sessionData, activityRaw]) => {
        setSessions(sessionData);
        const activityList: ActivityRecord[] = Array.isArray(activityRaw)
          ? (activityRaw as ActivityRecord[])
          : ((activityRaw as { data?: ActivityRecord[] }).data ?? []);
        const map = new Map<number, string | null>();
        for (const a of activityList) {
          if (a.activity_type === "workout") map.set(a.id, a.workout_split);
        }
        setLookup(map);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ ...pulseStyle, width: "55%", height: 10 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ ...pulseStyle, width: 56, height: 26 }} />
          ))}
        </div>
        <div style={{ ...pulseStyle, width: "100%", height: 160 }} />
      </div>
    );
  }

  if (error && !sessions) {
    return (
      <div
        style={{
          ...cardStyle,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 100,
          gap: "var(--space-sm)",
        }}
      >
        <AlertTriangle size={16} style={{ color: "var(--signal-poor)" }} />
        <span className="body-text" style={{ color: "var(--text-muted)" }}>
          Couldn't load split data
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

  const data = sessions ? buildChartData(sessions, split, lookup) : [];

  return (
    <div style={cardStyle}>
      {/* Header */}
      <span className="label-text" style={{ color: "var(--text-muted)" }}>
        SPLIT PROGRESS
      </span>

      {/* Split tabs */}
      <div style={{ display: "flex", gap: "var(--space-xs)" }}>
        {SPLITS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSplit(s.key)}
            style={{
              padding: "4px 14px",
              borderRadius: "var(--radius-pill)",
              border: "1px solid",
              borderColor: split === s.key ? "var(--ochre)" : "var(--border-default)",
              background: split === s.key ? "rgba(212,160,74,0.15)" : "transparent",
              color: split === s.key ? "var(--ochre)" : "var(--text-muted)",
              fontSize: 11,
              fontFamily: "inherit",
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
        {[
          { color: "var(--ochre)", label: "Volume" },
          { color: "var(--dawn)", label: "Sets" },
          { color: "var(--clay)", label: "Intensity" },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 2, background: color, display: "inline-block" }} />
            <span style={{ color: "var(--text-muted)" }}>{label}</span>
          </span>
        ))}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 9,
            color: "var(--text-muted)",
            alignSelf: "center",
          }}
        >
          normalised
        </span>
      </div>

      {/* Chart or empty state */}
      {data.length < 2 ? (
        <div
          style={{
            height: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          {data.length === 0
            ? `No ${split} sessions in last ${SESSION_DAYS} days`
            : "Log another session to see trends"}
        </div>
      ) : (
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ minWidth: Math.max(data.length * 36, 280) }}>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="splitVolGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#d4a04a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#d4a04a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={data.length <= 8 ? 0 : Math.floor(data.length / 6)}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  ticks={[0, 25, 50, 75, 100]}
                  width={36}
                />
                <Tooltip content={<SplitTooltip />} />
                <Area
                  dataKey="volumeN"
                  stroke="#d4a04a"
                  strokeWidth={2}
                  fill="url(#splitVolGrad)"
                  dot={false}
                  connectNulls
                  type="monotone"
                  name="Volume"
                />
                <Line
                  dataKey="setsN"
                  stroke="var(--dawn)"
                  strokeWidth={1.5}
                  dot={{ r: 2.5, fill: "var(--dawn)", strokeWidth: 0 }}
                  connectNulls
                  type="monotone"
                  name="Sets"
                />
                <Line
                  dataKey="intensityN"
                  stroke="var(--clay)"
                  strokeWidth={1.5}
                  dot={{ r: 2.5, fill: "var(--clay)", strokeWidth: 0 }}
                  connectNulls
                  type="monotone"
                  name="Intensity"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <SummaryRow data={data} />
    </div>
  );
}
