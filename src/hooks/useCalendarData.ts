import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { CalendarData, CategoryDot, CategoryName } from "@/types/calendar";
import { CATEGORY_COLORS, CATEGORY_ORDER } from "@/types/calendar";

/* ── Raw API response shapes ── */

type RawActivity = {
  id: number;
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
  id: number;
  sleep_date: string;
  total_sleep_hrs: number;
  deep_sleep_hrs: number | null;
};

type RawSauna = {
  id: number;
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
  exercises?: string[];
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
  hasLegExercise?: boolean;
  recordId?: number;
};

function fmt(n: number | undefined | null, unit: string, decimals = 1): string {
  if (n === undefined || n === null) return "—";
  return `${Number(n).toFixed(decimals)}${unit}`;
}

function fmtInt(n: number | undefined | null, unit: string): string {
  if (n === undefined || n === null) return "—";
  return `${Math.round(n)}${unit}`;
}

/** Infer push/pull split and leg presence from session exercise list.
 *  Exercise format: "Name - category" or "Name - cat1 + cat2"
 *  Pull: majority of exercises include "back" or "arms" category
 *  Push: majority of exercises include "chest" or "shoulders" category
 *  hasLegExercise: any exercise includes "legs" category or "leg" in name
 */
function inferSplit(exercises: string[]): { split?: "push" | "pull"; hasLegExercise: boolean } {
  let pullCount = 0;
  let pushCount = 0;
  let hasLegExercise = false;
  const total = exercises.length;
  if (total === 0) return { hasLegExercise: false };

  for (const ex of exercises) {
    const dashIdx = ex.lastIndexOf(" - ");
    const name = dashIdx >= 0 ? ex.slice(0, dashIdx).toLowerCase() : ex.toLowerCase();
    const catStr = dashIdx >= 0 ? ex.slice(dashIdx + 3).toLowerCase() : "";
    const cats = catStr.split(/\s*[+&,]\s*/).map((c) => c.trim());

    const isPull = cats.some((c) => c === "back" || c === "arms");
    const isPush = cats.some((c) => c === "chest" || c === "shoulders");
    const isLegs = cats.some((c) => c === "legs") || name.includes("leg") || name.includes("squat") || name.includes("lunge") || name.includes("rdl");

    if (isPull) pullCount++;
    if (isPush) pushCount++;
    if (isLegs) hasLegExercise = true;
  }

  let split: "push" | "pull" | undefined;
  if (pullCount > total / 2) split = "pull";
  else if (pushCount > total / 2) split = "push";

  return { split, hasLegExercise };
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
    apiFetch<RawStrengthSession[]>(`/api/strength/sessions?${dateRange}`).catch(() => [] as RawStrengthSession[]),
  ]);

  const allActivities = activityRes.data || [];
  const sleepRecords = sleepRes.data || [];
  const saunaRecords = saunaRes.data || [];
  const weightRecords = weightRes.data || [];
  const rhrRecords = rhrRes.data || [];

  // Map session_date → summed totals + all exercises (multiple sessions can share a date)
  const strengthSessionsByDate = new Map<string, { total_sets: number; exercises: string[] }>();
  for (const s of (strengthSessionsRes || [])) {
    const existing = strengthSessionsByDate.get(s.session_date);
    if (existing) {
      existing.total_sets += s.total_sets;
      existing.exercises.push(...(s.exercises ?? []));
    } else {
      strengthSessionsByDate.set(s.session_date, { total_sets: s.total_sets, exercises: s.exercises ?? [] });
    }
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
      recordId: s.id,
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
        bpm: a.avg_hr != null ? fmtInt(a.avg_hr, "bpm") : "—",
      },
      isLetsGo: a.effort === "lets_go",
      isInterval,
      recordId: a.id,
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
    const inferred = inferSplit(session?.exercises ?? []);
    // Fall back to auto-detected split if no explicit split is set
    if (!workoutSplit && inferred.split) workoutSplit = inferred.split;
    addEntry(a.activity_date, {
      category: "strength",
      duration: durStr,
      subMetrics: {
        sets: session ? `${session.total_sets}` : "—",
        bpm: a.avg_hr != null ? fmtInt(a.avg_hr, "bpm") : "—",
      },
      isLetsGo: a.effort === "lets_go",
      workoutSplit,
      hasLegExercise: inferred.hasLegExercise,
      recordId: a.id,
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
      recordId: r.id,
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
      recordId: s.id,
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
        hasLegExercise: e.hasLegExercise,
        recordId: e.recordId,
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

  // Previous month relative to init
  const prevInitYear = initMonth === 0 ? initYear - 1 : initYear;
  const prevInitMonth = initMonth === 0 ? 11 : initMonth - 1;

  const blocksRef = useRef<MonthBlock[]>([]);
  const earliestRef = useRef({ year: prevInitYear, month: prevInitMonth });
  // Captures scroll state just before a prepend so useLayoutEffect can restore it
  const scrollRestoreRef = useRef<{ prevScrollY: number; prevScrollHeight: number } | null>(null);

  const [blocks, setBlocks] = useState<MonthBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial load — always fetches current + previous month in parallel
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      try {
        const [prevData, currData] = await Promise.all([
          fetchMonthData(prevInitYear, prevInitMonth),
          fetchMonthData(initYear, initMonth),
        ]);
        if (cancelled) return;
        const initial = [
          { year: prevInitYear, month: prevInitMonth, data: prevData },
          { year: initYear, month: initMonth, data: currData },
        ];
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
