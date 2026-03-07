import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

/* ── Types ── */

export type TimeRange = 7 | 30 | 90;

export interface TrendsDataPoint {
  date: string;
}

export interface SleepPoint extends TrendsDataPoint {
  duration_hrs: number;
  deep_pct: number;
}

export interface RhrPoint extends TrendsDataPoint {
  rhr_bpm: number;
}

export interface SaunaPoint extends TrendsDataPoint {
  count: number;
}

export interface NutritionPoint {
  week_start: string;
  avg_calories: number;
  avg_protein_g: number;
  avg_carbs_g: number;
  avg_fat_g: number;
  consistency_pct: number;
}

export interface RunPoint extends TrendsDataPoint {
  distance_km: number;
  duration_mins: number;
}

export interface StrengthPoint extends TrendsDataPoint {
  count: number;
}

export interface WaterPoint {
  date: string;
  total_ml: number;
}

export interface TrendsData {
  sleep: SleepPoint[];
  rhr: RhrPoint[];
  sauna: SaunaPoint[];
  nutrition: NutritionPoint[];
  runs: RunPoint[];
  strength: StrengthPoint[];
  water: WaterPoint[];
}

interface UseTrendsReturn {
  data: TrendsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/* ── Raw API shapes ── */

interface RawSleep {
  sleep_date: string;
  total_sleep_hrs: number;
  deep_sleep_hrs: number | null;
}

interface RawRhr {
  log_date: string;
  rhr_bpm: number;
}

interface RawSauna {
  session_datetime: string;
  duration_mins: number;
}

interface RawFoodWeekly {
  week_start: string;
  avg_calories: number;
  avg_protein_g: number;
  avg_carbs_g: number;
  avg_fat_g: number;
  total_meals: number;
}

interface RawActivity {
  activity_date: string;
  activity_type: string;
  duration_mins: number;
  distance_km: number | null;
}

interface RawWaterEntry {
  id: number;
  logged_at: string;
  ml: number;
}

/* ── Hook ── */

export function useTrendsData(days: TimeRange): UseTrendsReturn {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const errors: string[] = [];

    const [sleepRaw, rhrRaw, saunaRaw, foodRaw, actRaw, waterRaw] = await Promise.all([
      apiFetch<{ data: RawSleep[] }>(`/api/sleep?days=${days}&limit=200`).catch(
        (e: Error) => { errors.push(`sleep: ${e.message}`); return { data: [] as RawSleep[] }; }
      ),
      apiFetch<{ data: RawRhr[] }>(`/api/rhr?days=${days}&limit=200`).catch(
        (e: Error) => { errors.push(`rhr: ${e.message}`); return { data: [] as RawRhr[] }; }
      ),
      apiFetch<{ data: RawSauna[] }>(`/api/sauna?days=${days}&limit=200`).catch(
        (e: Error) => { errors.push(`sauna: ${e.message}`); return { data: [] as RawSauna[] }; }
      ),
      apiFetch<RawFoodWeekly[]>("/api/food/weekly").catch(
        (e: Error) => { errors.push(`nutrition: ${e.message}`); return [] as RawFoodWeekly[]; }
      ),
      apiFetch<{ data: RawActivity[] }>(`/api/activity?days=${days}&limit=200`).catch(
        (e: Error) => { errors.push(`activity: ${e.message}`); return { data: [] as RawActivity[] }; }
      ),
      apiFetch<RawWaterEntry[]>(`/api/water?days=${days}`).catch(
        () => [] as RawWaterEntry[]
      ),
    ]);

    // Sleep: map fields, compute deep_pct
    const sleep: SleepPoint[] = (sleepRaw.data || [])
      .map((s) => ({
        date: s.sleep_date,
        duration_hrs: s.total_sleep_hrs ?? 0,
        deep_pct:
          s.total_sleep_hrs && s.deep_sleep_hrs
            ? Math.round((s.deep_sleep_hrs / s.total_sleep_hrs) * 100)
            : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // RHR: rename date field
    const rhr: RhrPoint[] = (rhrRaw.data || [])
      .map((r) => ({ date: r.log_date, rhr_bpm: r.rhr_bpm }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Sauna: extract date from datetime, count per day
    const saunaByDay = new Map<string, number>();
    for (const s of saunaRaw.data || []) {
      const date = s.session_datetime.split("T")[0];
      saunaByDay.set(date, (saunaByDay.get(date) || 0) + 1);
    }
    const sauna: SaunaPoint[] = Array.from(saunaByDay, ([date, count]) => ({
      date,
      count,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Food: bare array, compute consistency_pct, map macros
    const nutrition: NutritionPoint[] = (foodRaw || [])
      .map((f) => ({
        week_start: f.week_start,
        avg_calories: f.avg_calories ?? 0,
        avg_protein_g: f.avg_protein_g ?? 0,
        avg_carbs_g: f.avg_carbs_g ?? 0,
        avg_fat_g: f.avg_fat_g ?? 0,
        consistency_pct: Math.min(
          100,
          Math.round(((f.total_meals ?? 0) / 7) * 100)
        ),
      }))
      .sort((a, b) => a.week_start.localeCompare(b.week_start));

    // Activities: filter client-side, skip daily_summary
    const allActs = actRaw.data || [];

    const runs: RunPoint[] = allActs
      .filter((a) => a.activity_type === "run")
      .map((a) => ({
        date: a.activity_date,
        distance_km: a.distance_km ?? 0,
        duration_mins: a.duration_mins ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Strength: "workout" type, count per day
    const strengthByDay = new Map<string, number>();
    for (const a of allActs.filter((a) => a.activity_type === "workout")) {
      strengthByDay.set(
        a.activity_date,
        (strengthByDay.get(a.activity_date) || 0) + 1
      );
    }
    const strength: StrengthPoint[] = Array.from(
      strengthByDay,
      ([date, count]) => ({ date, count })
    ).sort((a, b) => a.date.localeCompare(b.date));

    // Water: aggregate ml by local date
    const waterByDay = new Map<string, number>();
    for (const w of waterRaw) {
      const date = new Date(w.logged_at).toLocaleDateString("en-CA");
      waterByDay.set(date, (waterByDay.get(date) || 0) + w.ml);
    }
    const water: WaterPoint[] = Array.from(waterByDay, ([date, total_ml]) => ({
      date,
      total_ml,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // If ALL endpoints failed, set error
    if (errors.length === 5) {
      setError("All data endpoints failed");
      setData(null);
    } else {
      if (errors.length > 0) {
        setError(`Partial failures: ${errors.join("; ")}`);
      }
      setData({ sleep, rhr, sauna, nutrition, runs, strength, water });
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
