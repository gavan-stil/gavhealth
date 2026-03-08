import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { CalendarData, CategoryDot, CategoryName } from "@/types/calendar";
import { CATEGORY_COLORS, CATEGORY_ORDER } from "@/types/calendar";

/* ── Raw API response shapes ── */

type RawActivity = {
  activity_date: string;
  activity_type: string;
  duration_mins: number;
  distance_km: number | null;
  avg_pace_secs: number | null;
  avg_hr: number | null;
  notes: string | null;
  effort?: string;
  workout_split?: string;
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

type RawStrengthSession = {
  id: number;
  session_date: string;
  activity_log_id: number | null;
  total_sets: number;
  total_reps: number;
};

/* ── Internal helpers ── */

type DayEntry = {
  category: CategoryName;
  duration: string;
  subMetrics: Record<string, string>;
  isLetsGo?: boolean;
  isInterval?: boolean;
  saunaHasDevotion?: boolean;
  workoutSplit?: "push" | "pull" | "legs";
};

function fmt(n: number | undefined | null, unit: string, decimals = 1): string {
  if (n === undefined || n === null) return "—";
  return `${Number(n).toFixed(decimals)}${unit}`;
}

function fmtInt(n: number | undefined | null, unit: string): string {
  if (n === undefined || n === null) return "—";
  return `${Math.round(n)}${unit}`;
}

/* ── Exported types ── */

export type MonthBlock = { year: number; month: number; data: CalendarData };

/* ── Standalone fetch (called for initial load, loadPrevMonth, and refetch) ── */

async function fetchMonthData(year: number, month: number): Promise<CalendarData> {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const dateRange = `start_date=${start}&end_date=${end}&limit=200`;

  const [activityRes, sleepRes, saunaRes, weightRes, rhrRes, strengthSessionsRes] = await Promise.all([
    apiFetch<{ data: RawActivity[] }>(`/api/activity?${dateRange}`).catch(() => ({ data: [] as RawActivity[] })),
    apiFetch<{ data: RawSleep[] }>(`/api/sleep?${dateRange}`).catch(() => ({ data: [] as RawSleep[] })),
    apiFetch<{ data: RawSauna[] }>(`/api/sauna?${dateRange}`).catch(() => ({ data: [] as RawSauna[] })),
    apiFetch<{ data: RawWeight[] }>(`/api/weight?${dateRange}`).catch(() => ({ data: [] as RawWeight[] })),
    apiFetch<{ data: RawRhr[] }>(`/api/rhr?${dateRange}`).catch(() => ({ data: [] as RawRhr[] })),
    apiFetch<{ data: RawStrengthSession[] }>(`/api/strength/sessions?${dateRange}`).catch(() => ({ data: [] as RawStrengthSession[] })),
  ]);

  const allActivities = activityRes.data || [];
  const sleepRecords = sleepRes.data || [];
  const saunaRecords = saunaRes.data || [];
  const weightRecords = weightRes.data || [];
  const rhrRecords = rhrRes.data || [];

  // Map session_date → session for fast lookup
  const strengthSessionsByDate = new Map<string, RawStrengthSession>();
  for (const s of (strengthSessionsRes.data || [])) {
    strengthSessionsByDate.set(s.session_date, s);
  }

  const activities = allActivities.filter((a) => a.activity_type !== "daily_summary");
  const runs = activities.filter((a) => a.activity_type === "run");
  const workouts = activities.filter((a) => a.activity_type === "workout");
  const rides = activities.filter((a) => a.activity_type === "ride");

  const dayMap = new Map<string, DayEntry[]>();

  function addEntry(date: string, entry: DayEntry) {
    if (!dayMap.has(date)) dayMap.set(date, []);
    dayMap.get(date)!.push(entry);
  }

  // Weight
  const sortedWeight = [...weightRecords]
    .map((w) => ({ date: w.recorded_at.split("T")[0], weight_kg: w.weight_kg }))
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

  // Sleep
  for (const s of sleepRecords) {
    const deepPct =
      s.total_sleep_hrs && s.deep_sleep_hrs
        ? Math.round((s.deep_sleep_hrs / s.total_sleep_hrs) * 100)
        : 0;
    addEntry(s.sleep_date, {
      category: "sleep",
      duration: fmt(s.total_sleep_hrs, "h"),
      subMetrics: { deep: `${deepPct}%` },
    });
  }

  // Heart (RHR)
  for (const r of rhrRecords) {
    addEntry(r.log_date, {
      category: "heart",
      duration: fmtInt(r.rhr_bpm, ""),
      subMetrics: { rhr: fmtInt(r.rhr_bpm, "") },
    });
  }

  // Running
  for (const a of runs) {
    const durStr = a.duration_mins
      ? fmtInt(a.duration_mins, "m")
      : a.distance_km
      ? fmt(a.distance_km, "km")
      : "—";
    const intervalKeywords = ["interval", "tempo", "sprint", "repeat", "fartlek"];
    const isInterval = intervalKeywords.some((kw) =>
      (a.notes ?? "").toLowerCase().includes(kw)
    );
    addEntry(a.activity_date, {
      category: "running",
      duration: durStr,
      subMetrics: {
        dist: a.distance_km != null ? fmt(a.distance_km, "km") : "—",
        time: a.duration_mins ? fmtInt(a.duration_mins, "m") : "—",
        pace: a.avg_pace_secs != null ? fmt(a.avg_pace_secs / 60, "'/km") : "—",
      },
      isLetsGo: a.effort === "lets_go",
      isInterval,
    });
  }

  // Strength (workout)
  for (const a of workouts) {
    const durStr = a.duration_mins ? fmtInt(a.duration_mins, "m") : "—";
    let workoutSplit: "push" | "pull" | "legs" | undefined;
    if (a.workout_split === "push") workoutSplit = "push";
    else if (a.workout_split === "pull") workoutSplit = "pull";
    else if (a.workout_split === "legs") workoutSplit = "legs";
    const session = strengthSessionsByDate.get(a.activity_date);
    addEntry(a.activity_date, {
      category: "strength",
      duration: durStr,
      subMetrics: { sets: session ? `${session.total_sets}` : "—" },
      isLetsGo: a.effort === "lets_go",
      workoutSplit,
    });
  }

  // Rides
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
        speed: "—",
      },
      isLetsGo: r.effort === "lets_go",
    });
  }

  // Sauna
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

  // Build CalendarData with canonical ordering
  const result: CalendarData = {};
  for (const [date, entries] of dayMap) {
    const seen = new Map<CategoryName, DayEntry>();
    for (const e of entries) {
      if (!seen.has(e.category)) seen.set(e.category, e);
    }
    result[date] = CATEGORY_ORDER.filter((c) => seen.has(c)).map((c) => {
      const e = seen.get(c)!;
      return {
        category: c,
        color: CATEGORY_COLORS[c],
        duration: e.duration,
        subMetrics: e.subMetrics,
        isLetsGo: e.isLetsGo,
        isInterval: e.isInterval,
        saunaHasDevotion: e.saunaHasDevotion,
        workoutSplit: e.workoutSplit,
      } as CategoryDot;
    });
  }

  return result;
}

