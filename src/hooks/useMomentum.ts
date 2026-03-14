import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface MomentumSignal {
  signal: string;
  label: string;
  unit: string;
  group: string;
  target_min: number | null;
  target_max: number | null;
  baseline_28d: number | null;
  today: number | null;
  avg_7d: number | null;
  trend_7d: "improving" | "declining" | "stable";
  gap_pct: number | null;
  status: "on_track" | "improving" | "off_track";
}

export interface MomentumData {
  overall_trend: "improving" | "declining" | "stable";
  signals_on_track: number;
  signals_total: number;
  signals: MomentumSignal[];
}

export default function useMomentum() {
  const [data, setData] = useState<MomentumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiFetch<MomentumData>("/api/momentum");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load momentum");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}
