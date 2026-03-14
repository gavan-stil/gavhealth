# GOE Health — Live Feature Inventory

> Flat facts-only list of what is actually built and deployed.
> Update this file every time a task completes ("save it all").
> Source of truth replaces stale `specs/` files.

---

## Dashboard (`/`)

- **Readiness score card** — 0–100 hero number, signal color background (good/caution/poor), AI narrative (Claude Haiku 4.5) with deterministic fallback formula; breakdown chips for Sleep / RHR / Load / Recovery
- **GoalRingsRow** — 4 SVG progress rings (sleep, steps, protein, recovery); Apple Watch-style overflow; icons inside rings (moon, slash, fork, bolt)
- **QuickStatsRow** — compact horizontal metrics reflecting selected date
- **SleepCard** — last night sleep duration + deep %; tap → **SleepHistorySheet** bottom sheet (30 days, proportional stage bars: deep/light/awake, sleep score pill, slide-up animation)
- **IntradayHRChart** — dual Y-axis (HR left, steps right), single SVG overlay, dawn→clay→ochre color scale; steps sourced from intraday HR buckets (not daily_summary)
- **ActivityFeed** — last 30 days of activities; tap card → **ActivityDetailSheet** (start time, Avg/Low/High HR block, effort picker, link/unlink/delete, **pencil edit icon** for run/ride/workout → ActivityEditSheet); unlinked strength sessions shown as orphan cards (rust border + Link2Off pill); run/ride feed cards show dist + pace inline; **ActivityDetailSheet** run/ride uses horizontal bordered stat blocks (dist + pace row, time + bpm row)
- **StrengthCard** — last session vs now comparison header; per-exercise last/now tally; dual reps+vol badges; % diff badge (gold ≥0.5%, red < threshold); BW+ extra kg included in volume
- **WaterCard** — daily water intake display; fetches `days=2` to cover Brisbane pre-10am UTC boundary
- **MoodEnergyCard** — mood/energy score display
- **Date stepper** — all cards (sleep ring, steps ring, QuickStats, WaterCard) reflect stepped date
- **Pull-to-refresh** — re-fetches all dashboard endpoints

---

## Calendar (`/calendar`)

