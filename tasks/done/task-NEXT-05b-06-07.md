# Task: Calendar Amendments + Log UI + Log API

**This is a single consolidated task covering what was previously 05b, 06-revised, and 07-revised.**
**Execute in three phases, in order. Complete each phase before starting the next.**

---

## SESSION RULES — READ FIRST

- Only touch files listed under each phase's "Files" section
- Run `npm run build` after every file. Fix TS errors before moving on
- If an API endpoint behaves differently from what's documented here: note the difference, build a transform, move on — do NOT stop
- 3 attempts max on any single problem, then stop and report
- Do NOT start Phase 2 until Phase 1 build is clean. Same for Phase 3.
- When all 3 phases done: stop, report, wait

---

## Design Tokens (all phases)

```css
:root {
  --bg-base: #0d0d0a; --bg-card: #14130f; --bg-card-hover: #1c1b15; --bg-elevated: #1e1d18;
  --border-default: #222018; --border-subtle: #1a1914;
  --text-primary: #f0ece4; --text-secondary: #b0a890; --text-tertiary: #9a9080; --text-muted: #7a7060;
  --ochre: #d4a04a; --ochre-light: #e8c47a; --ochre-dim: #a07830;
  --sand: #b8a878; --clay: #c4856a; --rust: #b47050; --gold: #e8c47a;
  --dawn: #7FAABC; --blush: #d4a890; --ember: #c45a4a; --rose: #c4789a;
  --signal-good: #e8c47a; --signal-caution: #d4a04a; --signal-poor: #c47a6a;
  --space-xs: 4px; --space-sm: 8px; --space-md: 14px; --space-lg: 20px; --space-xl: 32px;
  --radius-sm: 8px; --radius-md: 14px; --radius-lg: 20px; --radius-pill: 100px;
  --ease-settle: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 120ms; --duration-normal: 200ms; --duration-slow: 400ms;
}
```

```
.section-head { font: 700 16px/1.2 'Inter', sans-serif; letter-spacing: -0.5px; }
.body-text    { font: 400 14px/1.5 'Inter', sans-serif; }
.small-number { font: 600 14px/1 'JetBrains Mono', monospace; letter-spacing: -0.5px; }
.label-text   { font: 600 10px/1 'Inter', sans-serif; letter-spacing: 1.2px; text-transform: uppercase; }
.stat-number  { font: 800 28px/1 'JetBrains Mono', monospace; letter-spacing: -1.5px; }
```

---

## Pre-flight (run before touching any code)

```bash
npm run dev          # must start clean
npm run build        # must succeed
curl -s -H "X-API-Key: gavhealth-prod-api-2026-xK9mP3" \
  https://gavhealth-production.up.railway.app/api/health
# expect: {"status":"ok"}
```

---

---

# PHASE 1 — Calendar Amendments (05b)

**Purpose:** Add Ride category, effort markers, and devotions marker to the existing Calendar route.

## Files to touch

```
src/types/calendar.ts               modify
src/hooks/useCalendarData.ts        modify
src/components/calendar/ToggleBar.tsx       modify
src/components/calendar/MonthGrid.tsx       modify
src/components/calendar/DayDetailSheet.tsx  modify
```

## 1. `src/types/calendar.ts`

Update the following exports. Do not remove anything that isn't listed here.

