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

## Recently Completed

| Task | Date | Summary |
|------|------|---------|
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

1. Sleep dashboard — stage bars, consistency %, debt tracker (ref: `archive/gavhealth[original-design].html`)
3. Goal rings — 4 SVG rings (Sleep, Activity, Nutrition, Recovery) as dashboard hero
4. Visual polish pass — card textures, micro-animations, Strava-style tabs
5. PWA manifest — `manifest.json` + service worker (install as home screen app)
6. Withings OAuth completion — user action required; sync currently pulls no new data

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
