import { ChevronRight } from "lucide-react";
import type { SleepStagesData } from "@/hooks/useSleepStages";
import SleepStageBar from "./SleepStageBar";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtHrs(hrs: number | null): string {
  if (hrs == null) return "—";
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return `${h}H ${String(m).padStart(2, "0")}M`;
}

interface Props {
  data: SleepStagesData;
  onClick?: () => void;
}

export default function SleepCard({ data, onClick }: Props) {
  const bedTime = fmtTime(data.bed_time);
  const wakeTime = fmtTime(data.wake_time);
  const hasScore = data.sleep_score != null && data.sleep_score > 0;
  const score = hasScore ? Math.round(data.sleep_score!) : null;

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
        <span className="label-text" style={{ color: "var(--text-muted)" }}>SLEEP</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {score != null && (
            <span
              style={{
                background: "color-mix(in srgb, var(--dawn) 15%, transparent)",
                border: "1px solid color-mix(in srgb, var(--dawn) 40%, transparent)",
                borderRadius: "var(--radius-pill)",
                padding: "2px 10px",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--dawn)",
                letterSpacing: "0.5px",
                fontFamily: "var(--font-mono)",
              }}
            >
              {score}
            </span>
          )}
          {onClick && <ChevronRight size={14} color="var(--text-muted)" />}
        </div>
      </div>

      {/* Main duration */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
        <span className="stat-number" style={{ color: "var(--dawn)" }}>
          {fmtHrs(data.total_sleep_hrs)}
        </span>
      </div>

      {/* Times */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
        <span className="body-text" style={{ color: "var(--text-muted)" }}>{bedTime}</span>
        <span className="body-text" style={{ color: "var(--text-muted)" }}>→</span>
        <span className="body-text" style={{ color: "var(--text-muted)" }}>{wakeTime}</span>
      </div>

      {/* Stage bar */}
      {data.stages && data.stages.length > 0 ? (
        <div style={{ marginBottom: "var(--space-md)" }}>
          <SleepStageBar stages={data.stages} height={10} />
          {/* Legend */}
          <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-xs)", flexWrap: "wrap" }}>
            {[
              { label: "AWAKE", color: "#a07830" },
              { label: "LIGHT", color: "rgba(127,170,188,0.5)" },
              { label: "DEEP", color: "#7FAABC" },
              { label: "REM", color: "#9A94C4" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.8px", fontFamily: "var(--font-sans)", fontWeight: 600 }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: "var(--space-md)", height: 10 }} />
      )}

      {/* Avg HR */}
      {data.sleep_hr_avg != null && (
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-xs)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--dawn)", letterSpacing: "-0.5px" }}>
            {Math.round(data.sleep_hr_avg)}
          </span>
          <span className="body-text" style={{ color: "var(--text-muted)" }}>bpm avg</span>
        </div>
      )}
    </div>
  );
}
