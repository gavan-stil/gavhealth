# HANDOFF: Write Remaining Task Files (03–09)

**Priority:** This MUST be completed before any code work begins.
**Estimated effort:** Single Cowork session, ~7 files to write.

---

## WHAT HAPPENED

The goe-health documentation scaffold is 80% complete. All spec files, reference files, decisions, changelog, README, and the task management protocol are done. Task files 01 and 02 are written. **Task files 03 through 09 still need to be written.**

Previous sessions kept running out of context or looping on file reads. This handoff exists to break that cycle.

---

## WHAT YOU NEED TO DO

Write 7 self-contained task files in `tasks/active/`. Each file must contain ALL context inline — no cross-file references during execution. Follow the exact format of `tasks/active/01-scaffold.md` and `tasks/active/02-dashboard-layout.md` (read one of them first as your template).

### Template structure (from tasks/README.md):

```
# Task [NN]: [Name]
Status: not-started | active | done
Depends on: [previous task]
Route: [route or "none"]

## Scope Gate
DOES: [bullet list]
DOES NOT: [bullet list]

## Pre-flight
- [ ] [prerequisite checks]

## Design Tokens (inline)
[paste ALL relevant tokens — colors, typography, spacing]

## API Endpoints (inline)
[paste ALL endpoints this task uses, with response shapes]

## Component Specs
[detailed component descriptions]

## Mock Data (if applicable)
[inline TypeScript mock objects]

## File Structure
[exact files to create/modify]

## Done When
- [ ] [checklist items]

## If Blocked
[fallback instructions]

## After Completion
[what to update — README status, CHANGELOG entry]
```

---

## THE 7 FILES TO WRITE

### tasks/active/03-dashboard-live.md
**Purpose:** Replace mock data with live API calls on Dashboard route.
**Scope:** Wire `/api/readiness`, `/api/summary/daily`, `/api/streaks` → existing Dashboard components. Add loading skeleton + error states.
**Key detail:** Use the `apiFetch<T>()` helper from `src/lib/api.ts` (created in task 01). Loading state = pulsing card placeholders. Error state = inline retry message.
**Endpoints needed inline:**
- GET `/api/readiness` → `{ score, breakdown: { sleep_score, rhr_score, activity_balance, recovery_score }, narrative }`
- GET `/api/summary/daily` → `{ date, weight_kg, sleep: { duration_hrs, deep_pct }, rhr_bpm, activities: [{ type, name, distance_km?, sets?, date }] }`
- GET `/api/streaks` → `{ running_streak, strength_streak, sauna_streak, habits_streak }`
**All 3 require header:** `X-API-Key: gavhealth-prod-api-2026-xK9mP3`

### tasks/active/04-calendar-logic.md
**Purpose:** Calendar data layer — fetch 90 days of data, build dot-matrix map.
**Scope:** Create `useCalendarData` hook. Fetch activities, sleep, sauna, weight, strength for 90-day window. Map each day → array of colored category dots.
**Category → Color mapping (from brand guide):**
- Weight: `#e8c47a` (gold)
- Sleep: `#7FAABC` (dawn) — exclusively for sleep
- Heart/RHR: `#c4856a` (clay)
- Running: `#b8a878` (sand)
- Strength: `#b47050` (rust)
- Sauna: `#c45a4a` (ember)
- Body/DEXA: `#d4a890` (blush)
**Endpoints:** `/api/data/activities?days=90`, `/api/data/sleep?days=90`, `/api/data/sauna?days=90`, `/api/data/weight?days=90`, `/api/data/rhr?days=90`
**Output:** `Record<string, CategoryDot[]>` where key is `YYYY-MM-DD` and `CategoryDot = { category: string, color: string }`

