import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface SleepEntry {
  sleep_date: string;
  sleep_score: number | null;
}

interface ActivityEntry {
  activity_type: string;
  activity_date: string;
  notes: string | null;
}

interface GoalRingsData {
  sleepScore: number | null;
  steps: number | null;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}

function parseSteps(notes: string | null): number | null {
  if (!notes) return null;
  const match = notes.match(/steps:\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

export default function useGoalRings(dateStr?: string): GoalRingsData {
  const [sleepScore, setSleepScore] = useState<number | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const targetDate = dateStr ?? new Date().toLocaleDateString('en-CA');

  // Calculate how many days back to fetch (at least 1)
  const daysBack = Math.max(
    1,
    Math.ceil((Date.now() - new Date(targetDate + 'T00:00:00').getTime()) / 86400000) + 1,
  );

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);

    Promise.all([
      apiFetch<{ data: SleepEntry[] }>(`/api/sleep?days=${daysBack}`),
      apiFetch<{ data: ActivityEntry[] }>(`/api/activity?days=${daysBack}`),
    ])
      .then(([sleepRes, activityRes]) => {
        // Sleep score — find entry matching targetDate
        const sleepEntries = sleepRes.data ?? sleepRes;
        const matchSleep = Array.isArray(sleepEntries)
          ? sleepEntries.find(s => s.sleep_date === targetDate)
          : null;
        setSleepScore(matchSleep?.sleep_score ?? null);

        // Steps — parse from daily_summary notes for targetDate
        const activities = activityRes.data ?? activityRes;
        if (Array.isArray(activities)) {
          const summary = activities.find(
            a => a.activity_type === 'daily_summary' && a.activity_date === targetDate,
          );
          setSteps(summary ? parseSteps(summary.notes) : null);
        } else {
          setSteps(null);
        }

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

  return { sleepScore, steps, loading, error, refetch: fetchData };
}
