# Task 07 — Log API Wiring — REVISED

Purpose: Wire all log cards and the Activity Feed to live API endpoints. Replace all mock data with live responses.

---

## Scope Gate

**DOES:**
- Wire Food card to `POST /api/log/food` → parse → `POST /api/log/food/confirm`
- Wire Strength card Builder mode to `POST /api/log/strength/save` (with Withings match)
- Wire Strength card "Load last session" to `GET /api/log/strength/last/:split`
- Wire Strength card Brain Dump to `POST /api/log/strength` (NLP parse) → confirm
- Wire Sauna card to `POST /api/log/sauna` (with meditation_minutes and devotions)
- Wire Habits card to `POST /api/log/habits`
- Wire Activity Feed to `GET /api/activities/feed`
- Wire effort selector to `PATCH /api/activities/:id/effort`
- Wire relink button to `GET /api/activities/linkable` + `PATCH /api/log/strength/:id/relink`
- Replace all mock imports with live API responses

**DOES NOT:**
- Modify any card UI design (done in Task 06)
- Add offline queueing or retry logic beyond what's specified
- Build edit/delete for past entries
- Touch Dashboard, Calendar, or Trends routes

---

## Pre-flight Checks

- [ ] Task 04b complete: all new backend endpoints exist and return correct shapes
- [ ] Task 06 complete: all log cards render with mock data
- [ ] Verify each endpoint with curl before wiring:
  - `curl -H "X-API-Key: gavhealth-prod-api-2026-xK9mP3" https://gavhealth-production.up.railway.app/api/activities/feed?days=14`
  - `curl -H "X-API-Key: gavhealth-prod-api-2026-xK9mP3" https://gavhealth-production.up.railway.app/api/log/strength/last/push`
- [ ] `apiFetch<T>()` exists in `src/lib/api.ts`
- [ ] `npm run dev` runs without errors

---

## Design Tokens (inline)

```css
:root {
  --bg-base: #0d0d0a; --bg-card: #14130f; --bg-elevated: #1e1d18;
  --border-default: #222018; --text-primary: #f0ece4; --text-secondary: #b0a890;
  --text-muted: #7a7060; --ochre: #d4a04a; --rust: #b47050; --ember: #c45a4a;
  --signal-poor: #c47a6a;
}
```

---

## API Endpoints (inline)

**Base URL:** `https://gavhealth-production.up.railway.app`
**Auth header:** `X-API-Key: gavhealth-prod-api-2026-xK9mP3`

### Food — 2-step NLP (unchanged from original Task 07)

```
POST /api/log/food
Body: { text: string }
Response: { items: [{ name, calories, protein_g }], total_calories: number }

POST /api/log/food/confirm
Body: { items: [...], date: string }
Response: { success: boolean }
```

### Strength — Builder mode (new)

```
POST /api/log/strength/save
Body: {
  workout_split: "push" | "pull" | "legs" | "abs",
  exercises: [{ name, superset, sets: [{ load_type, kg, reps }] }],
  start_time: string,      // ISO — new Date().toISOString()
  duration_minutes: number,
  notes: string | null
}
Response: {
  id: number,
  matched_activity_id: number | null,
  match_confirmed: boolean
}
```

On response, if `matched_activity_id` is not null: show a brief toast or inline note:
"Matched to Withings session" (or "No Withings match found — saved standalone").

### Strength — Load last session

```
GET /api/log/strength/last/{split}
Response: { date, exercises: [...] } | null
```

On null response: show "No previous [Push] session found" and start with empty exercise list.

### Strength — Brain Dump NLP (new endpoint)

```
POST /api/log/strength/parse
Body: { text: string }
Response: {
  exercises: [{ name, superset, sets: [{ load_type, kg, reps }] }]
}
```

> **If this endpoint doesn't exist:** Fall back to using the existing `POST /api/log/strength` endpoint. Check response shape and adapt accordingly. Report to Gav if neither exists.

### Strength — Relink

```
GET /api/activities/linkable?days=14
Response: [{ id, type, name, date, start_time, duration_minutes }]

PATCH /api/log/strength/{id}/relink
Body: { activity_id: number }
Response: { id, matched_activity_id, match_confirmed: true }
```

### Sauna — Updated with extras

```
POST /api/log/sauna
Body: {
  duration_minutes: number,
  temperature_c: number,
  date: string,
  meditation_minutes: number | null,
  devotions: boolean
}
Response: { success: boolean, id: number }
```

### Habits (unchanged)

```
POST /api/log/habits
Body: { date, habits: { stretching, meditation, cold_shower, supplements } }
Response: { success: boolean }
```

### Activity Feed

```
GET /api/activities/feed?days=14
Response: [{
  id, type, name, date, duration_minutes, avg_bpm, effort, effort_is_default,
  distance_km?, avg_speed_kmh?, pace_min_km?, total_sets?, workout_split?,
  meditation_minutes?, devotions?
}]
```

### Effort Update

```
PATCH /api/activities/{id}/effort
Body: { effort: "basic" | "mid" | "lets_go" }
Response: { id, effort, updated_at }
```

On success: update local state immediately (optimistic update). On failure: revert and show error toast.

---

## Component Wiring

### StrengthCard.tsx — Builder mode

Replace mock `MOCK_LAST_PUSH_SESSION` with:
```typescript
const loadLastSession = async (split: string) => {
  const data = await apiFetch<LastSessionResponse | null>(
    `/api/log/strength/last/${split}`
  );
  if (data) {
    setExercises(data.exercises);
    setLastSessionDate(data.date);
  } else {
    setExercises([]);
    // show "No previous session" message
  }
};
```

