# Changelog

All feature and spec changes, dated. AI updates this file when specs change.

---

## 2026-03-06 — Task 09 complete: Integration, Polish & Deploy

- AuthGate component — full-screen password gate (env var `VITE_GATE_PASSWORD`), sessionStorage persistence, shake animation on wrong password
- ErrorBoundary component — React class component, catches render crashes, centered card with AlertTriangle and Reload button
- Route transitions — CSS keyframe fade + translateY(8px) animation on route changes via location key
- Pull-to-refresh on Dashboard — touch event listeners, 60px threshold, Loader2 spinner, re-fetches all 3 endpoints
- App.tsx wired: ErrorBoundary → AuthGate → BrowserRouter → Layout → AnimatedRoutes
- Deployed to Vercel: gavhealth.vercel.app — pre-built static files pushed to GitHub, SPA routing via vercel.json rewrites
- All 4 routes return 200, assets load correctly
- TypeScript compiles clean, zero build errors
- **Phase 1 MVP complete** 🎉

---

## 2026-03-04 — Task 05 complete: Calendar UI

- Built 8 components: MonthHeader, ToggleBar, SubToggleBar, MonthGrid, DayDetailSheet, StatsSection, PatternsSection, CalendarPage
- MonthGrid: 8-column layout (7 days + weekly summary), Mon-start weeks, today highlighting
- Category dots with toggleable duration text; single-category mode shows sub-metrics inline
- ToggleBar: category filter pills + meta toggles (Dur, Stats, Patterns)
- SubToggleBar: conditional bar for single-category sub-metric selection
- DayDetailSheet: slide-up bottom sheet with category sections, durations, sub-metrics
- StatsSection: per-category day counts for current month
- PatternsSection: 2×2 grid — Active Days %, Best Streak, Rest Days, Total Time
- Extended `CategoryDot` type with `duration` and `subMetrics` fields
- Rewrote `useCalendarData` hook (231 lines) — populates duration + sub-metrics from all 5 endpoints
- Added `SUB_TOGGLE_DEFS`, `CATEGORY_COLORS`, `CATEGORY_ORDER`, `CATEGORY_LABELS` shared constants
- All state managed at CalendarPage level, passed down via props
- TypeScript compiles clean, build passes

---

## 2026-03-04 — Task 04 complete: Calendar data layer

- Created `useCalendarData` hook — fetches 5 endpoints in parallel (activities, sleep, sauna, weight, RHR) for 90-day window
- New `CategoryDot` and `CalendarData` types in `src/types/calendar.ts`
- Maps each day to ordered array of category dots with brand colors
- Partial endpoint failures handled gracefully — returns available data + error message
- Activities split into "running" vs "strength" based on `type` field
- Canonical dot ordering: weight → sleep → heart → running → strength → sauna
- TypeScript compiles clean, build passes

---

## 2026-03-04 — Task 03 complete: Dashboard live data

- Created useDashboard hook with generic useCardFetch pattern — 3 independent API calls
- Real API shapes differ from task spec; transform layer maps ApiReadiness/ApiDailySummary/ApiStreaks → card-facing types
- CardSkeleton component with 3 layout variants (readiness, vitals, streaks) and CSS pulse animation
- CardError component with AlertTriangle icon and ochre retry button
- ReadinessCard updated: signed component deltas (+/-) with green/red colour coding
- VitalsCard updated: flat fields (total_sleep_hrs, deep_sleep_pct) instead of nested sleep object
- StreaksCard updated: training/sauna/breathing/devotions categories with matching lucide icons
- DashboardPage wired to live data — each card independently loading/error/data
- RecentActivityCard dropped (no /api/activities/recent endpoint exists)
- Mock data file retained but unreferenced — no mock imports in active code
- TypeScript compiles clean with zero errors

---

## 2026-03-04 — Task 02 complete: Dashboard layout (static)

- ReadinessCard — hero score with signal-color thresholds, narrative clamped to 3 lines, 4 breakdown sub-scores
- VitalsCard — 2×2 grid: sleep, deep sleep %, RHR, weight with category-specific colours
- RecentActivityCard — activity list with coloured type dots, date formatting, distance/sets stats
- StreaksCard — 4 streak counters (run, lift, sauna, habits) with lucide icons
- DashboardPage updated from placeholder to full card stack
- All data sourced from inline mocks (src/mocks/dashboard.ts) — API wiring is Task 03
- Build passes clean: 239.50 kB JS, 1.95 kB CSS, zero TypeScript errors

---

## 2026-03-04 — Task 01 complete: Project scaffold

- Vite 7 + React 19 + TypeScript project initialised
- CSS custom properties design system (tokens.css) — no Tailwind
- Inter + JetBrains Mono fonts loaded via Google Fonts
- 4 routes with placeholder pages: Dashboard, Calendar, Log, Trends
- TabBar component with lucide-react icons, ochre active state
- Layout shell with fixed bottom nav
- apiFetch utility with X-API-Key auth header
- npm run build passes clean, dev server starts without errors
- API health endpoint confirmed: `{ status: "ok" }`

---

## 2026-03-04 — Task files 03–09 written

- Wrote remaining 7 self-contained task files from HANDOFF-write-task-files.md
- 03-dashboard-live.md — Wire dashboard to 3 live API endpoints
- 04-calendar-logic.md — useCalendarData hook, 5 parallel fetches, category dot mapping
- 05-calendar-ui.md — MonthGrid, CategoryFilters, DayDetailSheet components
- 06-log-flow.md — UI-only log route, 4 accordion cards, 5-state machine
- 07-log-api.md — Wire log cards to POST endpoints, 2-step NLP confirm flow
- 08-trends-view.md — Recovery vs performance correlation, Recharts overlays, Pearson r
- 09-integration.md — AuthGate, route transitions, pull-to-refresh, Vercel deploy
- All task files are now complete. Project ready for code execution starting at task 01.

---

## 2026-03-04 — Project initialised

- Created documentation structure for Goe Health rebuild
- Defined 4 routes for Phase 1: Dashboard, Calendar, Log, Trends
- Ported brand system, API reference, and stack details from GavHealth v1
- Created 9 Phase 1 task files
- Decision: Keep Railway backend as-is, rebuild frontend only
- Decision: Mobile-first, card stack layout, bottom tab bar
- Decision: Self-contained task files to prevent Cowork context loss
