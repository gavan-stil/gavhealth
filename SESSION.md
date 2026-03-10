# Session — T16 HR Zones

Started: 2026-03-10
Task file: `tasks/T16-hr-zones.md`

## Goal
Populate `hr_zone_0/1/2/3` columns in `activity_logs` from Withings sync,
expose a `/api/hr/zones` endpoint, build `RunHRZonesChart.tsx`.

## State
- [ ] T16-1: ALTER TABLE (4 zone columns) in main.py
- [ ] T16-2: sync_workouts writes zone data
- [ ] T16-3: GET /api/hr/zones endpoint
- [ ] T16-4: RunHRZonesChart.tsx + wire to TrendsPage

## Key facts
- Withings fields: `data.hr_zone_0/1/2/3` (seconds per zone) on workoutv2 sessions
- Backend sync file: `backend/app/sync.py`
- Startup migrations: `backend/app/main.py` (ALTER TABLE IF NOT EXISTS pattern)
- New endpoint goes in: `backend/app/routers/new_endpoints.py`
- Zone colours: zone0=muted, zone1=ochre, zone2=dawn, zone3=rust
- `zone_seconds` JSONB col already exists but always NULL — leave it, don't delete
