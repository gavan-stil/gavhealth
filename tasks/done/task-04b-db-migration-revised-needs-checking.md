# Task 04b — Database Migration & New Endpoints

Purpose: Extend the Railway backend schema to support effort classification, sauna extras, workout split tracking, and manual strength log matching to Withings activities.

---

## Scope Gate

**DOES:**
- Add `effort` field to activities table
- Add `meditation_minutes` and `devotions` fields to sauna sessions table
- Add `workout_split` field to strength activities
- Create new `manual_strength_logs` table
- Add `matched_activity_id` FK on `manual_strength_logs`
- Add new API endpoints for effort PATCH, activity feed, strength log save, and Withings match
- Verify all existing endpoints still work after migration

**DOES NOT:**
- Touch any frontend code
- Modify existing endpoint response shapes (only adds new fields)
- Remove or rename any existing tables or columns

---

## Pre-flight Checks

- [ ] Railway backend is accessible: `curl -s https://gavhealth-production.up.railway.app/api/health`
- [ ] Existing API endpoints return data (spot check `/api/readiness` and `/api/data/activities?days=7`)
- [ ] PostgreSQL connection string available in Railway environment

---

## Database Changes

### 1. Alter `activities` table

```sql
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS effort VARCHAR(10) NOT NULL DEFAULT 'mid'
    CHECK (effort IN ('basic', 'mid', 'lets_go'));
```

### 2. Alter `sauna_sessions` table (or equivalent sauna table)

```sql
ALTER TABLE sauna_sessions
  ADD COLUMN IF NOT EXISTS meditation_minutes INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS devotions BOOLEAN NOT NULL DEFAULT FALSE;
```

> **Note:** Check actual table name first — may be `sauna_logs` or similar. Run `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';` to confirm.

### 3. Create `manual_strength_logs` table

```sql
CREATE TABLE IF NOT EXISTS manual_strength_logs (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER,
  workout_split       VARCHAR(10) NOT NULL CHECK (workout_split IN ('push', 'pull', 'legs', 'abs')),
  exercises           JSONB NOT NULL DEFAULT '[]',
  -- exercises shape:
  -- [{ name: string, superset: boolean, sets: [{ load_type: 'kg'|'bw'|'bw+', kg: number, reps: number }] }]
  start_time          TIMESTAMP NOT NULL,
  duration_minutes    INTEGER NOT NULL,
  notes               TEXT DEFAULT NULL,
  matched_activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
  match_confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
  -- match_confirmed: false = auto-matched, true = manually confirmed by user
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_strength_logs_start_time ON manual_strength_logs(start_time);
CREATE INDEX IF NOT EXISTS idx_manual_strength_logs_split ON manual_strength_logs(workout_split);
CREATE INDEX IF NOT EXISTS idx_manual_strength_logs_matched ON manual_strength_logs(matched_activity_id);
```

---

## New API Endpoints

### 1. PATCH /api/activities/:id/effort

Update effort classification on any activity.

```
PATCH /api/activities/{id}/effort
Auth: X-API-Key header
Body: { effort: "basic" | "mid" | "lets_go" }
Response: { id: number, effort: string, updated_at: string }
Errors: 404 if activity not found, 400 if invalid effort value
```

### 2. GET /api/activities/feed

Recent activity feed for the Activity tab. Returns last 14 days by default.

```
GET /api/activities/feed?days=14
Auth: X-API-Key header
Response: [
  {
    id: number,
    type: string,           // "run" | "strength" | "ride" | "sauna" | "other"
    name: string,           // e.g. "Morning Run", "Strength Training"
    date: string,           // YYYY-MM-DD
    start_time: string,     // ISO timestamp
    duration_minutes: number,
    avg_bpm: number | null,
    effort: string,         // "basic" | "mid" | "lets_go"
    effort_is_default: boolean,  // true if never manually set
    // type-specific fields:
    distance_km: number | null,     // run, ride
    avg_speed_kmh: number | null,   // ride
    pace_min_km: string | null,     // run e.g. "5:12"
    total_sets: number | null,      // strength
    workout_split: string | null,   // strength: push/pull/legs/abs
    meditation_minutes: number | null,  // sauna
    devotions: boolean | null,          // sauna
    manual_log_id: number | null,   // strength: linked manual log if matched
  }
]
```

