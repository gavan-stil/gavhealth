# GOE Health — Live Site Review & MVP Next Steps

> **Created:** 2026-03-06 | **Plan ID:** mvp-v1
> **Task status:** See `specs/plan-log.md`

## 1. What's Rendering on the Live Site

> WebFetch can't render the SPA (returns only "GOE Health" — JS-dependent). Analysis below is inferred from source code + deployed build artifacts.

**Auth Gate** — Full-screen password prompt ("GOE" logo + "Health" subtitle + password input + Enter button). Password: `<see .env>`, stored in sessionStorage.

**Dashboard (`/`)** — Pull-to-refresh container with 3 cards:
- **ReadinessCard** — AI readiness score (0-100) with breakdown + narrative from `/api/readiness/today`
- **VitalsCard** — Daily summary (weight, sleep, RHR, activity) from `/api/daily-summary/today`
- **StreaksCard** — Running, strength, sauna, habits streaks from `/api/streaks`
- Each card has loading skeleton + error state + retry

**Calendar (`/calendar`)** — Full implementation:
- MonthHeader with prev/next navigation
- ToggleBar (category filters: activity, sleep, sauna, weight, rhr)
- SubToggleBar (when single category selected)
- MonthGrid (8-col: 7 days + summary column)
- DayDetailSheet (bottom sheet on day tap)
- StatsSection + PatternsSection (toggleable)

**Log (`/log`)** — Two tabs:
- **Log tab** — Accordion cards for Food, Strength, Sauna, Habits logging
- **Activity tab** — Activity feed

**Trends (`/trends`)** — Time range selector (7/30/90 days) with 3 sections:
- RecoverySparklines (sleep, RHR, sauna, nutrition, runs, strength)
- PerformanceOverlay (composite chart)
- CorrelationSummary

**Layout** — Bottom tab bar (4 icons), top header area.

---

## 2. HTML Mockup vs Live: Feature Differences

**Original mockup** (`archive/gavhealth[original-design].html`, 7,322 lines) is a massive single-page design with:
- Desktop sidebar navigation + mobile hamburger menu
- 4 SVG goal rings (Sleep, Activity, Nutrition, Recovery)
- Weekly summary strip (5-column grid)
- Full sleep dashboard (calendar heatmap, stage bars, consistency, debt tracker, nap log, score trend, environment tips, hygiene score ring, bedtime insight)
- Weight goal progress with target tracking
- Period selector (1W/1M/3M/1Y/All)
- Detailed metric cards with sparklines
- Tab selectors (Strava-style underline tabs)
- Card texture overlays (particle field SVGs)
- Grid layouts (2/3/4 column responsive)
- Sleep-specific layout (sidebar + content)

**Calendar mockup** (`archive/calendar-mockup.html`, 870 lines):
- 8-column grid with mock data generator
- Category + sub-category toggles
- Duration annotations

**Live React app** has: basic dashboard (3 cards), calendar (well-built), log (accordion + feed), trends (sparklines + overlay + correlation). Missing the extensive sleep analysis, goal rings, and visual polish from the original design.

---

## 3. Gaps: Live vs Original Design (3 lines each)

### Goal Rings
Original has 4 SVG progress rings (Sleep, Activity, Nutrition, Recovery) as the dashboard hero.
Live has no goal visualization — just readiness score number + vitals list.
Impact: Missing the primary visual motivator and daily progress indicator.

### Sleep Dashboard
Original has dedicated sleep section: heatmap calendar, stage breakdown bars, consistency %, debt tracker, nap log, score trend, hygiene ring, bedtime insight.
Live shows sleep as one line item in VitalsCard (duration only).
Impact: Sleep is the app's deepest data source — barely surfaced.

### Weight Goal Progress
Original has weight tracking with target line, progress bar, and trend direction.
Live includes weight in VitalsCard but no goal or target visualization.
Impact: No way to track progress toward a body composition target.

### Weekly Summary Strip
Original has 5-column grid summarizing the week at a glance (M-F colored blocks).
Live has no weekly overview — dashboard shows today only.
Impact: No context for how today fits into the week's pattern.

### Visual Polish & Texture
Original has particle-field SVG overlays, gradient card backgrounds, micro-animations.
Live uses flat cards with basic border styling.
Impact: Feels like a prototype vs. the rich, branded design.