/* ── Hook ── */

export function useCalendarData() {
  // Stable initial month computed once on first render
  const initRef = useRef<{ year: number; month: number } | null>(null);
  if (!initRef.current) {
    const now = new Date();
    initRef.current = { year: now.getFullYear(), month: now.getMonth() };
  }
  const { year: initYear, month: initMonth } = initRef.current;

  const blocksRef = useRef<MonthBlock[]>([]);
  const earliestRef = useRef({ year: initYear, month: initMonth });
  // Captures scroll state just before a prepend so useLayoutEffect can restore it
  const scrollRestoreRef = useRef<{ prevScrollY: number; prevScrollHeight: number } | null>(null);

  const [blocks, setBlocks] = useState<MonthBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial load — runs once
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      try {
        const data = await fetchMonthData(initYear, initMonth);
        if (cancelled) return;
        const initial = [{ year: initYear, month: initMonth, data }];
        blocksRef.current = initial;
        setBlocks(initial);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore scroll position after a month is prepended to avoid jump
  useLayoutEffect(() => {
    if (scrollRestoreRef.current) {
      const { prevScrollY, prevScrollHeight } = scrollRestoreRef.current;
      const delta = document.documentElement.scrollHeight - prevScrollHeight;
      window.scrollTo(0, prevScrollY + delta);
      scrollRestoreRef.current = null;
    }
  }, [blocks.length]);

  const loadPrevMonth = useCallback(async () => {
    if (loadingPrev) return;
    const { year, month } = earliestRef.current;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;

    setLoadingPrev(true);
    try {
      const data = await fetchMonthData(prevYear, prevMonth);
      earliestRef.current = { year: prevYear, month: prevMonth };
      // Capture scroll before the DOM grows
      scrollRestoreRef.current = {
        prevScrollY: window.scrollY,
        prevScrollHeight: document.documentElement.scrollHeight,
      };
      const newBlocks = [{ year: prevYear, month: prevMonth, data }, ...blocksRef.current];
      blocksRef.current = newBlocks;
      setBlocks(newBlocks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load previous month");
    } finally {
      setLoadingPrev(false);
    }
  }, [loadingPrev]);

  const refetch = useCallback(async () => {
    const current = blocksRef.current;
    if (current.length === 0) return;
    try {
      const newBlocks = await Promise.all(
        current.map(async (b) => ({ ...b, data: await fetchMonthData(b.year, b.month) }))
      );
      blocksRef.current = newBlocks;
      setBlocks(newBlocks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh");
    }
  }, []);

  return { blocks, loading, loadingPrev, error, loadPrevMonth, refetch };
}
