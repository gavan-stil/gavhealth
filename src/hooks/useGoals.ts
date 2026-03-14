import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface GoalTarget {
  signal: string;
  target_min: number | null;
  target_max: number | null;
}

/** Returns a map of signal → {target_min, target_max} fetched from /api/goals. */
export default function useGoals() {
  const [targets, setTargets] = useState<Record<string, GoalTarget>>({});
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const rows = await apiFetch<GoalTarget[]>("/api/goals");
      const map: Record<string, GoalTarget> = {};
      for (const r of rows) map[r.signal] = r;
      setTargets(map);
    } catch {
      // Fall through — callers use fallback values
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { targets, loading };
}
