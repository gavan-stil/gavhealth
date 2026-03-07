import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

export interface ActivityFeedItem {
  id: number;
  type: string;
  date: string;
  start_time: string | null;
  duration_minutes: number | null;
  avg_bpm: number | null;
  effort: number | null;
}

export interface MoodEntry {
  id: number;
  logged_at: string;
  mood: number;
  energy: number;
}

export interface WaterEntry {
  id: number;
  logged_at: string;
  ml: number;
}

export interface FoodEntry {
  log_date: string;
  calories_kcal: number;
}

interface FoodApiResponse {
  data: FoodEntry[];
  total: number;
}

export interface TodayStats {
  mood: number | null;
  energy: number | null;
  water_ml: number;
  calories_kcal: number;
}

function useFetch<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);
    apiFetch<T>(path)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { data, loading, error, refetch: fetchData };
}

export default function useDashboardV2() {
  const activities = useFetch<ActivityFeedItem[]>('/api/activities/feed?days=14');
  const mood = useFetch<MoodEntry[]>('/api/mood?days=30');
  const water = useFetch<WaterEntry[]>('/api/water?days=14');
  const foodRaw = useFetch<FoodApiResponse>('/api/food?days=14');
  // Unwrap paginated response: { data: FoodEntry[], total, ... } → FoodEntry[]
  const food = {
    ...foodRaw,
    data: foodRaw.data?.data ?? null,
  };

  const refetch = useCallback(() => {
    activities.refetch();
    mood.refetch();
    water.refetch();
    food.refetch();
  }, [activities.refetch, mood.refetch, water.refetch, food.refetch]);

  // Today's stats for QuickStatsRow — use local date to avoid UTC day-boundary bug (Brisbane UTC+10)
  const toLocalDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
  const todayLocal = new Date().toLocaleDateString('en-CA');
  const todayMood = mood.data?.find(m => toLocalDate(m.logged_at) === todayLocal) ?? null;
  const todayWater = water.data
    ? water.data.filter(w => toLocalDate(w.logged_at) === todayLocal).reduce((sum, w) => sum + w.ml, 0)
    : 0;
  const todayKcal = food.data
    ? food.data.filter(f => f.log_date === todayLocal).reduce((sum, f) => sum + f.calories_kcal, 0)
    : 0;

  const todayStats: TodayStats = {
    mood: todayMood?.mood ?? null,
    energy: todayMood?.energy ?? null,
    water_ml: todayWater,
    calories_kcal: todayKcal,
  };

  return { activities, mood, water, food, todayStats, refetch };
}
