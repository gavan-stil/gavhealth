import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import type { ActivityFeedItem } from '../types/log';

export function useActivityFeed() {
  const [data, setData] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ActivityFeedItem[]>('/api/activities/feed?days=14');
      setData(res);
    } catch {
      setError('Could not load activity feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  return { data, setData, loading, error, refetch: fetchFeed };
}