### Desktop Layout
Original has responsive sidebar nav, multi-column grids, desktop-optimized spacing.
Live is mobile-only (375px, bottom tab bar, no desktop breakpoints).
Impact: Unusable on desktop — no responsive layout above mobile.

### Period Selector
Original has 1W/1M/3M/1Y/All period buttons across multiple views.
Live Trends page has 7/30/90 day selector only.
Impact: Can't view year-long trends or custom ranges.

### Strava-style Tabs
Original has underline-animated tab selectors with ochre active state.
Live Log page has basic background-toggle tabs.
Impact: Minor visual inconsistency with design language.

---

## 4. Errors & Broken Things

### API Path Mismatch (HIGH RISK)
- `useDashboard.ts` calls `/api/readiness/today` — api.md documents `/api/readiness`
- `useDashboard.ts` calls `/api/daily-summary/today` — api.md documents `/api/summary/daily`
- If these paths don't exist on the backend, Dashboard shows error cards for all 3 sections
- **Note:** Hooks contain comment "verified against live endpoints" + api.md warns "paths may differ" — actual status unknown without live testing

### Data endpoint paths
- Calendar/Trends hooks use `/api/sleep`, `/api/rhr`, `/api/weight`, `/api/activity`, `/api/sauna`
- api.md documents `/api/data/sleep`, `/api/data/rhr`, `/api/data/weight`, etc.
- Same caveat: hooks say verified, docs say verify with curl

### No offline/empty state
- If API is down or slow, users see error cards with "Tap to retry" but no cached data
- No onboarding flow for first-time users seeing empty data

### Hardcoded auth password
- Password `goe2026` is in plain text in `AuthGate.tsx` and ships in the JS bundle
- Anyone can view-source the deployed JS to extract it

### No 404 route
- Unknown routes render blank inside Layout (no redirect to `/` or 404 page)

### Missing favicon
- Uses default Vite SVG favicon (`/vite.svg`), not GOE branded

### No PWA manifest
- No `manifest.json`, no service worker — can't install as home screen app on mobile

---

## 5. MVP Answers (from user)

- **Usage:** Daily on phone — opens every morning, logs throughout the day
- **Top priority:** Logging flows — make food/strength NLP logging work end-to-end
- **API verify:** Yes, curl-test all API paths before building anything new
- **Platform:** Mobile only (375px). Charts: show readable data on screen, horizontal scroll for overflow

## Session Tasks (numbered, self-contained)

Each task is designed to complete in one session without hitting context limits.

---

### Task 1: Security Hardening + API Verification
**What:** Lock down secrets and verify all API paths work.
**Do:**
1. Create `.gitignore` (`.env`, `.env.local`, `node_modules`, `dist`, `.DS_Store`)
2. `git rm --cached .env` to stop tracking the env file
3. In `AuthGate.tsx`: replace hardcoded `'goe2026'` with `import.meta.env.VITE_GATE_PASSWORD`
4. In `reference/api.md`: replace real API key with `<your-api-key>`
5. Create `.env.example` with placeholder values
6. Curl-test every GET endpoint used by hooks — record results
7. Fix any mismatched API paths in hooks
8. Create `specs/session-handoff.md` with verified API paths + architecture snapshot
9. Commit all changes

**Done when:**
- `.env` is not tracked by git
- No secrets in source files (grep confirms)
- All hook API paths curl-tested and documented
- `npm run build` passes
- User has been reminded to: make repo private + rotate API key + set Vercel env vars

**Files:** `.gitignore` (new), `.env.example` (new), `src/components/AuthGate.tsx`, `reference/api.md`, `specs/session-handoff.md` (new), `src/hooks/useDashboard.ts`, `src/hooks/useCalendarData.ts`, `src/hooks/useTrendsData.ts`

---

### Task 2: Food NLP Logging Flow
**What:** Build the end-to-end food logging experience in the Log tab.
**Do:**
1. Read `src/components/log/LogCards.tsx` to understand current accordion structure
2. Create `src/components/log/FoodLogForm.tsx` — text input + "Parse" button
3. Create `src/components/log/FoodReviewCard.tsx` — shows parsed macros (protein/carbs/fat/cals) + "Confirm" / "Edit" / "Cancel"
4. Wire parse step: `POST /api/log/food` with `{ description: "..." }` → show FoodReviewCard
5. Wire confirm step: `POST /api/log/food/confirm` with confirmed data → success toast
6. Add loading/error states for both steps
7. Integrate into LogCards accordion (Food section expands to FoodLogForm)

