import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';

type FoodApiEntry = {
  id: number;
  description_raw: string;
  log_date: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type QuickAddItem = {
  id: string;
  name: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  count?: number; // only on frequent items
};

function offsetDate(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}

export function useQuickAdd(date: string) {
  const [loading, setLoading] = useState(false);
  const [yesterdayItems, setYesterdayItems] = useState<QuickAddItem[]>([]);
  const [frequentItems, setFrequentItems] = useState<QuickAddItem[]>([]);

  const yesterday = useMemo(() => offsetDate(date, -1), [date]);

  useEffect(() => {
    setYesterdayItems([]);
    setFrequentItems([]);
    setLoading(true);

    const startDate = offsetDate(date, -8); // 8 days back covers 7-day frequent window + yesterday

    apiFetch<{ data: FoodApiEntry[] }>(
      `/api/food?start_date=${startDate}&end_date=${yesterday}`
    )
      .then(res => {
        const entries = res.data ?? [];

        // ── Yesterday items (in log order) ────────────────────────────────
        const yItems: QuickAddItem[] = entries
          .filter(e => e.log_date === yesterday)
          .map(e => ({
            id: `y-${e.id}`,
            name: e.description_raw,
            calories_kcal: e.calories_kcal,
            protein_g: e.protein_g,
            carbs_g: e.carbs_g,
            fat_g: e.fat_g,
          }));
        setYesterdayItems(yItems);

        // ── Frequent items: group by name (case-insensitive), count ≥ 3 ──
        const groups = new Map<string, FoodApiEntry[]>();
        entries.forEach(e => {
          const key = e.description_raw.toLowerCase().trim();
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(e);
        });

        const fItems: QuickAddItem[] = [];
        groups.forEach((grpEntries, key) => {
          if (grpEntries.length < 3) return;
          const count = grpEntries.length;
          // Average macros across all occurrences
          const avg = (field: keyof Pick<FoodApiEntry, 'calories_kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>) =>
            Math.round(grpEntries.reduce((s, e) => s + e[field], 0) / count);
          // Display name = most recent entry
          const mostRecent = [...grpEntries].sort((a, b) => b.log_date.localeCompare(a.log_date))[0];
          fItems.push({
            id: `f-${key}`,
            name: mostRecent.description_raw,
            calories_kcal: avg('calories_kcal'),
            protein_g: avg('protein_g'),
            carbs_g: avg('carbs_g'),
            fat_g: avg('fat_g'),
            count,
          });
        });
        fItems.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
        setFrequentItems(fItems);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date, yesterday]);

  return { yesterdayItems, frequentItems, loading, yesterday };
}