### 3. POST /api/log/strength/save

Save a manual strength log and attempt Withings match.

```
POST /api/log/strength/save
Auth: X-API-Key header
Body: {
  workout_split: "push" | "pull" | "legs" | "abs",
  exercises: [
    {
      name: string,
      superset: boolean,
      sets: [{ load_type: "kg" | "bw" | "bw+", kg: number, reps: number }]
    }
  ],
  start_time: string,       // ISO timestamp — used for Withings match
  duration_minutes: number,
  notes: string | null
}

Response: {
  id: number,
  matched_activity_id: number | null,  // null if no match found
  match_confirmed: boolean,
  match_window_used: "±30 minutes"
}
```

**Matching logic (backend):**
- On save, query activities table for any strength/weights activity where `start_time` falls within ±30 minutes of the submitted `start_time`
- If exactly one match found: set `matched_activity_id`, set `match_confirmed = false` (auto-match, unconfirmed)
- If multiple matches: take the closest by timestamp
- If no match: save with `matched_activity_id = null`

### 4. GET /api/log/strength/last/:split

Recall the last logged session for a given split. Used to prefill the workout logger.

```
GET /api/log/strength/last/{split}
Auth: X-API-Key header
Path param: split = "push" | "pull" | "legs" | "abs"
Response: {
  id: number,
  date: string,           // YYYY-MM-DD of last session
  exercises: [
    {
      name: string,
      superset: boolean,
      sets: [{ load_type: string, kg: number, reps: number }]
    }
  ]
} | null  // null if no previous session for this split
```

### 5. PATCH /api/log/strength/:id/relink

Re-link a manual strength log to a different Withings activity (manual override).

```
PATCH /api/log/strength/{id}/relink
Auth: X-API-Key header
Body: { activity_id: number }
Response: { id: number, matched_activity_id: number, match_confirmed: true }
```

### 6. GET /api/activities/linkable

Returns activities available to link to a manual strength log. Used in the relink picker.

```
GET /api/activities/linkable?days=14
Auth: X-API-Key header
Response: [
  {
    id: number,
    type: string,
    name: string,
    date: string,
    start_time: string,
    duration_minutes: number
  }
]
```

### 7. PATCH /api/log/sauna/:id

Update sauna session with meditation and devotions extras.

```
PATCH /api/log/sauna/{id}
Auth: X-API-Key header
Body: {
  meditation_minutes: number | null,
  devotions: boolean
}
Response: { id: number, meditation_minutes: number | null, devotions: boolean }
```

---

## Verify Existing Endpoints Unaffected

After migration, spot-check these return valid data:
- `GET /api/readiness`
- `GET /api/summary/daily`
- `GET /api/streaks`
- `GET /api/data/activities?days=90`
- `GET /api/data/sleep?days=90`
- `GET /api/data/sauna?days=90`

---

## Done-When

- [ ] `activities` table has `effort` column with default 'mid'
- [ ] `sauna_sessions` table has `meditation_minutes` and `devotions` columns
- [ ] `manual_strength_logs` table exists with correct schema and indexes
- [ ] `PATCH /api/activities/:id/effort` returns 200 with updated effort
- [ ] `GET /api/activities/feed?days=14` returns array with correct shape
- [ ] `POST /api/log/strength/save` saves log and attempts Withings match
- [ ] `GET /api/log/strength/last/:split` returns previous session or null
- [ ] `PATCH /api/log/strength/:id/relink` updates matched_activity_id
- [ ] `GET /api/activities/linkable` returns recent activities
- [ ] `PATCH /api/log/sauna/:id` updates meditation/devotions fields
- [ ] All existing endpoints still return valid data
- [ ] No TypeScript errors if backend uses typed schemas

---

## If Blocked

1. Check actual table names first with `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
2. If sauna table name differs, adjust ALTER TABLE statement accordingly
3. Try 3 approaches before stopping
4. Do NOT keep looping — report blocker with specifics

---

## After Completion

1. Move this file from `tasks/active/` to `tasks/done/`
2. Update `README.md`: add new row "Backend Migration" → "✅ Done"
3. Add entry to `CHANGELOG.md`
4. Start next task: `tasks/active/05b-calendar-amendments.md`
