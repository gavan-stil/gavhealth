import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch } from "@/lib/api";
import useMomentumSignals from "@/hooks/useMomentumSignals";
import SignalDeviationChart from "@/components/dashboard/SignalDeviationChart";

interface GoalRow {
  id: number;
  signal: string;
  label: string;
  unit: string;
  group: string;
  target_min: number | null;
  target_max: number | null;
  set_at: string;
  notes: string | null;
}

interface HistoryRow {
  id: number;
  target_min: number | null;
  target_max: number | null;
  set_at: string;
  notes: string | null;
}

const SIGNALS = ["sleep_hrs", "rhr_bpm", "weight_kg", "calories_in", "protein_g", "water_ml"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

interface SignalSectionProps {
  goal: GoalRow;
  signals7d: ReturnType<typeof useMomentumSignals>;
}

function SignalSection({ goal, signals7d }: SignalSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTrend, setShowTrend] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [minVal, setMinVal] = useState(goal.target_min?.toString() ?? "");
  const [maxVal, setMaxVal] = useState(goal.target_max?.toString() ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Local copies of the target so the header updates immediately after save
  const [displayMin, setDisplayMin] = useState<number | null>(goal.target_min);
  const [displayMax, setDisplayMax] = useState<number | null>(goal.target_max);

  const baseline = signals7d.data?.baselines?.[goal.signal] ?? null;
  const target = signals7d.data?.targets?.[goal.signal];
  const chartDays =
    signals7d.data?.days.map((d) => ({
      date: d.date,
      value: (d as unknown as Record<string, number | null>)[goal.signal] ?? null,
    })) ?? [];

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const rows = await apiFetch<HistoryRow[]>(`/api/goals/${goal.signal}/history`);
      setHistory(rows);
    } catch {
      // silent
    } finally {
      setHistLoading(false);
    }
  }, [goal.signal]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          signal: goal.signal,
          target_min: minVal !== "" ? parseFloat(minVal) : null,
          target_max: maxVal !== "" ? parseFloat(maxVal) : null,
          notes: notes || null,
        }),
      });
      const newMin = minVal !== "" ? parseFloat(minVal) : null;
      const newMax = maxVal !== "" ? parseFloat(maxVal) : null;
      setDisplayMin(newMin);
      setDisplayMax(newMax);
      setSaved(true);
      setShowForm(false);
      setNotes("");
      setTimeout(() => setSaved(false), 2000);
      // reload history if visible
      if (showHistory) await loadHistory();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div className="section-head" style={{ color: "var(--text-primary)" }}>{goal.label}</div>
          <div className="label-text" style={{ color: "var(--text-muted)", marginTop: 2 }}>{goal.unit}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="small-number" style={{ color: "var(--ochre)" }}>
            {displayMin !== null && displayMax !== null
              ? `${displayMin} – ${displayMax}`
              : "Not set"}
          </div>
          <div className="label-text" style={{ color: "var(--text-muted)", marginTop: 2 }}>target range</div>
        </div>
      </div>

      {/* Baseline */}
      {baseline !== null && (
        <div className="body-text" style={{ color: "var(--text-secondary)" }}>
          Your 28-day average: <strong style={{ color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>{baseline} {goal.unit}</strong>
        </div>
      )}

      {/* Trend toggle */}
      <button
        onClick={() => setShowTrend((v) => !v)}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          fontSize: 12,
          cursor: "pointer",
          padding: 0,
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {showTrend ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        7-day trend
      </button>
      {showTrend && !signals7d.loading && chartDays.length > 0 && (
        <SignalDeviationChart
          days={chartDays}
          baseline={baseline}
          targetMin={target?.min}
          targetMax={target?.max}
          unit={goal.unit}
        />
      )}

      {/* Set new target */}
      <button
        onClick={() => setShowForm((v) => !v)}
        style={{
          background: showForm ? "var(--bg-elevated)" : "none",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-sm)",
          color: "var(--ochre)",
          fontSize: 13,
          cursor: "pointer",
          padding: "8px 12px",
          textAlign: "left",
        }}
      >
        {showForm ? "Cancel" : "Set New Target"}
      </button>

      {showForm && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="label-text" style={{ color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                MIN ({goal.unit})
              </label>
              <input
                type="number"
                value={minVal}
                onChange={(e) => setMinVal(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  fontFamily: "JetBrains Mono, monospace",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label className="label-text" style={{ color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                MAX ({goal.unit})
              </label>
              <input
                type="number"
                value={maxVal}
                onChange={(e) => setMaxVal(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  fontFamily: "JetBrains Mono, monospace",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
          <div>
            <label className="label-text" style={{ color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              NOTES (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Reason for change..."
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: 13,
                resize: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          {saveError && (
            <div className="body-text" style={{ color: "var(--signal-poor)" }}>{saveError}</div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: "var(--ochre)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              color: "#0d0d0a",
              fontSize: 14,
              fontWeight: 700,
              padding: "10px",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Target"}
          </button>
        </div>
      )}

      {saved && (
        <div className="body-text" style={{ color: "#e8c47a" }}>Saved.</div>
      )}

      {/* History toggle */}
      <button
        onClick={async () => {
          const next = !showHistory;
          setShowHistory(next);
          if (next && history.length === 0) await loadHistory();
        }}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          fontSize: 12,
          cursor: "pointer",
          padding: 0,
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Target history
      </button>

      {showHistory && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {histLoading ? (
            <span className="body-text" style={{ color: "var(--text-muted)" }}>Loading...</span>
          ) : history.length === 0 ? (
            <span className="body-text" style={{ color: "var(--text-muted)" }}>No history yet.</span>
          ) : (
            history.map((h, i) => (
              <div
                key={h.id}
                style={{
                  padding: "8px 10px",
                  background: i === 0 ? "rgba(232,196,122,0.05)" : "transparent",
                  borderRadius: "var(--radius-sm)",
                  borderLeft: i === 0 ? "2px solid var(--ochre)" : "2px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span className="small-number" style={{ color: "var(--text-primary)", fontSize: 13 }}>
                    {h.target_min} – {h.target_max} {goal.unit}
                  </span>
                  <span className="label-text" style={{ color: "var(--text-muted)" }}>
                    {fmtDate(h.set_at)}
                  </span>
                </div>
                {h.notes && (
                  <div className="body-text" style={{ color: "var(--text-muted)", marginTop: 2, fontSize: 12 }}>
                    {h.notes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function GoalsPage() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const signals7d = useMomentumSignals(7);

  const loadGoals = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    apiFetch<GoalRow[]>("/api/goals")
      .then((rows) => {
        const order = Object.fromEntries(SIGNALS.map((s, i) => [s, i]));
        rows.sort((a, b) => (order[a.signal] ?? 99) - (order[b.signal] ?? 99));
        setGoals(rows);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  return (
    <div
      style={{
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
        paddingBottom: "calc(var(--space-2xl) + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Back header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <button
          onClick={() => navigate("/")}
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
          <ChevronLeft size={20} />
        </button>
        <h1 className="page-title" style={{ color: "var(--text-primary)", margin: 0 }}>
          Health Goals
        </h1>
      </div>

      <p className="body-text" style={{ color: "var(--text-muted)", margin: 0 }}>
        Set target ranges for each signal. History is preserved every time you update.
      </p>

      {loading ? (
        <div className="body-text" style={{ color: "var(--text-muted)" }}>Loading...</div>
      ) : loadError ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="body-text" style={{ color: "var(--signal-poor)" }}>Failed to load goals.</div>
          <button
            onClick={loadGoals}
            style={{
              background: "none",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-muted)",
              fontSize: 13,
              cursor: "pointer",
              padding: "8px 12px",
              alignSelf: "flex-start",
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        goals.map((g) => (
          <SignalSection key={g.signal} goal={g} signals7d={signals7d} />
        ))
      )}
    </div>
  );
}
