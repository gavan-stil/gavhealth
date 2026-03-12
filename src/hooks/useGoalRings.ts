import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface SleepEntry {
  sleep_date: string;
  sleep_score: number | null;
}

interface GoalRingsData {
  sleepScore: number | null;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}

export default function useGoalRings(dateStr?: string): GoalRingsData {
  const [sleepScore, setSleepScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const targetDate = dateStr ?? new Date().toLocaleDateString('en-CA');

  // Calculate how many days back to fetch (at least 2)
  const daysBack = Math.max(
    2,
    Math.ceil((Date.now() - new Date(targetDate + 'T00:00:00').getTime()) / 86400000) + 1,
  );

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);

    apiFetch<{ data: SleepEntry[] }>(`/api/sleep?days=${daysBack}`)
      .then((sleepRes) => {
        const sleepEntries = sleepRes.data ?? sleepRes;
        const matchSleep = Array.isArray(sleepEntries)
          ? sleepEntries.find(s => s.sleep_date === targetDate)
          : null;
        setSleepScore(matchSleep?.sleep_score ?? null);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { sleepScore, loading, error, refetch: fetchData };
}
