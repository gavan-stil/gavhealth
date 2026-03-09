import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { SleepEntry } from "@/hooks/useSleepHistory";

const COLORS = {
  deep: "#7FAABC",
  light: "rgba(127, 170, 188, 0.38)",
  awake: "#a07830",
  other: "rgba(255,255,255,0.06)",
};

function fmtHrs(hrs: number | null): string {
  if (hrs == null || hrs <= 0) return "—";
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  if (h === 0) return `${m}M`;
  return `${h}H${m > 0 ? ` ${String(m).padStart(2, "0")}M` : ""}`;
}

function formatDate(dateStr: string): string {
  const today = new Date().toLocaleDateString("en-CA");
  const yest = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
  if (dateStr === today) return "Today";
  if (dateStr === yest) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

function SleepRow({ entry }: { entry: SleepEntry }) {
  const total = entry.total_sleep_hrs ?? 0;
  const deep = Math.max(0, entry.deep_sleep_hrs ?? 0);
  const light = Math.max(0, entry.light_sleep_hrs ?? 0);
  const awake = Math.max(0, entry.awake_hrs ?? 0);

  const accounted = deep + light + awake;
  const other = Math.max(0, total - accounted);

  const deepPct = total > 0 ? (deep / total) * 100 : 0;
  const lightPct = total > 0 ? (light / total) * 100 : 0;
  const awakePct = total > 0 ? (awake / total) * 100 : 0;
  const otherPct = total > 0 ? (other / total) * 100 : 0;

  const hasScore = entry.sleep_score != null && entry.sleep_score > 0;

  return (
    <div
      style={{
        paddingBottom: "var(--space-md)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {/* Date + total + score */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-secondary)",
            letterSpacing: "0.3px",
          }}
        >
          {formatDate(entry.sleep_date)}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 15,
              fontWeight: 700,
              color: "var(--dawn)",
              letterSpacing: "-0.5px",
            }}
          >
            {fmtHrs(entry.total_sleep_hrs)}
          </span>
          {hasScore && (
            <span
              style={{
                background: "color-mix(in srgb, var(--dawn) 15%, transparent)",
                border: "1px solid color-mix(in srgb, var(--dawn) 30%, transparent)",
                borderRadius: "var(--radius-pill)",
                padding: "1px 7px",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--dawn)",
                letterSpacing: "0.5px",
                fontFamily: "var(--font-mono)",
              }}
            >
              {Math.round(entry.sleep_score!)}
            </span>
          )}
        </div>
      </div>

      {/* Stage bar */}
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
          marginBottom: 6,
          background: "var(--border-default)",
        }}
      >
        {deep > 0 && (
          <div style={{ width: `${deepPct}%`, background: COLORS.deep, flexShrink: 0 }} />
        )}
        {light > 0 && (
          <div style={{ width: `${lightPct}%`, background: COLORS.light, flexShrink: 0 }} />
        )}
        {awake > 0 && (
          <div style={{ width: `${awakePct}%`, background: COLORS.awake, flexShrink: 0 }} />
        )}
        {other > 0.05 && (
          <div style={{ width: `${otherPct}%`, background: COLORS.other, flexShrink: 0 }} />
        )}
      </div>

      {/* Stat pills */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {deep > 0 && (
          <Pill color={COLORS.deep} label="DEEP" value={fmtHrs(deep)} />
        )}
        {light > 0 && (
          <Pill color={COLORS.light} label="LIGHT" value={fmtHrs(light)} />
        )}
        {awake > 0 && (
          <Pill color={COLORS.awake} label="AWAKE" value={fmtHrs(awake)} />
        )}
      </div>
    </div>
  );
}

function Pill({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div
        style={{ width: 6, height: 6, borderRadius: 2, background: color, flexShrink: 0 }}
      />
      <span
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          fontWeight: 600,
          letterSpacing: "0.5px",
        }}
      >
        {label} {value}
      </span>
    </div>
  );
}

interface Props {
  entries: SleepEntry[];
  loading: boolean;
  onClose: () => void;
}

export default function SleepHistorySheet({ entries, loading, onClose }: Props) {
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          zIndex: 110,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 111,
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 0.22s ease-out",
        }}
      >
        {/* Handle + header */}
        <div style={{ padding: "var(--space-md) var(--space-lg) var(--space-sm)", flexShrink: 0 }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "var(--border-default)",
              margin: "0 auto var(--space-md)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span className="label-text" style={{ color: "var(--text-muted)" }}>
              SLEEP HISTORY
            </span>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Global legend */}
        <div
          style={{
            padding: "0 var(--space-lg) var(--space-sm)",
            display: "flex",
            gap: "var(--space-md)",
            flexShrink: 0,
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {[
            { label: "DEEP", color: COLORS.deep },
            { label: "LIGHT", color: COLORS.light },
            { label: "AWAKE", color: COLORS.awake },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: item.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  letterSpacing: "0.8px",
                  fontWeight: 600,
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable list */}
        <div
          style={{
            overflowY: "auto",
            padding: "var(--space-md) var(--space-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
            paddingBottom: "calc(var(--space-xl) + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {loading ? (
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: 12,
                textAlign: "center",
                padding: "var(--space-xl)",
              }}
            >
              Loading…
            </div>
          ) : entries.length === 0 ? (
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: 12,
                textAlign: "center",
                padding: "var(--space-xl)",
              }}
            >
              No sleep data
            </div>
          ) : (
            entries.map((entry) => <SleepRow key={`${entry.sleep_date}-${entry.id}`} entry={entry} />)
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(60px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>,
    document.body,
  );
}
