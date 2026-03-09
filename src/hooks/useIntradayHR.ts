import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

export interface HrIntradayBucket {
  hour: number;
  hr_avg: number | null;
  hr_min: number | null;
  hr_max: number | null;
  readings_count: number | null;
}

export interface IntradayHRData {
  log_date: string;
  buckets: HrIntradayBucket[];
}

export default function useIntradayHR(dateStr?: string) {
  const [data, setData] = useState<IntradayHRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetDate =
    dateStr ??
    (() => {
      // Brisbane UTC+10
      const now = new Date();
      now.setTime(now.getTime() + 10 * 3600 * 1000);
      return now.toISOString().split("T")[0];
    })();

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<IntradayHRData>(
        `/api/hr/intraday?date=${targetDate}`
      );
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load intraday HR");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  return { data, loading, error, refetch: fetch };
}