### tasks/active/05-calendar-ui.md
**Purpose:** Calendar month grid + day detail bottom sheet + filter toggles.
**Scope:** Month view (7 cols Mon–Sun), swipe/arrow month navigation, colored dots in day cells, tappable days → bottom sheet with day's data, category filter toggles at top.
**Key detail:** Mobile-first. Month grid must fit 375px width. Day cells ~48px. Bottom sheet slides up from bottom, shows that day's activities/sleep/weight etc. Filter toggles are pill-shaped, colored by category.
**Depends on:** Task 04 (useCalendarData hook).
**Design tokens needed:** All spacing, radius, category colors, typography for labels and values.

### tasks/active/06-log-flow.md
**Purpose:** Log route UI — all 4 logging cards with their UI states.
**Scope:** Create `/log` route with 4 collapsible cards: Food (NLP text input), Strength (NLP text input), Sauna (direct form: duration + temp), Habits (checkbox grid). Each card has states: empty → parsing → parsed → confirmed → error.
**Key detail:** This is UI ONLY — no API wiring. Use mock responses for the parsed state. The 2-step NLP flow means: user types free text → "parsing" spinner → show parsed result for confirmation → user confirms.
**Mock parsed food:** `{ items: [{ name: "Chicken breast", calories: 280, protein_g: 52 }], total_calories: 280 }`
**Mock parsed strength:** `{ exercise: "Bench Press", sets: [{ weight_kg: 80, reps: 8 }, { weight_kg: 85, reps: 6 }] }`

### tasks/active/07-log-api.md
**Purpose:** Wire Log route to live POST endpoints.
**Scope:** Connect all 4 log cards to their respective API endpoints. Handle the 2-step NLP confirm flow for food and strength.
**Endpoints:**
- POST `/api/log/food` body: `{ text: string }` → returns parsed items for confirmation
- POST `/api/log/food/confirm` body: `{ items: [...], date: string }` → saves
- POST `/api/log/strength` body: `{ text: string }` → returns parsed exercise/sets
- POST `/api/log/strength/confirm` body: `{ exercise_id, sets: [...], date }` → saves
- POST `/api/log/sauna` body: `{ duration_minutes, temperature_c, date }` → saves
- POST `/api/log/habits` body: `{ date, habits: { stretching: bool, meditation: bool, cold_shower: bool, supplements: bool } }` → saves
**Key detail:** Food and strength use Claude Haiku 4.5 on the backend for NLP parsing. Response times may be 2-3 seconds — show parsing animation.

### tasks/active/08-trends-view.md
**Purpose:** Trends route — recovery vs performance correlation visualization.
**Scope:** Time Range Selector (7d/30d/90d pill toggle), Recovery Overview section (5 sparklines: sleep duration, deep sleep %, RHR, sauna frequency, nutrition consistency), Performance Overlay section (~200px chart showing run distance + strength frequency overlaid on recovery composite). Client-side Pearson correlation on 7-day rolling averages.
**THIS IS THE CORE VALUE PROPOSITION.** The user's primary interest is seeing how recovery signals (sleep, RHR, sauna, nutrition) correlate with performance outputs (run intensity, weightlifting frequency).
**Endpoints:** `/api/data/sleep?days=N`, `/api/data/rhr?days=N`, `/api/data/sauna?days=N`, `/api/data/food/weekly`, `/api/data/activities?days=N&type=run`, `/api/data/activities?days=N&type=strength`
**Chart library:** Recharts. Use brand tokens for all chart styling.
**Recharts tokens (from brand guide):**
```
cartesianGrid.stroke: #222018, strokeDasharray: "2 4", strokeOpacity: 0.6
axis tick fill: #9a9080, fontSize: 10, fontFamily: Inter
axis line stroke: #222018
tooltip: bg #1e1d18, border 1px #222018, text #f0ece4, radius 10px
line strokeWidth: 2, dot: false, activeDot r:4
area fillOpacity: 0.08
```

