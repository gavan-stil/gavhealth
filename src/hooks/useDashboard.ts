import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

/* ── Real API response types ─────────────────────────────── */

interface ApiReadiness {
  readiness_score: number;
  components: {
    base: number;
    sleep_delta: number;
    deep_delta: number;
    rhr_delta: number;
    load_penalty: number;
    rest_penalty: number;
  };
  recommendation: string;
}

interface ApiDailySummary {
  summary_date: string;
  total_sleep_hrs: number;
  deep_sleep_hrs: number;
  weight_kg: number;
  rhr_bpm: number;
  calories_kcal: number;
  protein_g: number;
  activity_count: number;
}

interface ApiStreaks {
  training_current: number;
  training_longest: number;
  sauna_current: number;
  sauna_longest: number;
  breathing_current: number;
  breathing_longest: number;
  devotions_current: number;
  devotions_longest: number;
}

/* ── Card-facing types ───────────────────────────────────── */

export interface ReadinessData {
  score: number;
  components: {
    sleep: number;
    rhr: number;
    load: number;
    rest: number;
  };
  narrative: string;
}

export interface VitalsData {
  weight_kg: number;
  total_sleep_hrs: number;
  deep_sleep_pct: number;
  rhr_bpm: number;
}

export interface StreaksData {
  training: number;
  sauna: number;
  breathing: number;
  devotions: number;
}

/* ── Transforms ──────────────────────────────────────────── */

function transformReadiness(raw: ApiReadiness): ReadinessData {
  return {
    score: raw.readiness_score,
    components: {
      sleep: (raw.components.sleep_delta ?? 0) + (raw.components.deep_delta ?? 0),
      rhr: raw.components.rhr_delta ?? 0,
      load: raw.components.load_penalty ?? 0,
      rest: raw.components.rest_penalty ?? 0,
    },
    narrative: raw.recommendation ?? '',
  };
}

function transformVitals(raw: ApiDailySummary): VitalsData {
  const total = raw.total_sleep_hrs ?? 0;
  const deep = raw.deep_sleep_hrs ?? 0;
  return {
    weight_kg: raw.weight_kg ?? 0,
    total_sleep_hrs: total,
    deep_sleep_pct: total > 0 ? Math.round((deep / total) * 100) : 0,
    rhr_bpm: raw.rhr_bpm ?? 0,
  };
}

function transformStreaks(raw: ApiStreaks): StreaksData {
  return {
    training: raw.training_current ?? 0,
    sauna: raw.sauna_current ?? 0,
    breathing: raw.breathing_current ?? 0,
    devotions: raw.devotions_current ?? 0,
  };
}

/* ── Generic per-card fetch hook ─────────────────────────── */

interface CardState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}

function useCardFetch<TRaw, TOut>(
  path: string,
  transform: (raw: TRaw) => TOut,
): CardState<TOut> {
  const [data, setData] = useState<TOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);
    apiFetch<TRaw>(path)
      .then((raw) => {
        setData(transform(raw));
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/* ── Dashboard hook ──────────────────────────────────────── */

export default function useDashboard() {
  const readiness = useCardFetch<ApiReadiness, ReadinessData>(
    "/api/readiness",
    transformReadiness,
  );
  const vitals = useCardFetch<ApiDailySummary, VitalsData>(
    "/api/summary/daily",
    transformVitals,
  );
  const streaks = useCardFetch<ApiStreaks, StreaksData>(
    "/api/streaks",
    transformStreaks,
  );

  const refetch = () => {
    readiness.refetch();
    vitals.refetch();
    streaks.refetch();
  };

  return { readiness, vitals, streaks, refetch };
}
