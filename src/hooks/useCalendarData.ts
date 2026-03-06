import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { CalendarData, CategoryDot, CategoryName } from "@/types/calendar";
import { CATEGORY_COLORS, CATEGORY_ORDER } from "@/types/calendar";

/* ── Actual API response shapes (verified against live endpoints) ── */

type RawActivity = {
  activity_date: string;
  activity_type: string; // "run" | "workout" | "ride" | "daily_summary"
  duration_mins: number;
  distance_km: number | null;
  avg_pace_secs: number | null;
  avg_hr: number | null;
  notes: string | null;
  effort?: string;
};

type RawSleep = {
  sleep_date: string;
  total_sleep_hrs: number;
  deep_sleep_hrs: number | null;
};

type RawSauna = {
  session_datetime: string;
  duration_mins: number;
  temperature_c: number;
  did_devotions?: boolean;
};

type RawWeight = {
  recorded_at: string;
  weight_kg: number;
};

type RawRhr = {
  log_date: string;
  rhr_bpm: number;
};

/* ── Helpers ── */

type DayEntry = {
  category: CategoryName;
  duration: string;
  subMetrics: Record<string, string>;
  isLetsGo?: boolean;
  isInterval?: boolean;
  saunaHasDevotion?: boolean;
};

function fmt(n: number | undefined | null, unit: string, decimals = 1): string {
  if (n === undefined || n === null) return "—";
  return `${Number(n).toFixed(decimals)}${unit}`;
}

function fmtInt(n: number | undefined | null, unit: string): string {
  if (n === undefined || n === null) return "—";
  return `${Math.round(n)}${unit}`;
}

/* ── Hook ── */

