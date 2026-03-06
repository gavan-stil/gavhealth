# Task 11 — Food & Nutrition Card (Saved Meals + Running Log)

**Status:** Speccing
**Replaces:** `FoodCard.tsx` (current brain-dump-only card)
**Scope gate:** This task touches food logging only. Water / Mood / Dashboard remain in Task 10.

---

## Problem

The current `FoodCard.tsx` is a 2-step NLP flow — brain dump → AI parse → confirm whole meal.
It has no saved meals, no per-item control, and no running today's total.

Every logged food item currently hits the Claude API even if it's the same breakfast you eat daily.

---

## What We're Building

```
┌─────────────────────────────────┐
│  Food & Nutrition               │
│  ─────────────────────────────  │
│  SAVED MEALS (horizontal chips) │  ← tap = direct add, no AI
│  [Eggs on toast 320] [Shake 280]│
│                                 │
│  NEW FOOD                       │  ← textarea brain dump
│  [textarea]                     │
│  [Process with AI]  [Clear]     │
│                                 │
│  PARSED — ADD & SAVE            │  ← per-item actions
│  Banana     89 kcal  [+Add][★]  │
│  Flat white 120 kcal [+Add][★]  │
│                                 │
│  TODAY'S LOG (3 items)          │  ← running list, live
│  Eggs on toast    320 kcal  ✕   │
│  Post-gym shake   280 kcal  ✕   │
│  Flat white       120 kcal  ✕   │
│                                 │
│  720  of 2,358 kcal             │
│  ████░░░░░░░░░░░░░░░░░  30%     │
│  Protein 56g / Carbs 84g / F19g │
└─────────────────────────────────┘
```

---

## Database

### New table: `saved_meals`

```sql
CREATE TABLE saved_meals (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  calories_kcal INT NOT NULL,
  protein_g   NUMERIC(6,1) NOT NULL,
  carbs_g     NUMERIC(6,1) NOT NULL,
  fat_g       NUMERIC(6,1) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

No user_id — single-user app (API-key auth).

### Existing table: `food_logs`

Already exists. The new `POST /api/log/food/item` endpoint writes directly to it,
bypassing the 2-step NLP flow when macros are already known.

Current confirmed shape (from `POST /api/log/food/confirm`):
- `description_raw`, `meal_label`, `log_date`, `protein_g`, `carbs_g`, `fat_g`, `calories_kcal`, `confidence`, `items[]`

---

## Backend Endpoints

### New: Saved Meals CRUD

```
GET  /api/saved-meals
  → [{ id, name, calories_kcal, protein_g, carbs_g, fat_g }]

POST /api/saved-meals
  body: { name, calories_kcal, protein_g, carbs_g, fat_g }
  → { id, name, calories_kcal, protein_g, carbs_g, fat_g }

DELETE /api/saved-meals/:id
  → { ok: true }
```

### New: Direct item logging (bypasses AI for known macros)

```
POST /api/log/food/item
  body: {
    name:          string,
    calories_kcal: number,
    protein_g:     number,
    carbs_g:       number,
    fat_g:         number,
    logged_at?:    ISO string   // defaults to NOW()
  }
  → { id, name, calories_kcal, protein_g, carbs_g, fat_g, logged_at }
```

Writes one row to `food_logs`. This is the endpoint used when:
- Tapping a saved meal chip
- Clicking "+ Add" on a parsed item

### Keep unchanged

```
POST /api/log/food          — brain dump parse (returns parsed items, no DB write)
POST /api/log/food/confirm  — confirm whole parsed meal (existing behaviour, keep for fallback)
GET  /api/food?date=YYYY-MM-DD  — today's food log entries
```

---

## Frontend

### Component: `src/components/log/FoodNutritionCard.tsx`
**Replaces** `FoodCard.tsx` entirely. `LogCards.tsx` will import `FoodNutritionCard` instead.

### Hook: `src/hooks/useFoodNutrition.ts`

```ts
type SavedMeal = { id: number; name: string; calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number };
type FoodLogEntry = { id: number; name: string; calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number; logged_at: string };
type ParsedItem  = { name: string; calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number };

// Returns:
{
  // Saved meals library
  savedMeals:     SavedMeal[];
  saveMeal:       (item: ParsedItem) => Promise<void>;
  deleteSavedMeal:(id: number) => Promise<void>;

  // Today's log
  todayLog:       FoodLogEntry[];
  logItem:        (item: ParsedItem | SavedMeal) => Promise<void>;  // POST /api/log/food/item
  removeLogEntry: (id: number) => Promise<void>;  // DELETE if endpoint exists, else optimistic UI only

  // Totals (derived from todayLog)
  totals:         { kcal: number; protein_g: number; carbs_g: number; fat_g: number };

  // Brain dump / AI parse state
  parseInput:     string;
  setParseInput:  (s: string) => void;
  parsedItems:    ParsedItem[];
  parseState:     'idle' | 'parsing' | 'done' | 'error';
  triggerParse:   () => Promise<void>;
  clearParse:     () => void;
}
```

### State machine: `FoodNutritionCard`

```
idle
  → user taps saved meal chip         → logItem() → today's log updates live
  → user types in textarea + Process  → parseState = 'parsing'
    → parse done                      → parseState = 'done', parsedItems populated
      → user clicks "+ Add" on item   → logItem() → today's log updates live
      → user clicks "★ Save" on item  → saveMeal() → chip appears in saved meals row
  → user clicks ✕ on log entry       → removeLogEntry() (optimistic, API if exists)
```

---

## TypeScript Types (in `src/types/food.ts`)

```ts
export type SavedMeal = {
  id: number;
  name: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type FoodLogEntry = SavedMeal & {
  logged_at: string;
};

export type ParsedItem = Omit<SavedMeal, 'id'>;
```

---

## Targets (hardcoded for now)

```ts
const TARGETS = { kcal: 2358, protein_g: 180, carbs_g: 260, fat_g: 80 };
```

---

## Done-when

- [ ] `saved_meals` table created in Railway (migration SQL in `new_endpoints.py`)
- [ ] `GET/POST /api/saved-meals` verified with curl
- [ ] `DELETE /api/saved-meals/:id` verified with curl
- [ ] `POST /api/log/food/item` verified with curl
- [ ] `GET /api/food?date=today` still works (unchanged)
- [ ] `FoodNutritionCard.tsx` renders saved meal chips from API
- [ ] Tapping a chip adds to today's log, no AI call made
- [ ] Brain dump → parse → per-item "+ Add" and "★ Save" work
- [ ] "★ Save" deduplicates (won't save same name twice)
- [ ] Today's log list renders all entries for today
- [ ] ✕ on a log entry removes it (optimistic)
- [ ] Totals and macro bars update live
- [ ] `LogCards.tsx` imports `FoodNutritionCard` instead of `FoodCard`
- [ ] `npm run build` passes — 0 TypeScript errors

---

## Build Order

1. **Backend first** — add table + 3 new endpoints to `new_endpoints.py`, curl-verify each
2. **Types** — create `src/types/food.ts`
3. **Hook** — `src/hooks/useFoodNutrition.ts` (mock API initially, swap to real)
4. **Component** — `FoodNutritionCard.tsx` wired to hook
5. **Wire** — update `LogCards.tsx` import
6. **Build** — `npm run build`
