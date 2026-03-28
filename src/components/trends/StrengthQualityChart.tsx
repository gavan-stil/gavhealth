import { useState, useEffect } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { StrengthSession } from "@/types/trends";

// ── Split lookup (activity_log_id → workout_split) ──────────────────────────
// session.category is derived from exercises (often "mixed" even for
// labelled push/pull sessions). workout_split from activity_logs is
// the authoritative user-facing split label.

interface ActivityRecord {
  id: number;
  activity_type: string;
  workout_split: string | null;
}

function resolveCategory(s: StrengthSession, lookup: Map<number, string | null>): string {
  if (s.activity_log_id != null) {
    const ws = lookup.get(s.activity_log_id);
    if (ws) return ws;
  }
  return s.category ?? "mixed";
}

// ---------------------------------------------------------------------------
// Category → colour mapping (tokens)
// ---------------------------------------------------------------------------

const CAT_COLOUR: Record<string, string> = {
  push: "var(--ochre)",
  pull: "var(--dawn)",
  legs: "var(--clay)",
  abs: "var(--sand)",
  mixed: "var(--rust)",
};

const CAT_LABEL: Record<string, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  abs: "Abs",
  mixed: "Mixed",
};

const CATEGORIES = ["push", "pull", "legs", "abs", "mixed"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map total_sets to dot radius: min 5px, max 14px */
function dotRadius(sets: number): number {
  const min = 5;
  const max = 14;
  const clamp = Math.max(1, Math.min(sets, 40));
  return min + ((clamp - 1) / (40 - 1)) * (max - min);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Custom dot shape (bubble)
// ---------------------------------------------------------------------------

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: StrengthSession;
}

function BubbleDot({ cx = 0, cy = 0, payload }: DotProps) {
  if (!payload) return null;
  const hasHR = payload.avg_hr != null;
  const r = dotRadius(payload.total_sets);
  // resolvedCategory is pre-baked into the data point
  const cat = (payload as StrengthSession & { resolvedCategory?: string }).resolvedCategory ?? payload.category ?? "mixed";
  const fill = CAT_COLOUR[cat] ?? "var(--rust)";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      fillOpacity={hasHR ? 0.9 : 0.35}
      stroke={fill}
      strokeWidth={hasHR ? 0 : 1.5}
    />
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipPayload {
  payload: StrengthSession;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: "8px 12px",
        fontSize: 12,
        minWidth: 140,
      }}
    >
      <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>
        {formatDate(s.date ?? s.session_date)}
      </div>
      <div
        style={{
          color: CAT_COLOUR[(s as StrengthSession & { resolvedCategory?: string }).resolvedCategory ?? s.category] ?? "var(--rust)",
          fontWeight: 700,
          marginBottom: 4,
          textTransform: "capitalize",
        }}
      >
        {CAT_LABEL[(s as StrengthSession & { resolvedCategory?: string }).resolvedCategory ?? s.category] ?? s.category}
      </div>
      <div style={{ color: "var(--text-primary)" }}>
        Load: {(s.total_load_kg / 1000).toFixed(2)}t
      </div>
      <div style={{ color: "var(--text-primary)" }}>
        Sets: {s.total_sets}
      </div>
      {s.avg_hr != null ? (
        <div style={{ color: "var(--text-primary)", marginTop: 2 }}>
          Avg HR: <strong>{s.avg_hr} bpm</strong>
        </div>
      ) : (
        <div style={{ color: "var(--text-muted)", marginTop: 2, fontSize: 11 }}>
          No HR data
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function StrengthQualityChart() {
  const [sessions, setSessions] = useState<StrengthSession[] | null>(null);
  const [splitLookup, setSplitLookup] = useState<Map<number, string | null>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<StrengthSession[]>("/api/strength/sessions?days=90"),
      apiFetch<unknown>("/api/activity?days=90&limit=200"),
    ])
      .then(([sessionData, activityRaw]) => {
        setSessions(sessionData);
        const list: ActivityRecord[] = Array.isArray(activityRaw)
          ? (activityRaw as ActivityRecord[])
          : ((activityRaw as { data?: ActivityRecord[] }).data ?? []);
        const map = new Map<number, string | null>();
        for (const a of list) {
          if (a.activity_type === "workout") map.set(a.id, a.workout_split);
        }
        setSplitLookup(map);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  // ── Shell ──
  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-lg)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-md)",
  };

  if (sessions === null && !error) {
    return (
      <div className="goe-card" style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--text-muted)",
          }}
        >
          <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13 }}>Loading strength data…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="goe-card" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={14} color="var(--rust)" />
          <span style={{ fontSize: 12, color: "var(--rust)" }}>{error}</span>
        </div>
      </div>
    );
  }

  const all = (sessions ?? []).map((s) => ({
    ...s,
    resolvedCategory: resolveCategory(s, splitLookup),
  }));

  // Sessions with HR data for the scatter
  const withHR = all.filter((s) => s.avg_hr != null);
  // Sessions without HR — shown as dimmed dots at y=75 placeholder
  const noHR = all.filter((s) => s.avg_hr == null);

  // Need ≥ 5 sessions total to show chart, ≥ 1 with HR for scatter
  if (all.length < 5 || withHR.length < 1) {
    return (
      <div className="goe-card" style={cardStyle}>
        <div className="label-text" style={{ color: "var(--text-muted)" }}>
          STRENGTH QUALITY
        </div>
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
            textAlign: "center",
            padding: "var(--space-xl) 0",
          }}
        >
          Keep lifting to see trends
        </div>
        {all.length > 0 && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            {withHR.length} of {all.length} sessions have HR data
          </div>
        )}
      </div>
    );
  }

  // Combine: sessions with HR get real y; sessions without HR placed at avgHR - 20 (dimmed)
  const avgHR = Math.round(withHR.reduce((s, d) => s + (d.avg_hr ?? 0), 0) / withHR.length);
  type ScatterPoint = StrengthSession & { y: number; resolvedCategory: string };
  const scatterData: ScatterPoint[] = [
    ...withHR.map((s) => ({ ...s, y: s.avg_hr as number })),
    ...noHR.map((s) => ({ ...s, y: Math.max(avgHR - 15, 60) })),
  ];

  // Axis domains
  const loads = scatterData.map((s) => s.total_load_kg);
  const hrs = withHR.map((s) => s.avg_hr as number);
  const loadMin = Math.floor(Math.min(...loads) / 1000) * 1000;
  const loadMax = Math.ceil(Math.max(...loads) / 1000) * 1000 + 2000;
  const hrMin = Math.max(50, Math.floor(Math.min(...hrs) - 10));
  const hrMax = Math.ceil(Math.max(...hrs) + 10);

  return (
    <div className="goe-card" style={cardStyle}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div className="label-text" style={{ color: "var(--text-muted)" }}>
            STRENGTH QUALITY
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
            Volume vs. heart rate — lower HR for same load = improving
          </div>
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            padding: "2px 8px",
            whiteSpace: "nowrap",
          }}
        >
          {withHR.length} of {all.length} have HR
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          fontSize: 11,
        }}
      >
        {CATEGORIES.filter((c) =>
          scatterData.some((s) => s.resolvedCategory === c)
        ).map((c) => (
          <span key={c} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: CAT_COLOUR[c],
                display: "inline-block",
              }}
            />
            <span style={{ color: "var(--text-muted)" }}>{CAT_LABEL[c]}</span>
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              border: "1.5px solid var(--text-muted)",
              background: "transparent",
              display: "inline-block",
              opacity: 0.5,
            }}
          />
          <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
            No HR
          </span>
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="total_load_kg"
            type="number"
            domain={[loadMin, loadMax]}
            name="Load"
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(1)}t`}
            label={{
              value: "Load",
              position: "insideBottomRight",
              offset: -4,
              fill: "var(--text-muted)",
              fontSize: 10,
            }}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={[hrMin, hrMax]}
            name="Avg HR"
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}`}
            label={{
              value: "HR",
              angle: -90,
              position: "insideLeft",
              fill: "var(--text-muted)",
              fontSize: 10,
            }}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Scatter
            data={scatterData}
            shape={<BubbleDot />}
            isAnimationActive={false}
          >
            {scatterData.map((_, i) => (
              <Cell key={i} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Dot size legend */}
      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        Dot size = number of sets
      </div>
    </div>
  );
}