```typescript
export type CategoryName =
  "weight" | "sleep" | "heart" | "running" | "strength" | "ride" | "sauna";

export type CategoryDot = {
  category: CategoryName;
  color: string;
  duration?: string;
  subMetrics?: Record<string, string>;
  isLetsGo?: boolean;       // effort === 'lets_go' → show ▲
  isInterval?: boolean;     // run name contains interval/tempo/sprint/repeat/fartlek → show ▲
  saunaHasDevotion?: boolean; // did_devotions === true → show ▲
};

export const CATEGORY_COLORS: Record<CategoryName, string> = {
  weight:   "#e8c47a",
  sleep:    "#7FAABC",
  heart:    "#c4856a",
  running:  "#b8a878",
  strength: "#b47050",
  ride:     "#c4789a",
  sauna:    "#c45a4a",
};

export const CATEGORY_ORDER: CategoryName[] = [
  "weight", "sleep", "heart", "running", "strength", "ride", "sauna"
];

export const CATEGORY_LABELS: Record<CategoryName, string> = {
  weight: "Weight", sleep: "Sleep", heart: "Heart",
  running: "Running", strength: "Strength", ride: "Ride", sauna: "Sauna",
};

export const SUB_TOGGLE_DEFS: Record<CategoryName, { id: string; label: string }[]> = {
  running:  [{ id: "dist", label: "Dist" }, { id: "time", label: "Time" }, { id: "pace", label: "Pace" }],
  strength: [{ id: "sets", label: "Sets" }],
  ride:     [{ id: "dist", label: "Dist" }, { id: "speed", label: "Speed" }],
  sleep:    [{ id: "deep", label: "Deep%" }],
  heart:    [{ id: "rhr", label: "RHR" }],
  weight:   [{ id: "kg", label: "kg" }, { id: "delta", label: "Δ" }],
  sauna:    [{ id: "mins", label: "Mins" }, { id: "temp", label: "Temp" }],
};
```

## 2. `src/hooks/useCalendarData.ts`

Add a 6th parallel fetch for rides. Update existing activity mapping to include effort/marker fields.

**Add to the Promise.all fetch block:**
```typescript
const rideRes = await apiFetch<Array<{
  date: string;
  name?: string;
  duration_minutes?: number;
  avg_bpm?: number;
  distance_km?: number;
  avg_speed_kmh?: number;
  effort?: string;
}>>('/api/data/activities?days=90&type=ride');
```

**Map rides to CategoryDot:**
```typescript
// for each ride on a given date:
dots.push({
  category: "ride",
  color: CATEGORY_COLORS.ride,
  duration: act.duration_minutes ? `${Math.round(act.duration_minutes)}m` : undefined,
  subMetrics: {
    ...(act.distance_km != null ? { dist: `${act.distance_km.toFixed(1)}km` } : {}),
    ...(act.avg_speed_kmh != null ? { speed: `${act.avg_speed_kmh.toFixed(1)}km/h` } : {}),
  },
  isLetsGo: act.effort === 'lets_go',
});
```

**Update running dot mapping — add isLetsGo and isInterval:**
```typescript
const intervalKeywords = ['interval', 'tempo', 'sprint', 'repeat', 'fartlek'];
const isInterval = intervalKeywords.some(kw => (act.name ?? '').toLowerCase().includes(kw));
// add to existing running dot:
isLetsGo: act.effort === 'lets_go',
isInterval,
```

**Update strength dot mapping — add isLetsGo:**
```typescript
isLetsGo: act.effort === 'lets_go',
```

**Update sauna dot mapping — add saunaHasDevotion:**
```typescript
// sauna API returns field: did_devotions (boolean)
saunaHasDevotion: act.did_devotions === true,
```
Note: meditation is NOT supported by the backend. Do not add saunaHasMeditation.

## 3. `src/components/calendar/ToggleBar.tsx`

Add Ride pill between Strength and Sauna. Order must be:
Weight → Sleep → Heart → Running → Strength → Ride → Sauna

Ride active colour: `#c4789a`

## 4. `src/components/calendar/MonthGrid.tsx`

Update dot rendering to show markers beneath each dot:

```tsx
{/* existing dot circle renders here */}
{(dot.isLetsGo || dot.isInterval) && (
  <span style={{ fontSize: 6, color: dot.color, lineHeight: 1, display: 'block' }}>▲</span>
)}
{dot.saunaHasDevotion && (
  <span style={{ fontSize: 6, color: dot.color, lineHeight: 1, display: 'block' }}>▲</span>
)}
```

Keep markers compact — beneath the dot, not beside it.

## 5. `src/components/calendar/DayDetailSheet.tsx`

Add effort badge to each activity row:

