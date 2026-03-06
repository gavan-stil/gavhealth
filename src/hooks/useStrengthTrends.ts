import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { StrengthSession } from "@/types/trends";

interface UseStrengthTrendsReturn {
  sessions: StrengthSession[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useStrengthTrends(days: number): UseStrengthTrendsReturn {
  const [sessions, setSessions] = useState<StrengthSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<StrengthSession[]>(
        `/api/strength/sessions?days=${days}`
      );
      setSessions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load strength data");
      setSessions(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { sessions, loading, error, refetch: fetchData };
}
