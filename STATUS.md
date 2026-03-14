# GOE Health — Status

> Single startup file. Read this first every session. Update when tasks start/finish.

---

## Phase

**Phase 1 MVP complete ✅** — deployed at [gavhealth.vercel.app](https://gavhealth.vercel.app)

All 9 tasks shipped. App is live, logging flows work end-to-end.

---

## Active Task

None — backlog next.

---

**T20** — Run edit UX: duration & pace as MM:SS, calculated pace & calories — ✅ complete (2026-03-14).
Commits: `072ae78`, `75eb9dd`
- Duration field: MM:SS text input (e.g. 26:12 = 26min 12sec), converts to/from decimal mins for DB
- Pace field: M:SS text input (e.g. 5:16 = 5min 16sec/km), converts to/from secs for DB
- Calculated pace: auto-derived from duration ÷ distance, shown as ochre hint, used when pace field left blank
- Calculated calories: estimated from duration × avg HR (fallback: distance × 75), used when calories field left blank
- Removed launch.json to stop [Preview Required] hook feedback (`27a02db`)

**T19** — Protein/Weight Chart + Day Swipe Nav + Session Edit — ✅ complete (2026-03-14).
Commit: `b561b38`
- ProteinWeightChart on Trends: bars (green ≥180g / ochre <180g) + 180g reference line + weight line overlay, 7-day/Month toggle, summary row
- DayDetailSheet swipe navigation: swipe left/right or ‹ › arrows to move between calendar days without closing sheet
- Session edit: PATCH /api/activity-logs/{id}, /api/sleep/{id}, /api/sauna/{id} backend endpoints; ActivityEditSheet frontend; Edit button on all DayDetailSheet cards (run/ride/strength/sleep/sauna) + pencil icon in ActivityDetailSheet (Log page); recordId propagated through CategoryDot chain

---

**T18** — Strength Volume Fix + Per-Exercise & Session-Level Comparison — ✅ complete (2026-03-13).
Commits: `5838fd9`, `7e1d89c`
- Backend: exercise history SQL now includes `bodyweight_at_session`; new `GET /api/strength/sessions/last-by-split/{split}` endpoint
- Frontend: bodyweight fetched from `/api/weight?limit=1`; `computeCurrentStats` handles bw/bw+ correctly; dual reps+vol badges; session comparison header; whole-kg rounding throughout

---

**T17** — Strength Session Consistency + Session Picker — ✅ complete (2026-03-11).
Commit: `a6f0828`
- SessionPickerSheet, StrengthCard trigger, shared 4-col exercise table + PB dots across DayDetailSheet / ActivityDetailSheet / ActivityFeed (OrphanCard)

---

**T16** — HR Zones Backend — deprioritised (parked).
Task file: `tasks/T16-hr-zones.md`

---

**T15 Sprint** — complete ✅ (2026-03-10). All code items done.
Task file: `tasks/T15-trends-energy-balance.md`
Commits: `29dbae4` (backend), `382fd68` (frontend + kJ fix), `f82dd9a` (import fix + docs)

**T14 Sprint** — complete ✅ (2026-03-10). Only 1.6 (food photo spec) is a non-code research item, deprioritised.
All code items done: 1a✅ 1b✅ 1c✅ 1d✅ 1e✅ 1f✅ 1g✅ 1h✅ 1.2✅ 1.3✅ 1.4✅ 1.7✅ 1.8✅ 2.1✅ 3✅ 4✅ 1.1-filter✅ 1.1-sessions✅ goal-rings✅ day-detail-sheet✅ 2✅.
Full task list: `tasks/T14-sprint.md`

---

---

## Recently Completed

| Task | Date | Summary |
|------|------|---------|
| Withings GPS late-delivery fix | 2026-03-14 | Recurring bug (GPS arrives 30-60min after upload; first sync stale). Fix: guaranteed 48h re-fetch in run_full_sync, 'ride' added to backfill IS NULL check, per-workout Railway logging, force-refresh endpoint POST /api/withings/refresh-workout/{external_id}. Root causes + rationale in DECISIONS.md D007. commit: 6e11b28 |
| Run/ride stat block standardisation | 2026-03-13 | ActivityFeed cards now show dist+pace inline. ActivityDetailSheet + DayDetailSheet both use horizontal bordered stat blocks for run/ride (dist+pace row, time+bpm row). Backend feed endpoint exposes distance_km + avg_pace_secs. commits: ad1d613, 6d9f4ce |
| T18 BW volume fix + session header | 2026-03-13 | Backend SQL fixed (bodyweight_at_session in session_volume_kg). New last-by-split endpoint. Frontend: correct bw/bw+ volume formula, dual reps+vol badges, session comparison header, whole-kg rounding. commits: 5838fd9, 7e1d89c |
| StrengthCard last/now tally | 2026-03-11 | Exercise cards show Last: sets·reps·vol·date + live Now: tally + % diff badge (gold/red, ≥0.5% threshold). BW+ extra kg included in volume. commit: 7227eb4 |
| T15 Trends Redesign | 2026-03-10 | EnergyBalanceChart (intake/burn bars + weight line, dual y-axis, protein-first summary row). StrengthQualityChart (scatter: duration vs avg_hr, bubble=sets, category colour). Both at top of TrendsPage; CorrelationSummary removed. Data quality fix: kJ→kcal CASE guard in energy-balance endpoint (daily_summary rows from CSV bulk import stored kJ). Commits: 29dbae4, 382fd68, f82dd9a |
| Withings timezone + HR detail sheet | 2026-03-10 | Bug 1: sync_workouts was using UTC .date() — morning Brisbane workouts landed on previous day. Fixed: .astimezone(BRISBANE_TZ).date(). Bug 2: on_conflict_do_nothing → on_conflict_do_update so re-syncs overwrite stale data. Bug 3: ActivityLog model missing started_at + min_hr columns — pg_insert upsert silently failed. Bug 4: sync_workouts used lastupdate=last_sync_at so Withings skipped already-sent workouts; fixed by capping lookback to 14 days. Feature: ActivityDetailSheet now shows start time + Avg/Low/High HR block (new started_at TIMESTAMPTZ + min_hr INTEGER columns). commits: 6bca5d0, 39ba1c0 |
| Sleep history sheet + date-stepper fixes | 2026-03-10 | Tap SleepCard → SleepHistorySheet bottom sheet (30 days, proportional stage bars: deep/light/awake, sleep score pill, slide-up animation). New useSleepHistory hook. Fixed: useGoalRings + useDashboardV2 now accept selectedDate so sleep ring, steps ring, mood/water/calorie/protein QuickStats all reflect the stepped date. commit: f71da24 |
| Sleep stages + Intraday HR | 2026-03-09 | Feature A: sleep_logs.stages JSONB + sync_sleep_stages (002 migration, SleepStagesResponse schema, GET /api/sleep/stages, useSleepStages hook, SleepStageBar + SleepCard components). Feature B: hr_intraday table (003 migration), sync_intraday_hr (getintradayactivity → hourly buckets, Brisbane UTC+10), GET /api/hr/intraday, useIntradayHR hook, IntradayHRChart (dawn→clay→ochre color scale). Scheduled syncs at 5:30am + 8:00am. main.py: ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS stages JSONB. Deployed 4f73c9d. |
| Strength session bugs | 2026-03-09 | Fix 1: ActivityDetailSheet was matching manual_strength_logs.id against strength_sessions.id (diff tables). Now uses bridged_session_id. Fix 2: loadLastSession now calls setStartDate(today()) — prevents stale draft date overwriting original linked session. commit: 4f81b93 |
| Activity sheet portal fix | 2026-03-09 | createPortal to body for ActivityDetailSheet + StrengthCard overlay — fixes position:fixed inside scroll container. commit: 9e0976a |
| Goal rings icons + size | 2026-03-09 | +30% ring size (70→91px), icons inside rings: moon/slash/fork/bolt from original design. commit: 46eba65 |
| Tab bar tap targets v2 | 2026-03-09 | Full 64px height buttons (explicit, not %), alignItems:flex-start, touchAction:manipulation. commit: 5bd5856 |
| Tab bar tap targets | 2026-03-09 | Expanded hit area to full column width (flex:1) + full bar height. commit: 6bee1ac |
| Activity card detail sheet | 2026-03-09 | Tap any activity card → bottom sheet with full detail. Workout+linked session: exercise grid (split, body areas, sets×reps, top weight, totals). Effort picker, unlink/re-log/link actions. commit: 429dfe1 |
| Activity Feed orphans | 2026-03-09 | Unlinked strength sessions now appear as first-class feed cards (rust border + Link2Off pill). Expand to Delete or Link-to-workout. Fetch window 14→30 days. commit: a4362e3 |
| DayDetailSheet | 2026-03-08 | Full rewrite: strength session cards (expand/collapse, exercise grid, split/body areas), sauna always-open, run/walk/other dot cards. Fixed: exMap lookup key mismatch (full name vs parsed name), client-side date filter (API params unreliable), session dedup by exercises.length > 0. Latest: 9091845 |
| Goal Rings | 2026-03-08 | 4 SVG progress rings (sleep, steps, protein, recovery) with Apple Watch overflow; new useGoalRings hook + GoalRingsRow component; protein_g added to TodayStats |
| T14 1a+1c | 2026-03-08 | Strength session: localStorage draft persistence + resume banner (1a); previous session affordance in ExerciseCard (1c) |
| Water bugs | 2026-03-07 | Fix POST /log/water + /log/mood 500 (asyncpg NULL→timestamptz cast); fix UTC day-boundary bucketing (Brisbane UTC+10) in WaterCard/Dashboard/WaterNutritionChart; add WaterTrendsChart to Trends (daily bars, 3L target line, green/ochre) |
| T13 | 2026-03-07 | Food logging gaps: remove stale NutritionCard, fix × opacity, protein trends chart (weekly bars, 180g target line, green/ochre colouring) |
| Bugs | 2026-03-07 | Fix strength sheet overlay hidden behind TabBar (z-index 91→111); fix Trends exercise filter (backend categories chest/back/arms/shoulders → push/pull, not name-match) |
| T12 | 2026-03-07 | Strength session bridge: save→normalised tables, DELETE, UNLINK, 6-category exercise inference, backfill 7 prod sessions |
| T10 | 2026-03-07 | Water + Mood/Energy + Nutrition log cards; Dashboard revamp with QuickStatsRow + 3 trend charts |
| T11 | 2026-03-07 | Strength Trends frontend — WorkoutVolumeChart + ExerciseProgressSection on Trends page |
| T09 | 2026-03-06 | Manual Withings sync button (Calendar + Dashboard) |
| T08 | 2026-03-06 | Habits history view |
| T07 | 2026-03-06 | Strength → Workout linking in ActivityFeed |
| T06 | 2026-03-06 | Calendar defaults to strength; activity feed polish |

Full history: `tasks/done/` + `CHANGELOG.md`

---

## Backlog (top priority first)

1. **Sleep dashboard** — stage bars, consistency %, debt tracker (ref: `archive/gavhealth[original-design].html`)
2. Visual polish pass — card textures, micro-animations, Strava-style tabs
3. PWA manifest — `manifest.json` + service worker (install as home screen app)
4. Withings OAuth completion — user action required; sync currently pulls no new data

Full list with notes: `tasks/backlog.md`

---

## Quick Ref

| | |
|--|--|
| Frontend | `gavhealth.vercel.app` (Vercel) |
| Backend | `gavhealth-production.up.railway.app` (Railway FastAPI) |
| Git | `github.com/gavan-stil/gavhealth` (branch: main) |
| API auth | `X-API-Key` header — value in `.env` as `VITE_API_KEY` |
| Gate password | `VITE_GATE_PASSWORD` env var |

**All API calls:** `apiFetch` from `src/lib/api.ts` — never raw `fetch`

**Design tokens:** `src/styles/tokens.css` — always use `--var` names, never raw values

---

## Key Docs

| File | Purpose |
|------|---------|
| `reference/architecture.md` | Component tree, data patterns, build/deploy |
| `reference/api.md` | All verified API endpoints (curl-tested 2026-03-06) |
| `reference/withings-data.md` | Withings field map, DB gaps, backend tasks for T11 |
| `reference/brand.md` | Design tokens v1.2: colors, typography, motion, spacing |
| `reference/stack.md` | Tech stack, deployment credentials |
| `features.md` | Flat inventory of all live features per route (source of truth) |
| `DECISIONS.md` | Architectural decisions with rationale (D001–D007) |
| `tasks/README.md` | Task execution protocol |
| `SESSION.md` | Per-session scratchpad — overwrite each session, delete when done |
