# GOE Health — Status

> Single startup file. Read this first every session. Update when tasks start/finish.

---

## Phase

**Phase 1 MVP complete ✅** — deployed at [gavhealth.vercel.app](https://gavhealth.vercel.app)

All 9 tasks shipped. App is live, logging flows work end-to-end.

---

## Active Task

**T10 — Water, Mood/Energy, Nutrition + Dashboard Revamp** (`tasks/active/10-water-mood-nutrition-dashboard.md`)

Adding 4 new log tracking features (water, mood, energy, nutrition summary) and revamping the dashboard with trend charts.

---

## Recently Completed

| Task | Date | Summary |
|------|------|---------|
| T09 | 2026-03-06 | Manual Withings sync button (Calendar + Dashboard) |
| T08 | 2026-03-06 | Habits history view |
| T07 | 2026-03-06 | Strength → Workout linking in ActivityFeed |
| T06 | 2026-03-06 | Calendar defaults to strength; activity feed polish |
| T05 | 2026-03-06 | Favicon, 404 redirect, CardEmpty, chart scroll |

Full history: `tasks/done/` + `CHANGELOG.md`

---

## Backlog (top priority first)

1. Sleep dashboard — stage bars, consistency %, debt tracker (ref: `archive/gavhealth[original-design].html`)
2. Goal rings — 4 SVG rings (Sleep, Activity, Nutrition, Recovery) as dashboard hero
3. Visual polish pass — card textures, micro-animations, Strava-style tabs
4. PWA manifest — `manifest.json` + service worker (install as home screen app)
5. Withings OAuth completion — user action required; sync currently pulls no new data

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
| `reference/brand.md` | Design tokens v1.2: colors, typography, motion, spacing |
| `reference/stack.md` | Tech stack, deployment credentials |
| `specs/{dashboard,calendar,log,trends}.md` | Feature specs per route |
| `DECISIONS.md` | Architectural decisions with rationale (D001–D006) |
| `tasks/README.md` | Task execution protocol |