### tasks/active/09-integration.md
**Purpose:** Cross-route integration, polish, deploy.
**Scope:** Auth gate (password: `goe2026`), route transitions, pull-to-refresh on Dashboard, global error boundary, Vercel deployment, smoke test all routes.
**Deployment method:** Fresh clone to `/tmp/gavhealth-push`, copy built files, push with PAT. Never use git inside `/mnt/`.
**Git credentials:**
- Repo: `https://github.com/gavan-stil/gavhealth.git`
- PAT: `[REDACTED]`
- User: `Gavan Stilgoe <gavan@r6digital.com.au>`
- Vercel project: `prj_fxgUwqBpIWrKNTBGbtvOYJeBy7mq`, team: `team_Gwse87RecVqLNTuaAmnpXG8M`
**Done when:** All 4 routes work on mobile, auth gate blocks unauthenticated access, deployed to gavhealth.vercel.app.

---

## FULL DESIGN TOKENS (paste into every task file)

```css
:root {
  --bg-base: #0d0d0a; --bg-card: #14130f; --bg-card-hover: #1c1b15; --bg-elevated: #1e1d18;
  --border-default: #222018; --border-subtle: #1a1914;
  --text-primary: #f0ece4; --text-secondary: #b0a890; --text-tertiary: #9a9080; --text-muted: #7a7060;
  --ochre: #d4a04a; --ochre-light: #e8c47a; --ochre-dim: #a07830;
  --sand: #b8a878; --clay: #c4856a; --rust: #b47050; --gold: #e8c47a;
  --dawn: #7FAABC; --blush: #d4a890; --ember: #c45a4a;
  --signal-good: #e8c47a; --signal-caution: #d4a04a; --signal-poor: #c47a6a;
  --space-xs: 4px; --space-sm: 8px; --space-md: 14px; --space-lg: 20px; --space-xl: 32px; --space-2xl: 48px;
  --radius-sm: 8px; --radius-md: 14px; --radius-lg: 20px; --radius-pill: 100px;
  --ease-settle: cubic-bezier(0.16, 1, 0.3, 1); --ease-drift: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --duration-fast: 120ms; --duration-normal: 200ms; --duration-slow: 400ms;
}
```

**Typography:**
```
.hero-value   { font: 800 52px/1 'JetBrains Mono', monospace; letter-spacing: -3px; }
.card-value   { font: 800 40px/1 'JetBrains Mono', monospace; letter-spacing: -2px; }
.stat-number  { font: 800 28px/1 'JetBrains Mono', monospace; letter-spacing: -1.5px; }
.small-number { font: 600 14px/1 'JetBrains Mono', monospace; letter-spacing: -0.5px; }
.page-title   { font: 800 24px/1.2 'Inter', sans-serif; letter-spacing: -1px; }
.section-head { font: 700 16px/1.2 'Inter', sans-serif; letter-spacing: -0.5px; }
.body-text    { font: 400 14px/1.5 'Inter', sans-serif; }
.label-text   { font: 600 10px/1 'Inter', sans-serif; letter-spacing: 1.2px; text-transform: uppercase; }
```

**Category colors:**
```
Weight:   var(--gold)  #e8c47a
Sleep:    var(--dawn)  #7FAABC  (exclusive)
Heart:    var(--clay)  #c4856a
Running:  var(--sand)  #b8a878
Strength: var(--rust)  #b47050
Sauna:    var(--ember) #c45a4a
Body:     var(--blush) #d4a890
```

---

## API BASE + AUTH

```
Base URL: https://gavhealth-production.up.railway.app
API Key header: X-API-Key: gavhealth-prod-api-2026-xK9mP3
Auth gate password: goe2026
```

---

## INSTRUCTIONS FOR NEXT COWORK

1. Read `tasks/active/02-dashboard-layout.md` — use it as your format template
2. Read THIS file for all the content/context for each task
3. Write all 7 files directly — DO NOT re-read reference/ files or specs/
4. Each file must be fully self-contained (all tokens, endpoints, mock data inline)
5. After writing all 7, update `tasks/README.md` status and add CHANGELOG entry
6. Then create `archive/previous-project.md` (brief: 31-session GavHealth project became monolith, lessons learned → self-contained task approach)
7. Verify: every task file has scope gate, pre-flight, inline tokens, inline endpoints, component specs, done-when checklist

**DO NOT LOOP ON FILE READS. Write from this handoff doc. Everything you need is here.**
