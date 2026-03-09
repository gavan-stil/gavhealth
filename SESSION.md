# SESSION — 2026-03-09

## Last commit
`2766916` — feat(dashboard): date stepper for sleep + intraday HR

## What was done this session
1. **Bug fix** (`5621c66`): `useIntradayHR` was calling `/hr/intraday` (missing `/api` prefix) → 404. Fixed to `/api/hr/intraday`. Chart now renders correctly.
2. **Backend patch** (in `4f73c9d`): Added `ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS stages JSONB` to `main.py` lifespan startup (create_all won't add columns to existing tables).
3. **Date stepper for Dashboard** (`2766916`):
   - `useSleepStages` now accepts optional `dateStr?` param
   - `DashboardPage` has `selectedDate` state + `< Yesterday · Today >` chevron nav in header
   - Pull-to-refresh resets date to today
   - Both `useSleepStages(selectedDate)` + `useIntradayHR(selectedDate)` re-fetch on date change
   - Multi-day charts unaffected

## Current state
- Build: ✅ clean
- Deployed: ✅ (push to main → Vercel auto-deploy)

## Pending T14 items
- [ ] **1.7** — Water: delete individual entries `[B: needs DELETE /api/water/:id]`
- [ ] **1.8** — Food log: (a) FoodCard reset bug between days; (b) date nav; (c) "Load previous day" button
- [ ] **1.2** — Weights activity feed card: tap-to-expand detail (session length, date/time, avg HR, push/pull/legs/abs, icons, totals)
- [ ] **2** — Trends: exercise body-part mapping auto-categorisation
- [ ] **1.6** — Food photo: write cost spec for Claude Vision flow (no impl yet)
