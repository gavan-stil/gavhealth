import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { AlertTriangle, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HrZoneSession {
  date: string;
  activity_type: string;
  duration_mins: number | null;
  hr_zone_0: number | null;
  hr_zone_1: number | null;
  hr_zone_2: number | null;
  hr_zone_3: number | null;
}

interface ChartRow {
  date: string;
  label: string;
  z0: number;
  z1: number;
  z2: number;
  z3: number;
}

// ---------------------------------------------------------------------------
// Colours (design tokens)
// ---------------------------------------------------------------------------

const ZONE_COLOURS = {
  z0: "var(--sand)",   // rest/low  — muted tan
  z1: "var(--ochre)",  // fat burn  — warm gold
  z2: "var(--dawn)",   // cardio    — blue-grey
  z3: "var(--rust)",   // peak      — burnt orange
};

const ZONE_LABELS = ["Rest", "Fat burn", "Cardio", "Peak"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function secToMin(s: number | null): number {
  return s != null ? Math.round(s / 60) : 0;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface TooltipProps {
  active?: boolean;
  payload?: { dataKey: string; value: number; payload: ChartRow }[];
  label?: string;
}

function ZoneTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const total = row.z0 + row.z1 + row.z2 + row.z3;
  const hiPct = total > 0 ? Math.round(((row.z2 + row.z3) / total) * 100) : 0;

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-sm) var(--space-md)",
        fontSize: 12,
        lineHeight: "1.6",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{row.label}</div>
      {[
        { label: "Rest", val: row.z0, col: ZONE_COLOURS.z0 },
        { label: "Fat burn", val: row.z1, col: ZONE_COLOURS.z1 },
        { label: "Cardio", val: row.z2, col: ZONE_COLOURS.z2 },
        { label: "Peak", val: row.z3, col: ZONE_COLOURS.z3 },
      ].map(({ label, val, col }) => (
        <div key={label} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ width: 8, height: 8, background: col, borderRadius: 2, flexShrink: 0 }} />
          <span style={{ color: "var(--text-muted)" }}>{label}</span>
          <span style={{ marginLeft: "auto", color: "var(--text-primary)" }}>{val} min</span>
        </div>
      ))}
      <div style={{ marginTop: 4, color: "var(--dawn)", fontWeight: 600 }}>
        Zone 2–3: {hiPct}%
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RunHRZonesChart() {
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<HrZoneSession[]>("/api/hr/zones?days=30")
      .then((sessions) => {
        const mapped: ChartRow[] = sessions.map((s) => ({
          date: s.date,
          label: dayLabel(s.date),
          z0: secToMin(s.hr_zone_0),
          z1: secToMin(s.hr_zone_1),
          z2: secToMin(s.hr_zone_2),
          z3: secToMin(s.hr_zone_3),
        }));
        setRows(mapped);
        setError(null);
      })
      .catch((e) => setError(e.message ?? "Failed to load HR zones"))
      .finally(() => setLoading(false));
  }, []);

  // Summary stat: avg % of session in zone 2+3
  const avgHiPct = (() => {
    if (!rows.length) return null;
    const vals = rows.map((r) => {
      const total = r.z0 + r.z1 + r.z2 + r.z3;
      return total > 0 ? (r.z2 + r.z3) / total : 0;
    });
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
  })();

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-lg)",
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-md)" }}>
        <span className="section-label" style={{ color: "var(--text-primary)" }}>
          Run HR Zones
        </span>
        {avgHiPct != null && !loading && (
          <span className="label-text" style={{ color: "var(--dawn)" }}>
            Avg Z2–3: {avgHiPct}%
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-lg)" }}>
          <Loader2 size={16} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : error ? (
        <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center", color: "var(--signal-poor)" }}>
          <AlertTriangle size={14} />
          <span className="label-text">{error}</span>
        </div>
      ) : rows.length === 0 ? (
        <p className="label-text" style={{ color: "var(--text-muted)", textAlign: "center", padding: "var(--space-lg) 0" }}>
          No run/ride sessions with HR zone data in the last 30 days.
          <br />Sync Withings to backfill.
        </p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: Math.max(rows.length * 28, 280), height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} barSize={16} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.max(0, Math.floor(rows.length / 6) - 1)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    unit="m"
                  />
                  <Tooltip content={<ZoneTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="z0" stackId="zones" fill={ZONE_COLOURS.z0} radius={0} name="Rest" />
                  <Bar dataKey="z1" stackId="zones" fill={ZONE_COLOURS.z1} radius={0} name="Fat burn" />
                  <Bar dataKey="z2" stackId="zones" fill={ZONE_COLOURS.z2} radius={0} name="Cardio" />
                  <Bar dataKey="z3" stackId="zones" fill={ZONE_COLOURS.z3} radius={[2, 2, 0, 0]} name="Peak" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap", marginTop: "var(--space-sm)" }}>
            {Object.entries(ZONE_COLOURS).map(([key, col], i) => (
              <div key={key} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ width: 8, height: 8, background: col, borderRadius: 2 }} />
                <span className="label-text" style={{ color: "var(--text-muted)" }}>
                  {ZONE_LABELS[i]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