```tsx
// Only show on dots that have isLetsGo defined (i.e. activities, not weight/sleep/heart)
{dot.isLetsGo !== undefined && (
  <span style={{
    fontSize: 9,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    padding: '2px 6px',
    borderRadius: 'var(--radius-pill)',
    background: dot.isLetsGo ? 'var(--ochre)' : 'transparent',
    border: `1px solid ${dot.isLetsGo ? 'var(--ochre)' : 'var(--border-default)'}`,
    color: dot.isLetsGo ? 'var(--bg-base)' : 'var(--text-muted)',
    marginLeft: 'auto',
  }}>
    {dot.isLetsGo ? "Let's Go" : 'Mid'}
  </span>
)}
```

Add devotions label for sauna entries:
```tsx
{dot.category === 'sauna' && dot.saunaHasDevotion && (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16 }}>
    <span style={{ fontSize: 9, color: 'var(--ember)' }}>▲</span>
    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Devotions</span>
  </div>
)}
```

## Phase 1 Done-When
- [ ] `npm run build` clean
- [ ] Ride pill visible in calendar toggle bar
- [ ] Ride dots appear on days with ride data
- [ ] ▲ marker shows on Let's Go activities
- [ ] ▲ marker shows on interval/tempo runs
- [ ] ▲ marker shows on sauna days with devotions
- [ ] DayDetailSheet shows effort badge on activity entries
- [ ] DayDetailSheet shows Devotions label on sauna entries

---

---

# PHASE 2 — Log UI (06-revised, UI only, no API calls)

**Purpose:** Build the Log route with 2 sub-tabs: Log (4 cards) and Activity Feed (mock data).

## Files to create/replace

```
src/mocks/log.ts                          create
src/pages/LogPage.tsx                     replace placeholder
src/components/log/LogCards.tsx           create
src/components/log/FoodCard.tsx           create
src/components/log/StrengthCard.tsx       create
src/components/log/SaunaCard.tsx          create
src/components/log/HabitsCard.tsx         create
src/components/log/ActivityFeed.tsx       create
```

## Mock data — `src/mocks/log.ts`

```typescript
export const MOCK_PARSED_FOOD = {
  items: [
    { name: "Chicken breast", calories: 280, protein_g: 52 },
    { name: "Brown rice", calories: 220, protein_g: 5 },
    { name: "Broccoli", calories: 40, protein_g: 3 },
  ],
  total_calories: 540,
};

export const MOCK_LAST_PUSH_SESSION = {
  date: "2026-03-01",
  exercises: [
    {
      name: "Bench Press",
      superset: false,
      sets: [
        { load_type: "kg", kg: 80, reps: 8 },
        { load_type: "kg", kg: 85, reps: 6 },
        { load_type: "kg", kg: 85, reps: 5 },
      ],
    },
    {
      name: "Incline DB Press",
      superset: false,
      sets: [
        { load_type: "kg", kg: 30, reps: 10 },
        { load_type: "kg", kg: 32, reps: 8 },
      ],
    },
  ],
};

export const MOCK_ACTIVITY_FEED = [
  {
    id: 1, type: "run", date: "2026-03-04",
    duration_minutes: 42, avg_bpm: 158,
    effort: "mid", effort_manually_set: false,
  },
  {
    id: 2, type: "strength", date: "2026-03-03",
    duration_minutes: 58, avg_bpm: 134,
    effort: "lets_go", effort_manually_set: true,
  },
  {
    id: 3, type: "sauna", date: "2026-03-03",
    duration_minutes: 25, avg_bpm: 112,
    effort: "mid", effort_manually_set: false,
  },
  {
    id: 4, type: "ride", date: "2026-03-02",
    duration_minutes: 65, avg_bpm: 145,
    effort: "basic", effort_manually_set: true,
  },
];
```

## `src/pages/LogPage.tsx`

Two sub-tabs. One card open at a time (accordion).

```tsx
const [activeTab, setActiveTab] = useState<'log' | 'activity'>('log');

// Sub-tab bar styling:
// container: border-bottom 1px solid var(--border-default), padding: var(--space-md) var(--space-lg) 0
// active tab: bg var(--bg-elevated), color var(--text-primary), no bottom border
// inactive: bg transparent, color var(--text-muted)
// tabs: "Log" and "Activity"
```

## Card state machine (Food + Strength Brain Dump)

```
empty → parsing (1500ms setTimeout) → parsed → confirmed → (2s) → empty
                                          ↓
                                        error
```