Replace mock save with:
```typescript
const saveSession = async () => {
  const result = await apiFetch<SaveResponse>('/api/log/strength/save', {
    method: 'POST',
    body: JSON.stringify({
      workout_split: selectedSplit,
      exercises,
      start_time: buildStartTime(startTime), // combine today's date + time input
      duration_minutes: duration,
      notes: null,
    }),
  });
  // Show match feedback
  if (result.matched_activity_id) {
    setMatchMessage('Matched to Withings session ✓');
  } else {
    setMatchMessage('Saved — no Withings match found');
  }
};
```

### ActivityFeed.tsx

Replace `MOCK_ACTIVITY_FEED` with:
```typescript
const { data, loading, error } = useActivityFeed();
// useActivityFeed: calls GET /api/activities/feed?days=14
// Returns { data: ActivityFeedItem[], loading, error, refetch }
```

Create `src/hooks/useActivityFeed.ts` using the existing `useCardFetch` pattern from Task 03.

Effort update:
```typescript
const updateEffort = async (id: number, effort: EffortLevel) => {
  // Optimistic update
  setItems(prev => prev.map(item =>
    item.id === id ? { ...item, effort, effort_is_default: false } : item
  ));
  try {
    await apiFetch(`/api/activities/${id}/effort`, {
      method: 'PATCH',
      body: JSON.stringify({ effort }),
    });
  } catch {
    // Revert on failure
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, effort: originalEffort } : item
    ));
    // show error
  }
};
```

### Relink flow

In ActivityFeed, strength items show a "Re-link" button (small, ghost style).

Tapping opens a bottom sheet with linkable activities:
```typescript
const openRelink = async (logId: number) => {
  const activities = await apiFetch<LinkableActivity[]>(
    '/api/activities/linkable?days=14'
  );
  setLinkableActivities(activities);
  setRelinkTarget(logId);
  setRelinkOpen(true);
};
```

Bottom sheet: scrollable list of activities, tap to select, confirm button calls:
```typescript
await apiFetch(`/api/log/strength/${relinkTarget}/relink`, {
  method: 'PATCH',
  body: JSON.stringify({ activity_id: selectedActivityId }),
});
```

---

## Date Handling

All log entries use today's date:
```typescript
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
```

For strength session start time (combine date + time input):
```typescript
const buildStartTime = (timeInput: string): string => {
  const today = new Date().toISOString().split('T')[0];
  return `${today}T${timeInput}:00`;
};
```

---

## Error Handling

For each API call, show per-card inline errors (not full-page):
- Card → error state: AlertTriangle icon + message + "Try again"
- Activity feed error: inline banner at top of feed with retry
- Effort update failure: toast-style message, auto-dismiss after 3s

---

## TypeScript Types — `src/types/log.ts` (new file)

```typescript
export type EffortLevel = 'basic' | 'mid' | 'lets_go';
export type LoadType = 'kg' | 'bw' | 'bw+';
export type WorkoutSplit = 'push' | 'pull' | 'legs' | 'abs';

export type WorkoutSet = { load_type: LoadType; kg: number; reps: number };
export type WorkoutExercise = { name: string; superset: boolean; sets: WorkoutSet[] };

export type ActivityFeedItem = {
  id: number;
  type: string;
  name: string;
  date: string;
  duration_minutes: number;
  avg_bpm: number | null;
  effort: EffortLevel;
  effort_is_default: boolean;
  distance_km?: number;
  avg_speed_kmh?: number;
  pace_min_km?: string;
  total_sets?: number;
  workout_split?: WorkoutSplit;
  meditation_minutes?: number;
  devotions?: boolean;
};

export type LinkableActivity = {
  id: number;
  type: string;
  name: string;
  date: string;
  start_time: string;
  duration_minutes: number;
};
```

---

## File Structure

```
src/
├── types/
│   └── log.ts                          (new)
├── hooks/
│   └── useActivityFeed.ts              (new)
├── components/
│   └── log/
│       ├── FoodCard.tsx                (modify — replace mock with API)
│       ├── StrengthCard.tsx            (modify — add API calls, relink flow)
│       ├── SaunaCard.tsx               (modify — add meditation/devotions to POST body)
│       ├── HabitsCard.tsx              (modify — add API call)
│       └── ActivityFeed.tsx            (modify — replace mock with live feed, wire effort PATCH)
├── mocks/
│   └── log.ts                          (keep but remove imports from active components)
```

---

## Done-When

- [ ] Food: free text → API parse → items → confirm → saved
- [ ] Strength Builder: load last session prefills exercises, save posts to API, match feedback shown
- [ ] Strength Brain Dump: NLP parse → structured exercises → confirm → saved
- [ ] Sauna: posts with meditation_minutes and devotions values
- [ ] Habits: posts to API
- [ ] Activity Feed: live data from `/api/activities/feed`
- [ ] Effort selector: PATCH call succeeds, optimistic update works, reverts on failure
- [ ] Relink: opens bottom sheet with linkable activities, patches on confirm
- [ ] All error states work for failed API calls
- [ ] No mock imports used in active component flows
- [ ] `src/types/log.ts` created with all types
- [ ] No TypeScript errors (`npm run build` succeeds)

---

## If Blocked

1. **Endpoint doesn't exist:** curl to verify before assuming — check exact path and shape
2. **Shape mismatch:** build a transform layer, document the actual vs expected shape
3. **Try 3 approaches** before stopping
4. **Do NOT keep looping** — report blocker with specifics

---

## After Completion

1. Move this file from `tasks/active/` to `tasks/done/`
2. Update `README.md`: Log → "Live API — workout logger, activity feed, effort classification"
3. Add entry to `CHANGELOG.md`
4. Start next task: `tasks/active/08-trends-view.md`
