# Task 04 — Calendar Data Layer

Purpose: Fetch 90 days of data from multiple endpoints, build a dot-matrix map of category activity per day.

---

## Scope Gate

**DOES:**
- Create `useCalendarData` hook
- Fetch activities, sleep, sauna, weight, RHR for a 90-day window
- Map each day → array of colored category dots
- Export a `Record<string, CategoryDot[]>` keyed by `YYYY-MM-DD`
- Define `CategoryDot` type: `{ category: string, color: string }`

**DOES NOT:**
- Build any UI (that's Task 05)
- Handle month navigation (that's Task 05)
- Touch Dashboard, Log, or Trends routes

---

## Pre-flight Checks

- [ ] Task 03 completed: Dashboard loads live API data
- [ ] `apiFetch<T>()` exists in `src/lib/api.ts`
- [ ] `npm run dev` runs without errors

---

## Design Tokens (inline)

```css
:root {
  --bg-base: #0d0d0a; --bg-card: #14130f; --bg-card-hover: #1c1b15; --bg-elevated: #1e1d18;
  --border-default: #222018; --border-subtle: #1a1914;
  --text-primary: #f0ece4; --text-secondary: #b0a890; --text-tertiary: #9a9080; --text-muted: #7a7060;
  --ochre: #d4a04a; --ochre-light: #e8c47a; --ochre-dim: #a07830;
  --sand: #b8a878; --clay: #c4856a; --rust: #b47050; --gold: #e8c47a;
  --dawn: #7FAABC; --blush: #d4a890; --ember: #c45a4a;
  --signal-good: #e8c47a; --signal-caution: #d4a04a; --signal-poor: #c47a6a;
  --space-xs: 4px; --space-sm: 8px; --space-md: 14px; --space-lg: 20px; --space-xl: 32px; --space-2xl: 48px;
  --radius-sm: 8px; --radius-md: 14px; --radius-lg: 20px; --radius-pill: 100px;
}
```

### Category → Color Mapping

```
Weight:   #e8c47a  (gold)     var(--gold)
Sleep:    #7FAABC  (dawn)     var(--dawn)   — exclusively for sleep
Heart:    #c4856a  (clay)     var(--clay)
Running:  #b8a878  (sand)     var(--sand)
Strength: #b47050  (rust)     var(--rust)
Sauna:    #c45a4a  (ember)    var(--ember)
Body:     #d4a890  (blush)    var(--blush)
```

---

## API Endpoints (inline)

**Base URL:** `https://gavhealth-production.up.railway.app`
**Auth header:** `X-API-Key: gavhealth-prod-api-2026-xK9mP3`

### GET `/api/data/activities?days=90`
```typescript
// Response — array of activity objects
Array<{
  type: "run" | "strength",
  name: string,
  distance_km?: number,
  sets?: number,
  date: string   // YYYY-MM-DD
}>
```

### GET `/api/data/sleep?days=90`
```typescript
// Response — array of sleep records
Array<{
  date: string,
  duration_hrs: number,
  deep_pct: number
}>
```

### GET `/api/data/sauna?days=90`
```typescript
// Response — array of sauna sessions
Array<{
  date: string,
  duration_minutes: number,
  temperature_c: number
}>
```

### GET `/api/data/weight?days=90`
```typescript
// Response — array of weight entries
Array<{
  date: string,
  weight_kg: number
}>
```

### GET `/api/data/rhr?days=90`
```typescript
// Response — array of RHR readings
Array<{
  date: string,
  rhr_bpm: number
}>
```

---

## Component Specs

### `useCalendarData` Hook

```typescript
// src/hooks/useCalendarData.ts

type CategoryDot = {
  category: "weight" | "sleep" | "heart" | "running" | "strength" | "sauna";
  color: string;
};

type CalendarData = Record<string, CategoryDot[]>;  // key: YYYY-MM-DD

function useCalendarData(): {
  data: CalendarData;
  loading: boolean;
  error: string | null;
}
```

**Mapping logic:**
1. Fetch all 5 endpoints in parallel (`Promise.all`)
2. For each date that appears in any response, build a `CategoryDot[]`:
   - If date has a weight entry → `{ category: "weight", color: "#e8c47a" }`
   - If date has a sleep entry → `{ category: "sleep", color: "#7FAABC" }`
   - If date has an RHR entry → `{ category: "heart", color: "#c4856a" }`
   - If date has a run activity → `{ category: "running", color: "#b8a878" }`
   - If date has a strength activity → `{ category: "strength", color: "#b47050" }`
   - If date has a sauna entry → `{ category: "sauna", color: "#c45a4a" }`
3. Sort dots within each day in the order above (weight → sleep → heart → running → strength → sauna)
4. Return the full record

**Error handling:** If any single endpoint fails, still return data from the others. Set `error` to a descriptive message but don't block the whole calendar.

---

## File Structure

```
src/
├── hooks/
│   └── useCalendarData.ts    (new)
├── types/
│   └── calendar.ts           (new — CategoryDot, CalendarData types)
```

---

## Done-When

- [ ] `useCalendarData` hook fetches all 5 endpoints in parallel
- [ ] Returns `Record<string, CategoryDot[]>` with correct date keys
- [ ] Each category maps to its correct color
- [ ] Partial endpoint failures don't break the whole hook
- [ ] Types exported and reusable
- [ ] No TypeScript errors (`npm run build` succeeds)

---

## If Blocked

1. Try 3 different approaches
2. Document what was tried and what failed
3. Stop — do NOT keep looping
4. Report the blocker to Gav with specifics

---

## After Completion

1. Move this file from `tasks/active/` to `tasks/done/`
2. Update `README.md` route status table (Calendar → "Data layer complete")
3. Add entry to `CHANGELOG.md`
4. Start next task: `tasks/active/05-calendar-ui.md`
