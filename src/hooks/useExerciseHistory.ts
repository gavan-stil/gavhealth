import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { ExerciseSession } from "@/types/trends";

interface UseExerciseHistoryReturn {
  data: ExerciseSession[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useExerciseHistory(
  exerciseId: number,
  days: number
): UseExerciseHistoryReturn {
  const [data, setData] = useState<ExerciseSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<ExerciseSession[]>(
        `/api/strength/exercise/${exerciseId}/history?days=${days}`
      );
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load exercise history");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [exerciseId, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
