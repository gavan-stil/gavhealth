import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface SleepStage {
  startdate: number;  // unix timestamp
  enddate: number;    // unix timestamp
  state: 0 | 1 | 2 | 3;  // 0=awake, 1=light, 2=deep, 3=REM
}

export interface SleepStagesData {
  sleep_date: string;
  bed_time: string | null;
  wake_time: string | null;
  total_sleep_hrs: number | null;
  sleep_score: number | null;
  sleep_hr_avg: number | null;
  stages: SleepStage[] | null;
}

export default function useSleepStages() {
  const [data, setData] = useState<SleepStagesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);
    apiFetch<SleepStagesData | null>(`/api/sleep/stages?date=${today}`)
      .then((raw) => {
        setData(raw);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
