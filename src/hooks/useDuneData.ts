import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

type SignalsResponse = {
  days: Array<Record<string, number | string | null>>;
  targets: Record<string, { min: number; max: number }>;
};

type GoalItem = {
  signal: string;
  target_min: number;
  target_max: number;
};

export type DuneSignalData = {
  key: string;
  label: string;
  unit: string;
  value: number | null;
  targetMin: number;
  targetMax: number;
  gap: number;     // today - targetMid
  gapPct: number;  // gap / targetMid — drives yFactor
};

export type DuneData = {
  signals: DuneSignalData[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const SIGNAL_KEYS = ['protein_g', 'sleep_hrs', 'water_ml', 'calories_in'] as const;

const SIGNAL_META: Record<string, { label: string; unit: string }> = {
  protein_g:   { label: 'Protein',  unit: 'g'   },
  sleep_hrs:   { label: 'Sleep',    unit: 'hr'  },
  water_ml:    { label: 'Water',    unit: 'L'   },
  calories_in: { label: 'Calories', unit: 'cal' },
};

export function useDuneData(): DuneData {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [signals, setSignals] = useState<DuneSignalData[]>([]);
  const [tick, setTick]       = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch<SignalsResponse>('/api/momentum/signals?days=7'),
      apiFetch<GoalItem[]>('/api/goals'),
    ])
      .then(([signalsRes, goalsRes]) => {
        if (cancelled) return;

        const today    = signalsRes.days[signalsRes.days.length - 1] ?? {};
        const goalMap  = Object.fromEntries(goalsRes.map(g => [g.signal, g]));

        const result: DuneSignalData[] = SIGNAL_KEYS.map(key => {
          const meta      = SIGNAL_META[key];
          const goal      = goalMap[key];
          const raw       = today[key];
          const value     = typeof raw === 'number' ? raw : null;
          const targetMin = goal?.target_min ?? 0;
          const targetMax = goal?.target_max ?? 0;
          const targetMid = (targetMin + targetMax) / 2;
          const gap       = value != null ? value - targetMid : 0;
          const gapPct    = targetMid !== 0 && value != null ? gap / targetMid : 0;

          return { key, ...meta, value, targetMin, targetMax, gap, gapPct };
        });

        setSignals(result);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message ?? 'Failed to load goals');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  return { signals, loading, error, refetch };
}
