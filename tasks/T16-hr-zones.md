# T16 — HR Zones Backend

> Goal: populate `hr_zone_0/1/2/3` (seconds in each zone) from Withings sync so the Run HR Zones chart (T15-3) can be built.

Started: 2026-03-10
Status: 🔲 not started

---

## Background

Withings `workoutv2` API returns per-session HR zone seconds:

| Withings field | Description |
|---|---|
| `data.hr_zone_0` | Time in zone 0 (rest/low), seconds |
| `data.hr_zone_1` | Time in zone 1 (fat burn), seconds |
| `data.hr_zone_2` | Time in zone 2 (cardio), seconds |
| `data.hr_zone_3` | Time in zone 3 (peak), seconds |

The DB has a `zone_seconds` JSONB column that was always NULL (never populated).
The plan is to replace it with 4 dedicated integer columns.

---

## Tasks

### T16-1: DB migration — add `hr_zone_0/1/2/3` columns
- `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS hr_zone_0 INTEGER`
- Same for `hr_zone_1`, `hr_zone_2`, `hr_zone_3`
- Do this in `main.py` startup block (same pattern as `started_at`, `min_hr`)
- Leave `zone_seconds` JSONB in place for now (don't break anything)

### T16-2: Update `sync_workouts` to write zone columns
- File: `backend/app/sync.py` (or wherever `sync_workouts` lives)
- Pull `hr_zone_0/1/2/3` from `workout["data"]` — fall back to `None` if key absent
- Add to the upsert dict alongside `avg_hr`, `max_hr`, `min_hr`
- The upsert is `on_conflict_do_update` so re-syncing will backfill recent sessions

### T16-3: `GET /api/hr/zones?days=N` endpoint
Shape (curl-verify before writing component):
```json
[
  {
    "date": "2026-03-10",
    "activity_type": "run",
    "duration_mins": 42,
    "hr_zone_0": 120,
    "hr_zone_1": 800,
    "hr_zone_2": 1100,
    "hr_zone_3": 480
  }
]
```
- Filter: `activity_type IN ('run', 'ride')` — cardio only
- Order: `activity_date ASC`
- Days param default 30

### T16-4: `RunHRZonesChart.tsx` (unblocks T15-3)
- Stacked bar chart: one bar per run/ride session
- Segments: zone0 (muted), zone1 (ochre), zone2 (dawn), zone3 (rust)
- X-axis: date label; Y-axis: minutes
- Summary row: avg % time in zone 2+3 over period
- Place in `TrendsPage` after `StrengthQualityChart`

---

## Key files

| File | Notes |
|---|---|
| `backend/app/main.py` | ALTER TABLE startup block — add zone columns here |
| `backend/app/sync.py` | `sync_workouts` — add zone fields to upsert |
| `backend/app/routers/new_endpoints.py` | Add `/api/hr/zones` endpoint |
| `src/components/trends/RunHRZonesChart.tsx` | New component (T16-4) |
| `src/pages/TrendsPage.tsx` | Wire chart in after T16-4 done |

---

## Verification

After T16-2 deployed:
1. Trigger a manual sync (Dashboard sync button or `/api/sync/workouts`)
2. `SELECT id, activity_date, hr_zone_0, hr_zone_1, hr_zone_2, hr_zone_3 FROM activity_logs WHERE activity_type = 'run' ORDER BY activity_date DESC LIMIT 5;`
3. Confirm non-NULL values appear for recent sessions

After T16-3:
- `curl .../api/hr/zones?days=30` → array with zone seconds

After T16-4:
- `npm run build` must pass clean
