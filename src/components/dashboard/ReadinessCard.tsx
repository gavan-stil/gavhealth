import { useState } from "react";
import { Info } from "lucide-react";
import type { ReadinessData } from "@/hooks/useDashboard";

function scoreColor(score: number): string {
  if (score >= 70) return "var(--signal-good)";
  if (score >= 40) return "var(--signal-caution)";
  return "var(--signal-poor)";
}

function componentColor(v: number): string {
  if (v > 0) return "var(--signal-good)";
  if (v < 0) return "var(--signal-poor)";
  return "var(--text-tertiary)";
}

function formatComponent(v: number): string {
  if (v > 0) return `+${v}`;
  return `${v}`;
}

const TOOLTIPS: Record<string, string> = {
  SLEEP: "Score from sleep duration & efficiency",
  RHR: "Resting heart rate vs your baseline",
  LOAD: "Training load from recent activity",
  REST: "Days since last hard session",
};

export default function ReadinessCard({ data }: { data: ReadinessData }) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [formulaOpen, setFormulaOpen] = useState(false);

  const breakdownItems = [
    { label: "SLEEP", value: data.components.sleep },
    { label: "RHR", value: data.components.rhr },
    { label: "LOAD", value: data.components.load },
    { label: "REST", value: data.components.rest },
  ];

  const toggleTooltip = (label: string) => {
    setActiveTooltip(activeTooltip === label ? null : label);
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
      }}
    >
      <span className="label-text" style={{ color: "var(--text-muted)" }}>
        READINESS
      </span>

      <div
        className="hero-value"
        style={{
          color: scoreColor(data.score),
          marginTop: "var(--space-xs)",
        }}
      >
        {data.score}
      </div>

      <div style={{ position: "relative", marginTop: "var(--space-sm)" }}>
        <p
          className="body-text"
          style={{
            color: "var(--text-secondary)",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            paddingRight: 20,
          }}
        >
          {data.narrative}
        </p>
        <button
          onClick={() => setFormulaOpen(!formulaOpen)}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            color: formulaOpen ? "var(--ochre)" : "var(--text-muted)",
          }}
        >
          <Info size={14} />
        </button>
        {formulaOpen && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              right: 0,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontSize: 11,
              color: "var(--text-secondary)",
              zIndex: 20,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              width: 220,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, fontSize: 11, letterSpacing: 1 }}>HOW IT'S CALCULATED</div>
            <div>70 base</div>
            <div>± sleep duration <span style={{ color: "var(--text-muted)" }}>(target 7.6hr)</span></div>
            <div>± deep sleep % <span style={{ color: "var(--text-muted)" }}>(target 43%)</span></div>
            <div>± RHR vs 7-day avg</div>
            <div>− load penalty <span style={{ color: "var(--text-muted)" }}>(if ACWR &lt; 1.3)</span></div>
            <div>− rest penalty <span style={{ color: "var(--text-muted)" }}>(5pts/day after 4 consecutive)</span></div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "var(--space-md)",
          paddingTop: "var(--space-md)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        {breakdownItems.map((item) => (
          <div key={item.label} style={{ textAlign: "center", position: "relative" }}>
            <div
              className="small-number"
              style={{ color: componentColor(item.value) }}
            >
              {formatComponent(item.value)}
            </div>
            <div
              className="label-text"
              style={{
                color: "var(--text-muted)",
                marginTop: "var(--space-xs)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              }}
            >
              {item.label}
              <button
                onClick={() => toggleTooltip(item.label)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  color: activeTooltip === item.label ? "var(--ochre)" : "var(--text-muted)",
                }}
              >
                <Info size={10} />
              </button>
            </div>
            {activeTooltip === item.label && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-sm)",
                  padding: "6px 10px",
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  zIndex: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  maxWidth: 180,
                  whiteSpace: "normal",
                  textAlign: "left",
                }}
              >
                {TOOLTIPS[item.label]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
