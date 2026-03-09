import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface SleepEntry {
  id: number;
  sleep_date: string;
  total_sleep_hrs: number | null;
  deep_sleep_hrs: number | null;
  light_sleep_hrs: number | null;
  awake_hrs: number | null;
  sleep_score: number | null;
  sleep_hr_avg: number | null;
  sleep_efficiency_pct: number | null;
}

export default function useSleepHistory(days = 30) {
  const [data, setData] = useState<SleepEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);
    apiFetch<{ data: SleepEntry[] }>(`/api/sleep?days=${days}`)
      .then((res) => {
        // Deduplicate by date — keep entry with highest total_sleep_hrs
        const byDate = new Map<string, SleepEntry>();
        for (const entry of res.data) {
          const existing = byDate.get(entry.sleep_date);
          if (!existing || (entry.total_sleep_hrs ?? 0) > (existing.total_sleep_hrs ?? 0)) {
            byDate.set(entry.sleep_date, entry);
          }
        }
        const sorted = Array.from(byDate.values()).sort((a, b) =>
          b.sleep_date.localeCompare(a.sleep_date),
        );
        setData(sorted);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