Sauna and Habits: empty → confirmed → (2s) → empty (no parse step)

## `src/components/log/FoodCard.tsx`

- Icon: `UtensilsCrossed` (lucide), color `var(--gold)`
- Title: "Food"
- Empty: textarea, placeholder "e.g. chicken breast 200g, rice 150g", "Parse" button
- Parsing: input disabled, button shows "Parsing…" with pulse animation
- Parsed: item list (name / cal / protein per row), total in stat-number ochre, Confirm + Edit buttons
- Confirmed: green Check icon + "Logged!", resets after 2s
- Parse button style: `bg: var(--ochre)`, `color: var(--bg-base)`, `radius: var(--radius-md)`
- Confirm button: same style. Edit button: ghost, border var(--border-default)

## `src/components/log/StrengthCard.tsx`

Two modes toggled by a small pill: **Builder** | **Brain Dump**

**Builder mode:**

Split selector — 4 pills: Push / Pull / Legs / Abs
- Active: `bg: var(--rust)`, `color: var(--bg-base)`
- Inactive: border var(--border-default), color var(--text-muted)

"Load last [Split] session" ghost button (shows mock date "1 Mar") — loads MOCK_LAST_PUSH_SESSION

Exercise cards:
```
[Exercise name input]                    [SS toggle] [✕ remove]
────────────────────────────────────────────────────────────
1  [kg▼]  [−] 80 [+]  ×  [−] 8 [+]  [✕]
2  [kg▼]  [−] 85 [+]  ×  [−] 6 [+]  [✕]
+ Add Set
```

- Exercise name: text input, font-weight 600, var(--text-primary)
- SS toggle: "SS" badge, when active gold bg + left border var(--ember) on card
- Load type: pill selector kg / BW / BW+
  - BW: hides kg stepper, shows "bodyweight"
  - BW+: shows kg stepper labelled "extra kg"
- Kg stepper: increments 2.5kg, min 0
- Reps stepper: increments 1, min 1
- Remove set: disabled (opacity 0.3) if only 1 set
- Add Set: copies previous set values

Below exercises:
- "+ Add Exercise" button (ghost)
- Start time: HTML time input (defaults to now)
- Duration stepper: 5 min increments, min 5
- "Save Session" button: `bg: var(--rust)`

**Brain Dump mode:**
- Textarea: "e.g. bench press 80kg x8 x3, squat 100kg x5 x4"
- Parse → 1500ms → shows MOCK_LAST_PUSH_SESSION exercises as parsed state
- Confirm + Edit buttons, same flow as Food card

TypeScript types (define locally in this file):
```typescript
type LoadType = 'kg' | 'bw' | 'bw+';
type WorkoutSet = { load_type: LoadType; kg: number; reps: number; };
type WorkoutExercise = { name: string; superset: boolean; sets: WorkoutSet[]; };
```

## `src/components/log/SaunaCard.tsx`

- Icon: `Thermometer` (lucide), color `var(--ember)`
- Title: "Sauna"
- Duration input (minutes): number input, placeholder "20"
- Temperature input (°C): number input, placeholder "80"
- Devotions toggle row:
  ```tsx
  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
    <span style={{ fontSize: 10, color: 'var(--ember)' }}>▲</span>
    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'Inter' }}>Devotions</span>
    <input type="checkbox" checked={hasDevotion} onChange={e => setHasDevotion(e.target.checked)} />
  </div>
  ```
- Custom checkbox: 20px square, border var(--border-default), checked: bg var(--ember)
- Input styling: `bg: var(--bg-elevated)`, `border: 1px solid var(--border-default)`,
  `radius: var(--radius-sm)`, `padding: var(--space-sm) var(--space-md)`,
  `color: var(--text-primary)`, `font: small-number`
- "Log Sauna" button → confirmed directly, resets after 2s
- NO meditation field (not supported by backend)

## `src/components/log/HabitsCard.tsx`

