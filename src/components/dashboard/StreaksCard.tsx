import { Dumbbell, Thermometer, Wind, BookOpen } from "lucide-react";
import type { StreaksData } from "@/hooks/useDashboard";

const streakConfig = [
  { key: "training" as const, label: "TRAIN", Icon: Dumbbell },
  { key: "sauna" as const, label: "SAUNA", Icon: Thermometer },
  { key: "breathing" as const, label: "BREATHE", Icon: Wind },
  { key: "devotions" as const, label: "DEVOS", Icon: BookOpen },
];

export default function StreaksCard({ data }: { data: StreaksData }) {
  return (
    <div
      className="goe-card"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
      }}
    >
      <span className="label-text" style={{ color: "var(--text-muted)" }}>
        STREAKS
      </span>

      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          marginTop: "var(--space-md)",
        }}
      >
        {streakConfig.map(({ key, label, Icon }) => (
          <div key={key} style={{ textAlign: "center" }}>
            <Icon
              size={16}
              style={{ color: "var(--text-tertiary)" }}
            />
            <div
              className="stat-number"
              style={{
                color: "var(--text-primary)",
                marginTop: "var(--space-xs)",
              }}
            >
              {data[key]}
            </div>
            <div
              className="label-text"
              style={{
                color: "var(--text-muted)",
                marginTop: "var(--space-xs)",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