export function useCalendarData() {
  const [data, setData] = useState<CalendarData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refetch = () => setVersion(v => v + 1);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const errors: string[] = [];

      // Correct paths: /api/activity, /api/sleep, /api/sauna, /api/weight, /api/rhr
      // All except food wrap response in { data: [] }
      const [activityRes, sleepRes, saunaRes, weightRes, rhrRes] = await Promise.all([
        apiFetch<{ data: RawActivity[] }>("/api/activity?days=90&limit=200").catch(
          (e: Error) => { errors.push(`activities: ${e.message}`); return { data: [] as RawActivity[] }; }
        ),
        apiFetch<{ data: RawSleep[] }>("/api/sleep?days=90&limit=200").catch(
          (e: Error) => { errors.push(`sleep: ${e.message}`); return { data: [] as RawSleep[] }; }
        ),
        apiFetch<{ data: RawSauna[] }>("/api/sauna?days=90&limit=200").catch(
          (e: Error) => { errors.push(`sauna: ${e.message}`); return { data: [] as RawSauna[] }; }
        ),
        apiFetch<{ data: RawWeight[] }>("/api/weight?days=90&limit=200").catch(
          (e: Error) => { errors.push(`weight: ${e.message}`); return { data: [] as RawWeight[] }; }
        ),
        apiFetch<{ data: RawRhr[] }>("/api/rhr?days=90&limit=200").catch(
          (e: Error) => { errors.push(`rhr: ${e.message}`); return { data: [] as RawRhr[] }; }
        ),
      ]);

      if (cancelled) return;

      // Unwrap .data from each response
      const allActivities = activityRes.data || [];
      const sleepRecords = sleepRes.data || [];
      const saunaRecords = saunaRes.data || [];
      const weightRecords = weightRes.data || [];
      const rhrRecords = rhrRes.data || [];

      // Filter activities: skip daily_summary, split by type
      const activities = allActivities.filter(a => a.activity_type !== "daily_summary");
      const runs = activities.filter(a => a.activity_type === "run");
      const workouts = activities.filter(a => a.activity_type === "workout");
      const rides = activities.filter(a => a.activity_type === "ride");

      // Build a Map<date, DayEntry[]>
      const dayMap = new Map<string, DayEntry[]>();

      function addEntry(date: string, entry: DayEntry) {
        if (!dayMap.has(date)) dayMap.set(date, []);
        dayMap.get(date)!.push(entry);
      }

      // Weight — field: recorded_at (ISO timestamp), weight_kg
      const sortedWeight = [...weightRecords]
        .map(w => ({ date: w.recorded_at.split("T")[0], weight_kg: w.weight_kg }))
        .sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 0; i < sortedWeight.length; i++) {
        const w = sortedWeight[i];
        const prev = i > 0 ? sortedWeight[i - 1].weight_kg : undefined;
        const delta = prev !== undefined ? w.weight_kg - prev : undefined;
        addEntry(w.date, {
          category: "weight",
          duration: fmt(w.weight_kg, "kg"),
          subMetrics: {
            kg: fmt(w.weight_kg, "kg"),
            delta: delta !== undefined ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}` : "—",
          },
        });
      }

      // Sleep — field: sleep_date, total_sleep_hrs, deep_sleep_hrs (compute pct)
      for (const s of sleepRecords) {
        const deepPct = (s.total_sleep_hrs && s.deep_sleep_hrs)
          ? Math.round((s.deep_sleep_hrs / s.total_sleep_hrs) * 100)
          : 0;
        addEntry(s.sleep_date, {
          category: "sleep",
          duration: fmt(s.total_sleep_hrs, "h"),
          subMetrics: {
            deep: `${deepPct}%`,
          },
        });
      }

      // Heart (RHR) — field: log_date, rhr_bpm
      for (const r of rhrRecords) {
        addEntry(r.log_date, {
          category: "heart",
          duration: fmtInt(r.rhr_bpm, ""),
          subMetrics: {
            rhr: fmtInt(r.rhr_bpm, ""),
          },
        });
      }

      // Running — field: activity_date, duration_mins, distance_km, avg_pace_secs
      for (const a of runs) {
        const durStr = a.duration_mins
          ? fmtInt(a.duration_mins, "m")
          : a.distance_km
          ? fmt(a.distance_km, "km")
          : "—";
        const intervalKeywords = ['interval', 'tempo', 'sprint', 'repeat', 'fartlek'];
        const isInterval = intervalKeywords.some(kw => (a.notes ?? '').toLowerCase().includes(kw));
        addEntry(a.activity_date, {
          category: "running",
          duration: durStr,
          subMetrics: {
            dist: a.distance_km != null ? fmt(a.distance_km, "km") : "—",
            time: a.duration_mins ? fmtInt(a.duration_mins, "m") : "—",
            pace: a.avg_pace_secs != null ? fmt(a.avg_pace_secs / 60, "'/km") : "—",
          },
          isLetsGo: a.effort === 'lets_go',
          isInterval,
        });
      }

      // Strength (workout type) — field: activity_date, duration_mins
      for (const a of workouts) {
        const durStr = a.duration_mins
          ? fmtInt(a.duration_mins, "m")
          : "—";
        addEntry(a.activity_date, {
          category: "strength",
          duration: durStr,
          subMetrics: {
            sets: "—", // API doesn't return sets on activity records
          },
          isLetsGo: a.effort === 'lets_go',
        });
      }

      // Rides — field: activity_date, duration_mins, distance_km
      for (const r of rides) {
        const durStr = r.duration_mins
          ? fmtInt(r.duration_mins, "m")
          : r.distance_km
          ? fmt(r.distance_km, "km")
          : "—";
        addEntry(r.activity_date, {
          category: "ride",
          duration: durStr,
          subMetrics: {
            dist: r.distance_km != null ? fmt(r.distance_km, "km") : "—",
            speed: "—", // API doesn't return avg_speed_kmh
          },
          isLetsGo: r.effort === 'lets_go',
        });
      }

      // Sauna — field: session_datetime (ISO), duration_mins, temperature_c, did_devotions
      for (const s of saunaRecords) {
        const date = s.session_datetime.split("T")[0];
        addEntry(date, {
          category: "sauna",
          duration: fmtInt(s.duration_mins, "m"),
          subMetrics: {
            mins: fmtInt(s.duration_mins, "m"),
            temp: fmtInt(s.temperature_c, "°"),
          },
          saunaHasDevotion: s.did_devotions === true,
        });
      }

      // Convert to CalendarData with canonical ordering
      const result: CalendarData = {};
      for (const [date, entries] of dayMap) {
        const seen = new Map<CategoryName, DayEntry>();
        for (const e of entries) {
          if (!seen.has(e.category)) seen.set(e.category, e);
        }
        result[date] = CATEGORY_ORDER
          .filter((c) => seen.has(c))
          .map((c) => {
            const e = seen.get(c)!;
            return {
              category: c,
              color: CATEGORY_COLORS[c],
              duration: e.duration,
              subMetrics: e.subMetrics,
              isLetsGo: e.isLetsGo,
              isInterval: e.isInterval,
              saunaHasDevotion: e.saunaHasDevotion,
            } as CategoryDot;
          });
      }

      setData(result);
      if (errors.length > 0) {
        setError(`Partial load failures: ${errors.join("; ")}`);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [version]);

  return { data, loading, error, refetch };
}
