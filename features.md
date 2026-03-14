# GOE Health — Live Feature Inventory

> Flat facts-only list of what is actually built and deployed.
> Update this file every time a task completes ("save it all").
> Source of truth replaces stale `specs/` files.

---

## Dashboard (`/`)

- **MomentumCard** — replaces ReadinessCard; positioned above SleepCard; three-layer model (target range → 28d baseline → 7d trend); collapsed state: dual-area gradient chart (Recovery = avg normalised deviation of sleep/protein/water/calories vs baseline, gold filled area; Strain = RHR/weight inverted, clay dashed line; 14-day window) + signal dots + "N of 6 on track" count; expanded state: 6 signal rows each showing label, today value, deviation vs avg, and 56×28px mini gradient sparkline colour-matched to status; tap row → GoalDetailSheet (portal); card background tinted dawn-blue when majority signals off-track
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

- **Month dot matrix** — 7 columns Mon–Sun, 4–5 rows; colored bars per category per day; **multiple sessions per day stack as separate bars** (no collapsing); all activity types supported (runs, rides, sauna, strength, etc.)
- **Category dots** — Weight (#e8c47a), Sleep (#7FAABC), Heart (#c4856a), Running (#7a6848), Strength (#b47050), Ride (#c4789a), Sauna (#c45a4a)
- **Strength split icons** — `▶` push, `▼` pull, `●` legs; push/pull always takes priority; `●` appears alongside push/pull when any leg exercises were logged in the same session
- **Category filter toggle bar** — show/hide individual categories
- **Month navigation** — prev/next buttons; `useCalendarData(year, month)` re-fetches on navigation using `start_date`/`end_date` params
- **DayDetailSheet** — tap day → bottom sheet; strength session cards (expand/collapse, exercise grid: split, body areas, sets×reps, top weight, totals, **Edit button**); sauna always-open; run/ride/walk/other dot cards; run/ride use horizontal bordered stat blocks (dist + pace row, time + bpm row); other activity types use 2-col grid; **swipe left/right or ‹ › arrows** to navigate between days without closing sheet; **Edit details** button on run/ride/sleep/sauna cards; **Edit button on strength session cards** → opens workout ActivityEditSheet
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
- **ProteinWeightChart** — daily protein bars (green ≥target, ochre <target) + target reference line (reads from `health_goals`) + body weight line overlay (right Y-axis); 7-day/Month toggle; summary row (avg protein, days on target, weight delta, latest kg)
- **EnergyBalanceChart** — intake/burn bars + weight line, dual Y-axis; protein-first summary row; kJ→kcal guard; protein target reads from `health_goals`
- **StrengthQualityChart** — scatter plot: session duration vs avg HR, bubble size = sets, coloured by category
- **WorkoutVolumeChart** — strength volume (kg) over time
- **WaterTrendsChart** — 28-day daily bars, target line (reads from `health_goals`), green/ochre colouring; data aggregated client-side by Brisbane local date
- **NutritionTrendsChart** — weekly protein bars (target line from `health_goals`, green/ochre); data from `GET /api/food/weekly`
- **ExerciseProgressSection** — per-exercise progress charts; category filter (push/pull/legs/abs); mapped from backend categories: chest/shoulders/arms→push, back→pull, legs→legs, core→abs

---

## Backend / Infrastructure

- **Withings OAuth + auto-sync** — scheduled at 5:30am + 8:00am Brisbane (UTC+10); `workout` type = LiftWeights (category 46); category 187 remapped → run
- **Withings sync reliability** — COALESCE upserts (on_conflict_do_update), 30-day lookback for workouts, 7-day for daily, 3-day min for sleep (covers Withings processing delays)
- **Intraday HR sync** — `hr_intraday` table; getintradayactivity → hourly buckets; Brisbane UTC+10 timestamps
- **Sleep stages sync** — `sleep_logs.stages` JSONB; `GET /api/sleep/stages`
- **Momentum system** — `health_goals` table (append-only, signal + target_min/max + notes); seeded with defaults for 6 signals; `GET /api/momentum` (baselines, trends, status), `GET /api/momentum/signals?days=N` (per-day history), `GET /api/goals`, `POST /api/goals`, `GET /api/goals/{signal}/history`; services/momentum.py computes 28d baseline, 7d trend direction, gap_pct, and on_track/improving/off_track status per signal
- **Readiness score** — `GET /api/readiness`; AI narrative (Claude Haiku 4.5) + deterministic formula fallback
- **Streaks** — `GET /api/streaks`; running, strength, sauna, habits
- **Strength normalised schema** — `strength_sessions` + `strength_sets` tables; `bridged_session_id` linking manual logs to Withings workouts; `bodyweight_at_session` column in `strength_sessions`
- **Last-by-split endpoint** — `GET /api/strength/sessions/last-by-split/{split}`
- **Brisbane timezone throughout** — `new Date(iso).toLocaleDateString('en-CA')` for local YYYY-MM-DD; never `.toISOString().split('T')[0]`; backend sauna + strength session date filtering uses `AT TIME ZONE 'Australia/Brisbane'` (fixes pre-10am sessions filing under wrong UTC date)
- **Bulk CSV import** — `backend/import_withings_csv.py`; idempotent; 6yr Withings history imported 2026-03-07
- **asyncpg NULL-cast fix** — Python `None` params resolved to typed `datetime` before SQL; avoids PostgreSQL `unknown` type error on `COALESCE(:param::timestamptz, NOW())`
- **Session edit endpoints** — `PATCH /api/activity-logs/{id}` (fields: `started_at`, `activity_date`, `duration_mins`, `avg_hr`, `min_hr`, `max_hr`, `distance_km`, `avg_pace_secs`, `calories_burned`, **`workout_split`**, **`activity_date`**), `PATCH /api/sleep/{id}`, `PATCH /api/sauna/{id}`; dynamic SET clause, only updates provided fields
- **ActivityEditSheet** — generic bottom sheet (zIndex 120) for editing activity/sleep/sauna/workout records; **workout type**: split picker (Push/Pull/Legs buttons), date input, time input, duration (MM:SS), avg/min/max HR, calories; run type: duration MM:SS, distance, pace M:SS, HR, calories (calculated pace + calories hints); sleep fields: total/deep/light hours, avg HR, score; sauna fields: duration, temperature, breathing/devotions toggles
- **recordId propagation** — `CategoryDot.recordId` carries DB record IDs through `useCalendarData` → `CalendarData` → `DayDetailSheet` for direct edit without extra API calls

---

## Goals (`/goals`)

- **GoalsPage** — 6 signal sections (Sleep, Resting HR, Weight, Calories, Protein, Water); no tab bar entry, reachable from MomentumCard "Edit Goals →"
- **Per-signal section** — current target range, 28-day average, collapsible 7-day trend sparkline (`SignalDeviationChart`), "Set New Target" inline form (min + max inputs + optional notes), append-only save (old targets preserved in history), collapsible history timeline (newest entry highlighted)
- **SignalDeviationChart** — gradient area chart (gold stroke + top-to-transparent fill gradient); dashed baseline reference line at y=0; ochre target-zone ReferenceArea band; used in GoalDetailSheet + GoalsPage per-signal sparklines
- **GoalDetailSheet** — bottom sheet via `createPortal` to `document.body` (fixes position:fixed inside scroll container); today/28d avg/target stats; 7-day `SignalDeviationChart`; "Edit Target →" link to GoalsPage

---

*Last updated: 2026-03-14 (T22 polish)*