- **Month dot matrix** — 7 columns Mon–Sun, 4–5 rows; colored dots per category per day
- **Category dots** — Weight (#e8c47a), Sleep (#7FAABC), Heart (#c4856a), Running (#b8a878), Strength (#b47050), Sauna (#c45a4a), Nutrition (#e8c47a)
- **Category filter toggle bar** — show/hide individual categories
- **Month navigation** — prev/next buttons; `useCalendarData(year, month)` re-fetches on navigation using `start_date`/`end_date` params
- **DayDetailSheet** — tap day → bottom sheet; strength session cards (expand/collapse, exercise grid: split, body areas, sets×reps, top weight, totals); sauna always-open; run/ride/walk/other dot cards; run/ride use horizontal bordered stat blocks (dist + pace row, time + bpm row); other activity types use 2-col grid; **swipe left/right or ‹ › arrows** to navigate between days without closing sheet; **Edit details** button on run/ride/strength/sleep/sauna cards → opens ActivityEditSheet
- **SessionPickerSheet** — link manual strength log to Withings workout; triggered from StrengthCard in DayDetailSheet
- **Manual Withings sync button** — present on Calendar (and Dashboard)
- **Calendar styling** — visual polish pass on dot matrix and day cells (latest session)

---

## Log (`/log`)

- **Food logging** — NLP text input → Claude Haiku 4.5 parse → confirm step; macro breakdown card (protein/carbs/fat colored bars, calorie hero number); writes to `food_logs`
- **Strength logging** — NLP text input (e.g. "squat 100kg 3x5") → Claude Haiku 4.5 parse → confirm; exercise table (sets×reps@weight); PRs auto-updated on new max; draft persists in localStorage with resume banner; previous session affordance in ExerciseCard; writes to `strength_sessions` + `strength_sets` (normalised)
- **Strength session bridge** — 6-category exercise inference (chest/back/shoulders/arms/legs/core); DELETE session; UNLINK from Withings workout
- **Sauna logging** — direct form: date picker, duration slider (default 20 min), temperature (°C, default 85), optional notes; writes to `sauna_logs`
- **Habits logging** — Breathing + Devotions checkboxes, date defaults to today; upserts `daily_habits`
- **Water logging** — daily water intake entry; writes to `water_logs`
- **Mood/Energy logging** — mood + energy score entry; writes to `mood_logs`

---

## Trends (`/trends`)

- **Time range selector** — sticky pill toggle: 30d | 90d | 180d | All (default 90d)
- **ProteinWeightChart** — daily protein bars (green ≥180g, ochre <180g) + 180g reference line + body weight line overlay (right Y-axis); 7-day/Month toggle; summary row (avg protein, days on target, weight delta, latest kg)
- **EnergyBalanceChart** — intake/burn bars + weight line, dual Y-axis; protein-first summary row; kJ→kcal guard for CSV bulk import rows stored in kJ
- **StrengthQualityChart** — scatter plot: session duration vs avg HR, bubble size = sets, coloured by category
- **WorkoutVolumeChart** — strength volume (kg) over time
- **WaterTrendsChart** — 28-day daily bars, 3L target line, green/ochre colouring; data aggregated client-side by Brisbane local date
- **NutritionTrendsChart** — weekly protein bars (180g target line, green/ochre); data from `GET /api/food/weekly`
- **ExerciseProgressSection** — per-exercise progress charts; category filter (push/pull/legs/abs); mapped from backend categories: chest/shoulders/arms→push, back→pull, legs→legs, core→abs

---

## Backend / Infrastructure

- **Withings OAuth + auto-sync** — scheduled at 5:30am + 8:00am Brisbane (UTC+10); `workout` type = LiftWeights (category 46); category 187 remapped → run
- **Withings sync reliability** — COALESCE upserts (on_conflict_do_update), 30-day lookback for workouts, 7-day for daily, 3-day min for sleep (covers Withings processing delays)
- **Intraday HR sync** — `hr_intraday` table; getintradayactivity → hourly buckets; Brisbane UTC+10 timestamps
- **Sleep stages sync** — `sleep_logs.stages` JSONB; `GET /api/sleep/stages`
- **Readiness score** — `GET /api/readiness`; AI narrative (Claude Haiku 4.5) + deterministic formula fallback
- **Streaks** — `GET /api/streaks`; running, strength, sauna, habits
- **Strength normalised schema** — `strength_sessions` + `strength_sets` tables; `bridged_session_id` linking manual logs to Withings workouts; `bodyweight_at_session` column in `strength_sessions`
- **Last-by-split endpoint** — `GET /api/strength/sessions/last-by-split/{split}`
- **Brisbane timezone throughout** — `new Date(iso).toLocaleDateString('en-CA')` for local YYYY-MM-DD; never `.toISOString().split('T')[0]`
- **Bulk CSV import** — `backend/import_withings_csv.py`; idempotent; 6yr Withings history imported 2026-03-07
- **asyncpg NULL-cast fix** — Python `None` params resolved to typed `datetime` before SQL; avoids PostgreSQL `unknown` type error on `COALESCE(:param::timestamptz, NOW())`
- **Session edit endpoints** — `PATCH /api/activity-logs/{id}`, `PATCH /api/sleep/{id}`, `PATCH /api/sauna/{id}`; dynamic SET clause, only updates provided fields
- **ActivityEditSheet** — generic bottom sheet (zIndex 120) for editing activity/sleep/sauna records; run duration as MM:SS input (e.g. 26:12); pace as M:SS input (e.g. 5:16/km); **calculated pace** auto-derived from duration ÷ distance (used when pace field left blank); **calculated calories** estimated from duration × avg HR or distance fallback (used when calories field left blank); sleep fields: total/deep/light hours, avg HR, score; sauna fields: duration, temperature, breathing/devotions toggles
- **recordId propagation** — `CategoryDot.recordId` carries DB record IDs through `useCalendarData` → `CalendarData` → `DayDetailSheet` for direct edit without extra API calls

---

*Last updated: 2026-03-14 (T19 + T20)*