- Icon: `CheckSquare` (lucide), color `var(--ochre)`
- Title: "Habits"
- 2×2 grid: Stretching, Meditation, Cold Shower, Supplements
- Custom checkbox: 24px square, checked: bg var(--ochre), white checkmark
- Label: body-text, var(--text-secondary)
- "Log Habits" → confirmed directly, resets after 2s

## `src/components/log/ActivityFeed.tsx`

Uses MOCK_ACTIVITY_FEED. Local state for effort (so tapping works in UI).

**Feed item:**
```
[type dot 10px]  [type label]              [effort badge]
                 [date · duration · bpm]
```

- Type dot colors: run=#b8a878, strength=#b47050, ride=#c4789a, sauna=#c45a4a
- Type label: section-head, var(--text-primary)
- Date line: label-text, var(--text-muted) — format "Tue 4 Mar · 42m · 158bpm"
- Effort badge:
  - "Let's Go": bg var(--ochre), color var(--bg-base), filled pill
  - "Mid" or "Basic": border var(--border-default), color var(--text-muted), transparent bg
  - If `effort_manually_set === false`: show small ochre dot in top-right of badge (unreviewed)

**Tapping an item** expands inline effort selector:
```tsx
<div style={{ display: 'flex', gap: 'var(--space-sm)', paddingTop: 'var(--space-sm)',
  borderTop: '1px solid var(--border-default)' }}>
  {(['basic', 'mid', 'lets_go'] as const).map(level => (
    <button key={level} onClick={() => setEffort(item.id, level)} style={{
      flex: 1, padding: '6px 0', borderRadius: 'var(--radius-pill)',
      border: `1px solid ${item.effort === level ? 'var(--ochre)' : 'var(--border-default)'}`,
      background: item.effort === level ? 'var(--ochre)' : 'transparent',
      color: item.effort === level ? 'var(--bg-base)' : 'var(--text-muted)',
      font: '600 11px/1 Inter, sans-serif', cursor: 'pointer',
    }}>
      {level === 'basic' ? 'Basic' : level === 'mid' ? 'Mid' : "Let's Go"}
    </button>
  ))}
</div>
```

In Phase 2: effort changes update local state only. Phase 3 wires to API.

## Phase 2 Done-When
- [ ] `npm run build` clean
- [ ] Log page shows 2 sub-tabs: Log and Activity
- [ ] Food card: parse animation → mock items → confirm → "Logged!" → resets
- [ ] Strength Builder: split selector, load last session, exercise cards with steppers
- [ ] Strength Brain Dump: parse animation → mock exercises → confirm
- [ ] Sauna card: duration + temp + devotions toggle → "Logged!"
- [ ] Habits card: 2×2 checkboxes → "Logged!"
- [ ] Activity Feed: shows 4 mock items with effort badges
- [ ] Tapping item opens inline effort selector, selection updates badge

---

---

# PHASE 3 — Log API Wiring (07-revised)

**Purpose:** Replace all mock data with live API calls.

## VERIFIED API SHAPES — use these, ignore task-07-revised.md where they conflict

**Base URL:** `https://gavhealth-production.up.railway.app`
**Auth header:** `X-API-Key: gavhealth-prod-api-2026-xK9mP3`

### POST /api/log/food
```
Body:     { text: string }
Response: { items: [{ name, calories, protein_g }], total_calories: number }
```

### POST /api/log/food/confirm
```
Body:     { items: [...], date: string }   // date = YYYY-MM-DD
Response: { success: boolean }
```

### POST /api/log/strength/save
```
Body: {
  workout_split: "push" | "pull" | "legs" | "abs",
  exercises: [{ name, superset, sets: [{ load_type, kg, reps }] }],
  start_time: string,      // ISO e.g. "2026-03-05T09:00:00"
  duration_minutes: number,
  notes: string | null
}
Response: { id: number, matched_activity_id: number | null, match_confirmed: boolean }
```

### GET /api/log/strength/last/:split
```
Response: { date: string, exercises: [...] } | null
```

### POST /api/log/strength (Brain Dump NLP parse)
```
Body:     { text: string }
Response: { exercise: string, sets: [{ weight_kg, reps }] }
// NOTE: response shape differs from Builder. Map to WorkoutExercise[] accordingly.
// If /api/log/strength/parse exists, try that first.
```

