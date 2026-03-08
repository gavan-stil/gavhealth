import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface SleepEntry {
  date: string;
  sleep_score: number | null;
}

interface ActivityEntry {
  activity_type: string;
  date: string;
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

export default function useGoalRings(): GoalRingsData {
  const [sleepScore, setSleepScore] = useState<number | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);

    const todayLocal = new Date().toLocaleDateString('en-CA');

    Promise.all([
      apiFetch<{ data: SleepEntry[] }>('/api/sleep?days=1'),
      apiFetch<{ data: ActivityEntry[] }>('/api/activity?days=1'),
    ])
      .then(([sleepRes, activityRes]) => {
        // Sleep score — most recent entry
        const sleepEntries = sleepRes.data ?? sleepRes;
        const todaySleep = Array.isArray(sleepEntries)
          ? sleepEntries.find(s => s.date === todayLocal)
          : null;
        setSleepScore(todaySleep?.sleep_score ?? (Array.isArray(sleepEntries) && sleepEntries.length > 0 ? sleepEntries[0].sleep_score : null));

        // Steps — parse from daily_summary notes
        const activities = activityRes.data ?? activityRes;
        if (Array.isArray(activities)) {
          const summary = activities.find(
            a => a.activity_type === 'daily_summary' && a.date === todayLocal,
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { sleepScore, steps, loading, error, refetch: fetchData };
}