**Done when:**
- User types "2 eggs scrambled with cheese" → sees parsed macros → taps Confirm → success feedback
- Error states work (API down, parse failure)
- `npm run build` passes

**Files:** `src/components/log/FoodLogForm.tsx` (new), `src/components/log/FoodReviewCard.tsx` (new), `src/components/log/LogCards.tsx`

---

### Task 3: Strength NLP Logging Flow
**What:** Build the end-to-end strength logging experience in the Log tab.
**Do:**
1. Create `src/components/log/StrengthLogForm.tsx` — text input + "Parse" button
2. Create `src/components/log/StrengthReviewCard.tsx` — shows parsed exercises/sets/reps/weight + "Confirm" / "Cancel"
3. Wire parse: `POST /api/log/strength` with `{ description: "..." }` → show StrengthReviewCard
4. Wire confirm: `POST /api/log/strength/confirm` → success toast
5. Add loading/error states
6. Integrate into LogCards accordion (Strength section)

**Done when:**
- User types "squat 100kg 3x5" → sees parsed sets → taps Confirm → success
- `npm run build` passes

**Files:** `src/components/log/StrengthLogForm.tsx` (new), `src/components/log/StrengthReviewCard.tsx` (new), `src/components/log/LogCards.tsx`

---

### Task 4: Sauna + Habits Logging
**What:** Build sauna direct log and habits toggle in the Log tab.
**Do:**
1. Curl-test `POST /api/log/sauna` to confirm shape (likely `{ duration_mins, temperature_c? }`)
2. Create `src/components/log/SaunaLogForm.tsx` — duration input + optional temp + "Log" button
3. Wire to `POST /api/log/sauna` → success toast
4. Check if habits endpoint exists (curl `/api/log/habits` or similar)
5. If habits endpoint exists: create `src/components/log/HabitsForm.tsx` with toggle checkboxes
6. If no habits endpoint: show "Coming soon" placeholder in habits accordion section
7. Integrate both into LogCards accordion

**Done when:**
- Sauna: user enters 15 mins → taps Log → success
- Habits: either functional toggles or "Coming soon" placeholder
- `npm run build` passes

**Files:** `src/components/log/SaunaLogForm.tsx` (new), `src/components/log/HabitsForm.tsx` (new, maybe), `src/components/log/LogCards.tsx`

---

### Task 5: Quick Fixes + Session Handoff Update
**What:** Polish pass — favicon, 404, empty states, chart scroll. Update handoff doc.
**Do:**
1. Replace Vite favicon with GOE-branded SVG (ochre "G" or similar simple mark)
2. Add catch-all route in `App.tsx` — redirect unknown paths to `/`
3. Add empty state component for dashboard cards when data is null (not error, just empty)
4. Add horizontal scroll wrapper for trends sparklines (overflow-x: auto, snap points)
5. Update `specs/session-handoff.md` with everything built in Tasks 1-5
6. Update component inventory, known issues, build log

**Done when:**
- Browser tab shows GOE favicon
- `/nonsense` redirects to `/`
- Dashboard with no data shows friendly empty state (not blank)
- Trends sparklines scroll horizontally on narrow screens
- `specs/session-handoff.md` is complete and current
- `npm run build` passes

**Files:** `public/favicon.svg` (new), `src/App.tsx`, `src/components/dashboard/CardEmpty.tsx` (new), `src/components/trends/RecoverySparklines.tsx`, `specs/session-handoff.md`

---

### Future Tasks (not yet detailed — next session)
6. Sleep dashboard deep-dive
7. Goal rings / daily hero visualization
8. Visual polish pass (card textures, micro-animations)

---

## Execution Rules for All Tasks
- Always read `specs/session-handoff.md` first (once it exists after Task 1)
- Curl-verify any new API paths before wiring
- Update handoff doc at end of each session
- Use existing `apiFetch` from `src/lib/api.ts` for all API calls
- Follow existing patterns in `src/styles/tokens.css` for spacing/colors
- Mobile-first (375px), charts with horizontal scroll for overflow
- `npm run build` must pass before considering a task done
