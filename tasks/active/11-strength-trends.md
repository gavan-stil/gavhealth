# T11 — Strength Trends

> Status: **PLANNED — blocked on backend (Phase A)**
> Created: 2026-03-06
> Mockup: `archive/strength-trends-mockup.html` — approved by user

---

## Goal

Add two new sections to the **Trends page** (`/trends`) showing workout volume over time and per-exercise progress. Enable drill-down from weekly aggregates → individual sessions → exercise breakdown.

---

## Design Decisions (locked in this session)

| Decision | Choice | Reason |
|---|---|---|
| Location | Trends page, below existing Recovery sparklines | Not dashboard — more detail than dashboard warrants |
| Volume chart style | Scrollable bar chart, weekly by default | Weekly cleaner at 3-5x/week; cascade to sessions on tap |
| Metric toggle | Load (default) / Duration / Sets / Avg HR | Two default ON, rest available |
| Cascade | Weekly bars → tap → session bars + session chips → tap chip → detail panel | User asked for drill-down within chart area |
| Bodyweight source | 7-day rolling avg from `weight_log` | Stable; handles days without a weigh-in |
| Exercise grouping | Push / Pull / Legs / Abs filter pills | User requested; defined in frontend, not backend |
| Month labels | Show month name (ochre) below first week label of each month | Orientation without losing week granularity |

---

## Data Model

```
Withings sync → activity_log (type='workout')
  - id, activity_date, duration_mins, avg_hr, calories_burned, max_hr

Manual NLP logging → strength_sessions + strength_sets
  - strength_sessions: id, session_datetime, notes
  - strength_sets: session_id, exercise_id, set_number, reps, weight_kg,
                   is_bodyweight, bodyweight_at_session (currently NULL)

Link (to be added): strength_sessions.activity_log_id → activity_log.id
```

**Total load formula:**
```
per_set_load = (bodyweight_at_session + weight_kg) × reps
session_load = SUM(per_set_load) across all sets
```

**Cumulative monthly load per exercise:**
```
SUM(reps × weight_kg) grouped by exercise_id + month
```
(bodyweight not included here — pure added load for exercise progression)

---

## Phase A — Backend (must complete before Phase B)

These are Railway FastAPI changes. Complete in order — each unblocks the next.

### A1. Store bodyweight at log time
**File:** `/api/log/strength/confirm` and `/api/log/strength/save` endpoints

At confirmation time:
1. Look up `weight_log` for session date → use `weight_kg`
2. If no entry for that date → use 7-day rolling avg (avg of last 7 `weight_log` entries before session date)
3. Write result to `strength_sets.bodyweight_at_session` for all sets in session

**Done when:** `strength_sets.bodyweight_at_session` is populated for new sessions.

---

### A2. Link strength_sessions → activity_log
**File:** `strength_sessions` table migration + `/api/log/strength/confirm` and `/api/log/strength/save`

1. Add column: `activity_log_id INTEGER REFERENCES activity_log(id) NULL`
2. At log time: query `activity_log` for `type='workout'` rows within ±2 hours of session datetime
3. If exactly one match → set `activity_log_id`; if multiple or none → leave NULL, log warning
4. Existing T07 linking logic (in ActivityFeed) already does approximate date matching — can reuse

**Done when:** New strength sessions have `activity_log_id` populated when a matching workout exists.

---

### A3. New endpoint: GET /api/strength/sessions
```
GET /api/strength/sessions?days=N

Response:
[{
  "id": 1,
  "session_date": "2026-03-04",
  "activity_log_id": 1381,          // null if not linked
  "duration_mins": 52.7,            // from activity_log if linked, else null
  "avg_hr": 97,                     // from activity_log if linked, else null
  "calories": 221,                  // from activity_log if linked, else null
  "total_sets": 7,
  "total_reps": 42,
  "total_load_kg": 4200.0,          // SUM((bodyweight_at_session + weight_kg) × reps)
  "avg_load_per_set_kg": 600.0,
  "exercises": ["Squat", "Leg Press"]  // distinct exercise names
}]
```

Order: `session_date DESC`. Left join `activity_log` on `activity_log_id`.

**Done when:** Endpoint returns data and curl test passes.

---

### A4. New endpoint: GET /api/strength/exercise/:id/history
```
GET /api/strength/exercise/:id/history?days=N

Response:
[{
  "session_date": "2026-03-04",
  "sets": 4,
  "total_reps": 20,
  "top_weight_kg": 100.0,
  "session_volume_kg": 2000.0,      // SUM(reps × weight_kg) for this exercise in this session
  "estimated_1rm": 113.3            // Epley: weight × (1 + reps/30) using best set
}]
```

Order: `session_date ASC` (chronological for sparklines).

Note: Existing `/api/strength/:exercise_id` returns 404 — either wrong path or not wired. Replace or wire this properly.

**Done when:** Curl test returns per-session data for exercise_id=1 (Squat).

---

## Phase B — Frontend

**Prerequisite:** Phase A complete (at minimum A3 + A4 for full functionality; can stub with empty state if A1/A2 pending).

### B1. New hook: `useStrengthTrends`
**File:** `src/hooks/useStrengthTrends.ts`

```ts
interface StrengthTrendsState {
  sessions: StrengthSession[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useStrengthTrends(days: number): StrengthTrendsState
// Calls GET /api/strength/sessions?days=N via apiFetch
```

### B2. New hook: `useExerciseHistory`
**File:** `src/hooks/useExerciseHistory.ts`

