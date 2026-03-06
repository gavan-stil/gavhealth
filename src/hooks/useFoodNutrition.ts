import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { SavedMeal, FoodLogEntry, ParsedItem, MacroTotals } from '@/types/food';

// Shape returned by GET /api/food?date=today
type FoodApiEntry = {
  id: number;
  description_raw: string;
  log_date: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

// Shape returned by POST /api/log/food (AI parse) — flat FoodParseResponse
type AiParseResult = {
  description_raw: string;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  calories_kcal: number;
  confidence: string;
  items: Array<{
    name: string;
    calories_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }> | null;
};

export type ParseState = 'idle' | 'parsing' | 'done' | 'error';

function toLogEntry(e: FoodApiEntry): FoodLogEntry {
  return {
    id: e.id,
    name: e.description_raw,
    calories_kcal: e.calories_kcal,
    protein_g: e.protein_g,
    carbs_g: e.carbs_g,
    fat_g: e.fat_g,
    log_date: e.log_date,
  };
}

function calcTotals(entries: FoodLogEntry[]): MacroTotals {
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.calories_kcal,
      protein_g: acc.protein_g + e.protein_g,
      carbs_g: acc.carbs_g + e.carbs_g,
      fat_g: acc.fat_g + e.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

export function useFoodNutrition() {
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [todayLog, setTodayLog] = useState<FoodLogEntry[]>([]);
  const [parseInput, setParseInput] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [parseState, setParseState] = useState<ParseState>('idle');

  // ── Load saved meals + today's log on mount ──────────────────────────────
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];

    apiFetch<SavedMeal[]>('/api/saved-meals')
      .then(setSavedMeals)
      .catch(() => {});

    apiFetch<FoodApiEntry[]>(`/api/food?date=${today}`)
      .then(entries => setTodayLog(entries.map(toLogEntry)))
      .catch(() => {});
  }, []);

  const totals: MacroTotals = calcTotals(todayLog);

  // ── Saved meal library ───────────────────────────────────────────────────
  const saveMeal = useCallback(async (item: ParsedItem) => {
    // Deduplicate by name (case-insensitive)
    if (savedMeals.some(m => m.name.toLowerCase() === item.name.toLowerCase())) return;
    const created = await apiFetch<SavedMeal>('/api/saved-meals', {
      method: 'POST',
      body: JSON.stringify(item),
    });
    setSavedMeals(prev => [...prev, created]);
  }, [savedMeals]);

  const deleteSavedMeal = useCallback(async (id: number) => {
    setSavedMeals(prev => prev.filter(m => m.id !== id)); // optimistic
    await apiFetch(`/api/saved-meals/${id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  // ── Log a food item (saved meal tap OR parsed item "+ Add") ──────────────
  const logItem = useCallback(async (item: Omit<SavedMeal, 'id'> | ParsedItem) => {
    // Optimistic: add a temporary entry with id=-1 so UI updates instantly
    const tempId = -(Date.now());
    const tempEntry: FoodLogEntry = {
      id: tempId,
      name: item.name,
      calories_kcal: item.calories_kcal,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      log_date: new Date().toISOString().split('T')[0],
    };
    setTodayLog(prev => [...prev, tempEntry]);

    try {
      const saved = await apiFetch<{ id: number; description_raw: string; log_date: string; calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number }>(
        '/api/log/food/item',
        {
          method: 'POST',
          body: JSON.stringify({
            name: item.name,
            calories_kcal: item.calories_kcal,
            protein_g: item.protein_g,
            carbs_g: item.carbs_g,
            fat_g: item.fat_g,
          }),
        },
      );
      // Replace temp entry with real id
      setTodayLog(prev =>
        prev.map(e => e.id === tempId ? toLogEntry({ ...saved, description_raw: saved.description_raw ?? item.name }) : e)
      );
    } catch {
      // Roll back on failure
      setTodayLog(prev => prev.filter(e => e.id !== tempId));
    }
  }, []);

  const removeLogEntry = useCallback(async (id: number) => {
    setTodayLog(prev => prev.filter(e => e.id !== id)); // optimistic
    if (id > 0) {
      await apiFetch(`/api/log/food/item/${id}`, { method: 'DELETE' }).catch(() => {});
    }
  }, []);

  // ── Brain dump AI parse ──────────────────────────────────────────────────
  const triggerParse = useCallback(async () => {
    if (!parseInput.trim()) return;
    setParseState('parsing');
    setParsedItems([]);
    try {
      const res = await apiFetch<AiParseResult>('/api/log/food', {
        method: 'POST',
        body: JSON.stringify({ description: parseInput }),
      });
      // API returns a flat FoodParseResponse. Use items[] breakdown if present,
      // otherwise synthesise a single item from the top-level totals.
      const items = res.items && res.items.length > 0
        ? res.items.map(i => ({
            name: i.name,
            calories_kcal: i.calories_kcal,
            protein_g: i.protein_g,
            carbs_g: i.carbs_g,
            fat_g: i.fat_g,
          }))
        : [{
            name: res.description_raw,
            calories_kcal: res.calories_kcal,
            protein_g: res.protein_g,
            carbs_g: res.carbs_g,
            fat_g: res.fat_g,
          }];
      setParsedItems(items);
      setParseState('done');
    } catch {
      setParseState('error');
    }
  }, [parseInput]);

  const clearParse = useCallback(() => {
    setParseInput('');
    setParsedItems([]);
    setParseState('idle');
  }, []);

  return {
    savedMeals,
    saveMeal,
    deleteSavedMeal,
    todayLog,
    logItem,
    removeLogEntry,
    totals,
    parseInput,
    setParseInput,
    parsedItems,
    parseState,
    triggerParse,
    clearParse,
  };
}