### POST /api/log/sauna
```
Body: {
  session_datetime: string,  // ISO timestamp — NOT "date"
  duration_mins: number,     // NOT duration_minutes
  temperature_c: number,
  did_devotions: boolean     // NOT devotions
}
Response: { id: number, ... }
```

### POST /api/log/habits
```
Body: {
  date: string,
  habits: { stretching: boolean, meditation: boolean, cold_shower: boolean, supplements: boolean }
}
Response: { success: boolean }
```

### GET /api/activities/feed
```
Response: [{
  id, type, date, duration_minutes, avg_bpm,
  effort: "basic" | "mid" | "lets_go",
  effort_manually_set: boolean   // true = user set it, false = system default (unreviewed)
  // NOTE: no name, distance, pace, sets, or split fields — feed is thin
}]
```

### PATCH /api/activities/:id/effort
```
Body:     { effort: "basic" | "mid" | "lets_go" }
Response: { id, effort, effort_manually_set }
```

### GET /api/activities/linkable
```
Response: [{ id, type, date, duration_minutes }]
```

### PATCH /api/log/strength/:id/relink
```
Body:     { activity_id: number }
Response: { id, matched_activity_id, match_confirmed: true }
```

## Date helpers

```typescript
const today = (): string => new Date().toISOString().split('T')[0]; // YYYY-MM-DD

const buildStartTime = (timeInput: string): string => {
  return `${today()}T${timeInput}:00`;
};
```

## Files to modify

```
src/components/log/FoodCard.tsx        modify — replace mock with API
src/components/log/StrengthCard.tsx    modify — replace mock with API
src/components/log/SaunaCard.tsx       modify — add API call
src/components/log/HabitsCard.tsx      modify — add API call
src/components/log/ActivityFeed.tsx    modify — replace mock with live feed + effort PATCH
src/hooks/useActivityFeed.ts           create
src/types/log.ts                       create
```

## `src/types/log.ts`

```typescript
export type EffortLevel = 'basic' | 'mid' | 'lets_go';
export type LoadType = 'kg' | 'bw' | 'bw+';
export type WorkoutSplit = 'push' | 'pull' | 'legs' | 'abs';

export type WorkoutSet = { load_type: LoadType; kg: number; reps: number; };
export type WorkoutExercise = { name: string; superset: boolean; sets: WorkoutSet[]; };

export type ActivityFeedItem = {
  id: number;
  type: string;
  date: string;
  duration_minutes: number;
  avg_bpm: number | null;
  effort: EffortLevel;
  effort_manually_set: boolean;
};
```

## `src/hooks/useActivityFeed.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { ActivityFeedItem } from '@/types/log';