```ts
function useExerciseHistory(exerciseId: number, days: number): CardState<ExerciseSession[]>
// Calls GET /api/strength/exercise/:id/history?days=N via apiFetch
```

### B3. New component: `WorkoutVolumeChart`
**File:** `src/components/trends/WorkoutVolumeChart.tsx`

Behaviours (all from mockup — see `archive/strength-trends-mockup.html`):
- Accepts `sessions: StrengthSession[]` + `days: number`
- Aggregates sessions into weekly buckets client-side
- Renders scrollable bar chart (weekly default)
- Metric toggle pills: Load | Duration | Sets | Avg HR
- Tap week bar → drill into sessions (bar chart + chips)
- Tap session chip → detail panel (load, sets, avg/set, exercise list)
- Month labels in ochre when month changes between weeks
- 3-state card: `CardSkeleton` | `CardError` | chart | `CardEmpty` (if no sessions)

Weekly aggregation logic:
```ts
// Group by ISO week number + year
const weekKey = (date: string) => {
  const d = new Date(date);
  // returns "2026-W09" style key
};
```

### B4. New component: `ExerciseProgressCard`
**File:** `src/components/trends/ExerciseProgressCard.tsx`

- Accepts `exercise: Exercise` + `history: ExerciseSession[]`
- Category tag (Push/Pull/Legs/Abs) — determined by lookup table in component
- Top-set sparkline (SVG polyline, ochre gradient, last value labelled)
- Monthly cumulative volume bars (last 4 months)
- `change4w`: difference in top weight vs 4 sessions ago
- 3-state card model

Exercise category map (define in component):
```ts
const EXERCISE_CATEGORIES: Record<string, 'push'|'pull'|'legs'|'abs'> = {
  'Squat': 'legs', 'Leg Press': 'legs', 'RDL': 'legs', 'Deadlift': 'legs',
  'Bench Press': 'push', 'OHP': 'push', 'Dips': 'push', 'Push-ups': 'push',
  'Pull-ups': 'pull', 'Row': 'pull', 'Chin-ups': 'pull',
  'Plank': 'abs', 'Crunch': 'abs',
};
// Default: 'legs' if not found
```

### B5. New component: `ExerciseProgressSection`
**File:** `src/components/trends/ExerciseProgressSection.tsx`

- Fetches `/api/exercises` (existing endpoint) to get list of all exercises
- Calls `useExerciseHistory` per exercise (parallel)
- Category filter pills: All | Push | Pull | Legs | Abs
- Renders filtered `ExerciseProgressCard` list
- Empty state if no exercises logged yet

### B6. Wire into TrendsPage

> **Note:** Do NOT replicate the tab bar from the mockup HTML. Use the existing `Layout` / `TabBar` component already in the app. The mockup tab bar is a visual placeholder only.
**File:** `src/pages/TrendsPage.tsx`

Add below existing `RecoverySparklines` and `PerformanceOverlay`:
```tsx
<SectionLabel>Workout Volume</SectionLabel>
<WorkoutVolumeChart sessions={strengthTrends.sessions} days={selectedDays} />

<SectionLabel>Exercise Progress</SectionLabel>
<ExerciseProgressSection days={selectedDays} />
```

The existing `selectedDays` state (7/30/90) drives both new sections.
Add `useStrengthTrends(selectedDays)` to `TrendsPage`.

---

## Types to add
**File:** `src/types/trends.ts` (create or extend)

```ts
export interface StrengthSession {
  id: number;
  session_date: string;
  activity_log_id: number | null;
  duration_mins: number | null;
  avg_hr: number | null;
  calories: number | null;
  total_sets: number;
  total_reps: number;
  total_load_kg: number;
  avg_load_per_set_kg: number;
  exercises: string[];
}

export interface ExerciseSession {
  session_date: string;
  sets: number;
  total_reps: number;
  top_weight_kg: number;
  session_volume_kg: number;
  estimated_1rm: number;
}
```

---

## Done Criteria

- [ ] A1: `bodyweight_at_session` populated for new sessions
- [ ] A2: `activity_log_id` populated for new sessions where match found
- [ ] A3: `GET /api/strength/sessions?days=90` returns correct aggregates (curl tested)
- [ ] A4: `GET /api/strength/exercise/1/history?days=90` returns session data (curl tested)
- [ ] B: WorkoutVolumeChart renders on Trends page — weekly bars, cascade interaction, all 4 metric toggles work
- [ ] B: ExerciseProgressSection renders with Push/Pull/Legs/Abs filter
- [ ] B: Empty state shows correctly when no strength sessions logged
- [ ] `npm run build` passes with no new errors

---

## Files Changed (expected)

**Backend (Railway):**
- Migration: add `activity_log_id` to `strength_sessions`, populate `bodyweight_at_session`
- `POST /api/log/strength/confirm` — store bodyweight + link activity
- `POST /api/log/strength/save` — same
- New routes: `/api/strength/sessions`, `/api/strength/exercise/:id/history`

**Frontend:**
- `src/hooks/useStrengthTrends.ts` — new
- `src/hooks/useExerciseHistory.ts` — new
- `src/components/trends/WorkoutVolumeChart.tsx` — new
- `src/components/trends/ExerciseProgressCard.tsx` — new
- `src/components/trends/ExerciseProgressSection.tsx` — new
- `src/pages/TrendsPage.tsx` — add new sections
- `src/types/trends.ts` — new or extended

---

## Reference

- Mockup (approved): `archive/strength-trends-mockup.html`
- Withings data map + backend gap detail: `reference/withings-data.md`
- API patterns: `reference/api.md`
- Hook pattern: `reference/architecture.md` §Key Patterns
