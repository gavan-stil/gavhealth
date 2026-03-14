import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import type { MomentumSignal } from "@/hooks/useMomentum";
import useMomentumSignals from "@/hooks/useMomentumSignals";
import SignalDeviationChart from "./SignalDeviationChart";

interface Props {
  signal: string;
  signals: MomentumSignal[];
  onClose: () => void;
}

export default function GoalDetailSheet({ signal, signals, onClose }: Props) {
  const navigate = useNavigate();
  const { data, loading } = useMomentumSignals(7);
  const meta = signals.find((s) => s.signal === signal);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const chartDays =
    data?.days.map((d) => ({
      date: d.date,
      value: (d as unknown as Record<string, number | null>)[signal] ?? null,
    })) ?? [];

  const baseline = data?.baselines?.[signal] ?? null;
  const target = data?.targets?.[signal];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
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
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          padding: "var(--space-lg)",
          zIndex: 111,
          maxHeight: "70vh",
          overflowY: "auto",
          paddingBottom: "calc(var(--space-xl) + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "var(--border-default)",
            margin: "0 auto 16px",
          }}
        />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div className="section-head" style={{ color: "var(--text-primary)" }}>
              {meta?.label ?? signal}
            </div>
            {meta?.unit && (
              <div className="label-text" style={{ color: "var(--text-muted)", marginTop: 2 }}>
                {meta.unit}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Current stats */}
        {meta && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div>
              <div className="label-text" style={{ color: "var(--text-muted)", marginBottom: 4 }}>
                TODAY
              </div>
              <div className="small-number" style={{ color: "var(--text-primary)" }}>
                {meta.today !== null ? `${meta.today}` : "—"}
              </div>
            </div>
            <div>
              <div className="label-text" style={{ color: "var(--text-muted)", marginBottom: 4 }}>
                28D AVG
              </div>
              <div className="small-number" style={{ color: "var(--text-secondary)" }}>
                {meta.baseline_28d !== null ? `${meta.baseline_28d}` : "—"}
              </div>
            </div>
            <div>
              <div className="label-text" style={{ color: "var(--text-muted)", marginBottom: 4 }}>
                TARGET
              </div>
              <div className="small-number" style={{ color: "var(--ochre)" }}>
                {meta.target_min !== null && meta.target_max !== null
                  ? `${meta.target_min}–${meta.target_max}`
                  : "Not set"}
              </div>
            </div>
          </div>
        )}

        {/* 7-day chart */}
        {loading ? (
          <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="body-text" style={{ color: "var(--text-muted)" }}>Loading...</span>
          </div>
        ) : (
          <SignalDeviationChart
            days={chartDays}
            baseline={baseline}
            targetMin={target?.min}
            targetMax={target?.max}
            unit={meta?.unit ?? ""}
          />
        )}

        {/* Edit target link */}
        <button
          onClick={() => navigate("/goals")}
          style={{
            display: "block",
            width: "100%",
            marginTop: 20,
            padding: "12px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            color: "var(--ochre)",
            fontSize: 14,
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          Edit Target →
        </button>
      </div>
    </>
  );
}
