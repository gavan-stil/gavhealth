# T18 — Strength Volume Fix + Per-Exercise & Session-Level Comparison

**Status:** In Progress
**Started:** 2026-03-13
**Branch:** main

---

## Problem

1. **Backend `session_volume_kg` is wrong for BW exercises** — `/api/strength/exercise/{id}/history` SQL uses `SUM(st.reps * COALESCE(st.weight_kg, 0))`, which gives 0 for BW sets and ignores bodyweight for BW+ sets. The stored `bodyweight_at_session` is never included.

2. **Frontend `computeCurrentStats` has the same bug** — `bw` sets contribute 0 to volume; `bw+` sets only count added kg. No bodyweight lookup exists in the frontend.

3. **Comparison badge is either/or** — shows volume % OR reps %, not both simultaneously.

4. **No session-level comparison** — only per-exercise; user wants to see overall reps+volume change vs last session of the same split at the top of the workout.

---

## Changes

### Backend (`backend/app/routers/new_endpoints.py`)

**A. Fix `exercise_history` SQL** (line ~991)
Old:
```sql
SUM(st.reps * COALESCE(st.weight_kg, 0)) AS session_volume_kg
```
New:
```sql
SUM(st.reps * (COALESCE(st.bodyweight_at_session, 0) + COALESCE(st.weight_kg, 0))) AS session_volume_kg
```

**B. New endpoint `GET /api/strength/sessions/last-by-split/{split}`**
- Query `strength_sessions` (session_label = split, source = 'manual') + `strength_sets`
- Returns: `{ session_date, total_reps, total_volume_kg }` using BW-inclusive formula
- Used by frontend to show session-level comparison header

### Frontend (`src/components/log/StrengthCard.tsx`)

**C. Fetch bodyweight on mount**
- `GET /api/weight?limit=1` → `data[0].weight_kg` stored as `bodyweightKg: number | null`
- Fallback: show `~BW` label in volume if null

**D. Update `computeCurrentStats(sets, bwKg)`**
- `bw`: volume = `bwKg × reps` (or omit with label if null)
- `bw+`: volume = `(bwKg + kg) × reps`
- `kg`: unchanged

**E. Pass `bodyweightKg` into each `ExerciseCard` as prop**

**F. Show two badges per exercise** — separate reps Δ and volume Δ badges (not either/or)

**G. Session-level comparison header**
- When split is selected, fetch `GET /api/strength/sessions/last-by-split/{split}`
- If prior session exists: show "Last [split]: N reps · Xkg vol · [date]" and live session totals with Δ badges at top of exercise list
- Session totals computed from all exercises combined; volume uses corrected formula

---

## Correctness Notes

- `bodyweight_at_session` is stored at save time via `_lookup_bodyweight(db, session_date)` — 7-day rolling avg or exact date match from `weight_logs` table. This is the canonical BW for past sessions.
- For the live in-session display, `GET /api/weight?limit=1` gives the most recent recorded weight (same data source, same Withings feed into `weight_logs`).
- The `strength_sessions` list endpoint (`/api/strength/sessions`) already uses the correct BW-inclusive formula for `total_load_kg` — only the exercise history endpoint was wrong.

---

## Test Checklist

- [ ] BW-only exercise (e.g. Single leg hip thrust): "Now" volume shows `bodyweight × reps`, not 0
- [ ] BW+ exercise (e.g. Ring pull ups): "Now" volume shows `(bodyweight + added_kg) × reps`
- [ ] Two badges visible when both reps and volume differ from last session
- [ ] If bodyweight unavailable: `~BW` label, no volume badge for BW sets
- [ ] Session-level header shows last session stats for selected split
- [ ] Session-level reps + volume Δ badges update as exercises are filled in
- [ ] Pure kg exercise: unchanged behaviour
- [ ] `npm run build` passes

---

## API Reference

| Endpoint | Notes |
|----------|-------|
| `GET /api/strength/exercise/:id/history?days=N` | FIXED: `session_volume_kg` now includes `bodyweight_at_session` |
| `GET /api/strength/sessions/last-by-split/:split` | NEW: `{ session_date, total_reps, total_volume_kg }` for most recent session of that split |
| `GET /api/weight?limit=1` | Existing. Returns `{ data: [{ recorded_at, weight_kg }], total, ... }`. Use `data[0].weight_kg`. |
