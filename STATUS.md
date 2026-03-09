# GOE Health — Status

> Single startup file. Read this first every session. Update when tasks start/finish.

---

## Phase

**Phase 1 MVP complete ✅** — deployed at [gavhealth.vercel.app](https://gavhealth.vercel.app)

All 9 tasks shipped. App is live, logging flows work end-to-end.

---

## Active Task

**T14 Sprint** — 1.1-sessions ✅ done. Remaining: 1.7🔒, 1.8, 1.2, 2.
Quick Wins: all done. Medium items done: 1a✅ 1b✅ 1c✅ 1d✅ 1e✅ 1f✅ 1g✅ 1h✅ 1.3✅ 1.4✅ 2.1✅ 4✅ 1.1-filter✅ 3✅ goal-rings✅ day-detail-sheet✅ 1.1-sessions✅.
Blocked: 1.7🔒.
Full task list: `tasks/T14-sprint.md`

---

---

## Recently Completed

| Task | Date | Summary |
|------|------|---------|
| Sleep stages + Intraday HR | 2026-03-09 | Feature A: sleep_logs.stages JSONB + sync_sleep_stages (002 migration, SleepStagesResponse schema, GET /api/sleep/stages, useSleepStages hook, SleepStageBar + SleepCard components). Feature B: hr_intraday table (003 migration), sync_intraday_hr (getintradayactivity → hourly buckets, Brisbane UTC+10), GET /api/hr/intraday, useIntradayHR hook, IntradayHRChart (dawn→clay→ochre color scale). Scheduled syncs at 5:30am + 8:00am. |
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
| `specs/{dashboard,calendar,log,trends}.md` | Feature specs per route |
| `DECISIONS.md` | Architectural decisions with rationale (D001–D006) |
| `tasks/README.md` | Task execution protocol |
| `SESSION.md` | Per-session scratchpad — overwrite each session, delete when done |
