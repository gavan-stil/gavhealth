import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface MomentumDay {
  date: string;
  sleep_hrs: number | null;
  rhr_bpm: number | null;
  weight_kg: number | null;
  calories_in: number | null;
  protein_g: number | null;
  water_ml: number | null;
  calories_out: number | null;
}

export interface MomentumSignalsData {
  baselines: Record<string, number | null>;
  targets: Record<string, { min: number | null; max: number | null }>;
  days: MomentumDay[];
}

export default function useMomentumSignals(days = 7) {
  const [data, setData] = useState<MomentumSignalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiFetch<MomentumSignalsData>(`/api/momentum/signals?days=${days}`);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}