export function useActivityFeed() {
  const [data, setData] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ActivityFeedItem[]>('/api/activities/feed?days=14');
      setData(res);
    } catch (e) {
      setError('Could not load activity feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, setData, loading, error, refetch: fetch };
}
```

## FoodCard wiring

Replace mock setTimeout with:
```typescript
const handleParse = async () => {
  setState('parsing');
  try {
    const result = await apiFetch<{ items: ParsedItem[], total_calories: number }>(
      '/api/log/food', { method: 'POST', body: JSON.stringify({ text: input }) }
    );
    setParsed(result);
    setState('parsed');
  } catch {
    setError('Could not parse food entry');
    setState('error');
  }
};

const handleConfirm = async () => {
  try {
    await apiFetch('/api/log/food/confirm', {
      method: 'POST',
      body: JSON.stringify({ items: parsed!.items, date: today() })
    });
    setState('confirmed');
    setTimeout(() => { setState('empty'); setInput(''); setParsed(null); }, 2000);
  } catch {
    setState('error');
  }
};
```

## StrengthCard wiring

**Load last session:**
```typescript
const loadLastSession = async (split: string) => {
  try {
    const data = await apiFetch<{ date: string, exercises: WorkoutExercise[] } | null>(
      `/api/log/strength/last/${split}`
    );
    if (data && data.exercises.length > 0) {
      setExercises(data.exercises);
      setLastDate(data.date);
    } else {
      setExercises([]);
      // show "No previous session found" message inline
    }
  } catch {
    // fail silently, start with empty exercise list
    setExercises([]);
  }
};
```

**Save session:**
```typescript
const saveSession = async () => {
  setState('saving');
  try {
    const result = await apiFetch<{ id: number, matched_activity_id: number | null }>(
      '/api/log/strength/save', {
        method: 'POST',
        body: JSON.stringify({
          workout_split: selectedSplit,
          exercises,
          start_time: buildStartTime(startTime),
          duration_minutes: duration,
          notes: null,
        })
      }
    );
    setMatchMessage(result.matched_activity_id
      ? 'Matched to Withings session ✓'
      : 'Saved — no Withings match found'
    );
    setState('confirmed');
    setTimeout(() => { setState('empty'); resetForm(); }, 3000);
  } catch {
    setState('error');
  }
};
```

**Brain Dump parse — try /api/log/strength/parse first, fall back to /api/log/strength:**
```typescript
// The parse endpoint may return different shapes — adapt as needed.
// Map whatever comes back to WorkoutExercise[] before setting parsed state.
```

## SaunaCard wiring

```typescript
const handleSubmit = async () => {
  try {
    await apiFetch('/api/log/sauna', {
      method: 'POST',
      body: JSON.stringify({
        session_datetime: `${today()}T${new Date().toTimeString().slice(0, 8)}`,
        duration_mins: duration,
        temperature_c: temperature,
        did_devotions: hasDevotion,
      })
    });
    setState('confirmed');
    setTimeout(() => setState('empty'), 2000);
  } catch {
    setState('error');
  }
};
```

## HabitsCard wiring

```typescript
const handleSubmit = async () => {
  try {
    await apiFetch('/api/log/habits', {
      method: 'POST',
      body: JSON.stringify({
        date: today(),
        habits: { stretching, meditation, cold_shower, supplements }
      })
    });
    setState('confirmed');
    setTimeout(() => setState('empty'), 2000);
  } catch {
    setState('error');
  }
};
```

## ActivityFeed wiring

Replace MOCK_ACTIVITY_FEED with useActivityFeed hook.

**Effort update — optimistic:**
```typescript
const updateEffort = async (id: number, effort: EffortLevel) => {
  const prev = data.find(i => i.id === id)?.effort;
  // optimistic update
  setData(d => d.map(i => i.id === id
    ? { ...i, effort, effort_manually_set: true }
    : i
  ));
  try {
    await apiFetch(`/api/activities/${id}/effort`, {
      method: 'PATCH',
      body: JSON.stringify({ effort })
    });
  } catch {
    // revert
    setData(d => d.map(i => i.id === id
      ? { ...i, effort: prev!, effort_manually_set: false }
      : i
    ));
  }
};
```

Feed loading state: show 3 skeleton rows (pulsing, same height as feed items).
Feed error state: inline banner "Couldn't load feed — tap to retry", ochre retry text.

## Phase 3 Done-When
- [ ] `npm run build` clean
- [ ] Food: real NLP parse (2-3s) → items → confirm → saved
- [ ] Strength Builder: load last session from API, save to API, match feedback shown
- [ ] Strength Brain Dump: real NLP parse → exercises → confirm → saved
- [ ] Sauna: posts with correct field names (session_datetime, duration_mins, did_devotions)
- [ ] Habits: posts to API
- [ ] Activity Feed: live data, skeleton while loading, error state with retry
- [ ] Effort selector: optimistic update, reverts on failure
- [ ] No mock imports in active component flows
- [ ] `src/types/log.ts` exists

---

---

# After All 3 Phases Complete

1. Move these to `tasks/done/`:
   - `task-05b-calendar-amendments.md`
   - `task-06-log-flow-revised.md`
   - `task-07-log-api-revised.md`
   - (also archive `06-log-flow.md` and `07-log-api.md` — superseded)

2. Update `README.md`:
   - Calendar → "Month grid with Ride, effort markers, devotions markers"
   - Log → "Live API — workout logger, activity feed, effort classification"

3. Add entry to `CHANGELOG.md`

4. Next task: `tasks/active/08-trends-view.md`

5. Stop and report.
