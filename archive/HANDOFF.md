# GOE Health — Handoff Brief

> For any new Cowork session picking up this project for the first time. Read this file FIRST, then you can find the project structure in higher up folders inside "goe-health"
---

## Project Status

**Nothing has been built yet.** All 9 tasks remain in `tasks/active/` at "Not started" status. No code, no scaffold, no components.

There is an existing ~4,000 line HTML design file from a previous failed project (31 Cowork sessions that became unmanageable). That file has NOT been uploaded yet. When it arrives, use the extraction plan below.

---

## Files to Read on Startup

Read in this order — nothing else until these are done:

1. **This file** — `HANDOFF.md` (you're here)
2. **`reference/brand.md`** — GOE Brand System v1.2, all design tokens
3. **`reference/stack.md`** — Tech stack, deployment, env vars, git credentials
4. **`reference/api.md`** — Full API reference, 12 DB tables, ~4,189 seeded rows
5. **The current task file** — start with `tasks/active/01-scaffold.md`, then sequential

You do NOT need to read all 9 task files upfront. Each task is self-contained with its own tokens, endpoints, component specs, and done-when criteria. Read only the task you're currently executing.

The `specs/` folder (dashboard.md, calendar.md, log.md, trends.md) contains route-level design specs. These overlap heavily with the task files — only read them if a task file references something unclear.

---

## Key Facts

- **User role:** Gav is NOT a developer. He gives plain language instructions. You do ALL file ops, code, and documentation. Never ask him to run commands, upload files manually, or do anything technical.
- **Stack:** React + Vite + TypeScript frontend → Vercel. Backend is FastAPI + PostgreSQL on Railway (already built, not being rebuilt).
- **Mobile-first:** 375px primary viewport, 44px minimum touch targets.
- **4 routes:** Dashboard (`/`), Calendar (`/calendar`), Log (`/log`), Trends (`/trends`)
- **API base:** `https://gavhealth-production.up.railway.app`
- **API auth:** `X-API-Key: gavhealth-prod-api-2026-xK9mP3`
- **Git:** Never use git inside `/mnt/`. Clone to `/tmp/`, copy dist, push with PAT, delete.
- **Repo:** `https://github.com/gavan-stil/gavhealth.git`
- **PAT:** `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`
- **Vercel project:** `prj_fxgUwqBpIWrKNTBGbtvOYJeBy7mq` / team: `team_Gwse87RecVqLNTuaAmnpXG8M`
- **Auth gate password:** `goe2026` (sessionStorage persistence)

---

## HTML Design File Extraction Plan

When Gav provides the ~4,000 line HTML file from the previous project:

1. **Read once** — scan for structure: CSS variables, component boundaries, layout patterns
2. **Map against current task** — use the task file's component specs as a shopping list
3. **Extract only what matches** — pull CSS values, animation keyframes, layout structures that align with the current task's specs
4. **Discard everything else** — don't try to preserve the old project's architecture

Do NOT read the entire file multiple times. One pass for structure, then targeted pulls per task.

---

## Full Feature Inventory by Route

### Dashboard (`/`) — Tasks 02 + 03

**Readiness Card**
- Hero score: 0–100, `hero-value` typography (JBM 52px, -3px tracking)
- Signal color: good (#e8c47a) if ≥70, caution (#d4a04a) if 50–69, poor (#c47a6a) if <50
- AI narrative text below score (1–2 sentences from API)
- 4 breakdown mini-scores in a row: Sleep, Strain, Nutrition, Recovery — each with `small-number` value + `label-text` label + colored dot
- Card: bg #14130f, border #222018, radius 20px, padding 20px

**Vitals Card**
- 2×2 grid of stat boxes
- Sleep hours: value in `stat-number`, dawn blue (#7FAABC)
- Deep sleep %: same styling, dawn blue
- Resting HR: clay (#c4856a)
- Weight: gold (#e8c47a)
- Each box: label in `label-text`, value in `stat-number`, category-colored

**Recent Activity Card**
- 3 most recent activities from API
- Each row: colored type dot (8px circle) + activity name (`body-text`) + detail right-aligned (`small-number`, text-muted)
- Activity type colors: running=sand(#b8a878), strength=rust(#b47050), sauna=ember(#c45a4a)

**Streaks Card**
- 4 counters: Sauna, Meditation, Training, Logging
- Each: Lucide icon + count (`stat-number`) + label (`label-text`)
- Icons: Flame, Brain, Dumbbell, BookOpen
- Color: ochre (#d4a04a) for active streaks

**Loading States**
- Per-card skeleton with pulsing CSS gradient shimmer
- Shimmer: linear-gradient sweep, bg #1c1b15 → #222018 → #1c1b15, 1.5s infinite
- Skeleton shapes mirror card layout (rectangles for text, circles for dots)

**Error States**
- Per-card inline error (not full-page)
- AlertTriangle icon (lucide) + message + "Tap to retry"
- Independent fetching: one card failing doesn't block others

**Data Hooks**
- `useDashboard` hook fetching 3 endpoints in parallel: `/api/readiness`, `/api/summary/daily`, `/api/streaks`
- Returns `{ readiness, summary, streaks, loading, error, refetch }`

---

### Calendar (`/calendar`) — Tasks 04 + 05

**Data Layer (Task 04)**
- `useCalendarData` hook fetching 5 endpoints for 90 days:
  - `/api/data/activities?days=90` (split into running + strength)
  - `/api/data/sleep?days=90`
  - `/api/data/sauna?days=90`
  - `/api/data/weight?days=90`
  - `/api/data/rhr?days=90`
- Returns `Record<string, CategoryDot[]>` keyed by `YYYY-MM-DD`
- CategoryDot: `{ category: string, color: string, label: string, value: string }`
- Category→color map: weight=#e8c47a, sleep=#7FAABC, heart=#c4856a, running=#b8a878, strength=#b47050, sauna=#c45a4a

**Category Filter Toggles**
- Horizontal scrolling pill row at top
- Each pill: radius-pill, padding xs/md
- Active: filled with category color, white text
- Inactive: border-default border, text-muted
- Categories: Weight, Sleep, Heart, Running, Strength, Sauna
- Tapping toggles visibility of that category's dots in the grid
- Default: all active

**Month Header**
- Center: month + year in `section-head`, text-primary
- Left/right: ChevronLeft/ChevronRight (lucide), text-tertiary
- Flex with space-between

**Month Grid**
- 7-column CSS grid (Mon–Sun)
- Day cell: ~48px square
- Day number: `small-number`, text-secondary (current month) or text-muted (overflow)
- Today: ochre number + subtle underline
- Dots row: up to 6 dots (6px circles), gap 2px, centered, flexbox wrap
- Each dot colored by CategoryDot.color
- Tap → opens day detail sheet

**Day Detail Bottom Sheet**
- Slides up from viewport bottom: translateY(100%) → translateY(0), duration-slow + ease-settle
- Backdrop: rgba(0,0,0,0.5), tap to dismiss
- Sheet: bg-elevated, radius-lg top corners, padding-lg, max 60vh, scrollable
- Grab handle: 40px × 4px rounded bar, border-default, centered
- Date header: `section-head` — e.g. "Tuesday, 4 March"
- Sections per category present: label-text with 8px color dot + data in body-text
- Examples: Sleep "7.4 hrs (22% deep)" / Running "Easy 5k — 5.1 km" / Weight "78.2 kg"

---

### Log (`/log`) — Tasks 06 + 07

**Page Layout**
- Vertical stack of 4 collapsible cards, accordion (one open at a time)
- Padding: space-lg, gap: space-md
- Each card: header row (icon + title + chevron) toggles collapse

**Card State Machine (all 4 cards)**
- States: empty → parsing → parsed → confirmed → error
- Empty: input visible, submit button
- Parsing: input disabled, pulsing animation, "Parsing…" text
- Parsed: parsed result for review, "Confirm" + "Edit" buttons
- Confirmed: green check + "Logged!", auto-resets to empty after 2s
- Error: red inline message + "Try again"

**Food Card**
- Icon: UtensilsCrossed (lucide), gold (#e8c47a)
- Input: textarea, placeholder "e.g. chicken breast 200g, rice 150g, broccoli"
- Submit: "Parse" button, bg ochre, text bg-base
- NLP flow: POST `/api/log/food` {text} → 2-3s parse → show items
- Parsed: item list (name/calories/protein per item), total calories in stat-number ochre
- Confirm: POST `/api/log/food/confirm` {items, date}

**Strength Card**
- Icon: Dumbbell (lucide), rust (#b47050)
- Input: textarea, placeholder "e.g. bench press 80kg x8, 85kg x6"
- NLP flow: POST `/api/log/strength` {text} → parse → show sets
- Parsed: exercise name (section-head) + sets table (Set#/Weight/Reps in small-number)
- Confirm: POST `/api/log/strength/confirm` {exercise_id, sets, date}

**Sauna Card**
- Icon: Thermometer (lucide), ember (#c45a4a)
- Direct form (no NLP): duration (minutes) + temperature (°C)
- Input: bg-elevated, border-default, radius-sm, small-number font
- POST `/api/log/sauna` {duration_minutes, temperature_c, date}

**Habits Card**
- Icon: CheckSquare (lucide), ochre (#d4a04a)
- 2×2 checkbox grid: Stretching, Meditation, Cold Shower, Supplements
- Custom checkbox: 24px square, border 2px border-default, radius-sm
- Checked: bg ochre, white checkmark
- POST `/api/log/habits` {date, habits: {stretching, meditation, cold_shower, supplements}}

**Date Handling**
- All entries use today: `new Date().toISOString().split('T')[0]`

---

### Trends (`/trends`) — Task 08

**Time Range Selector**
- 3-pill toggle: "7D", "30D", "90D"
- Container: flex, gap-xs, bg-card, radius-pill, padding-xs
- Active pill: bg ochre, text bg-base, font-weight 700
- Inactive: bg transparent, text-muted
- Default: 30D
- Switching re-fetches all data with `days` param

**Recovery Sparklines**
- Card with 5 mini sparkline rows
- Header: "RECOVERY SIGNALS" (label-text, text-muted)
- Each row: left = label (label-text) + current value (small-number), right = sparkline (~120px × 32px)
- No axes, no grid — just line + area fill
- Metrics + colors:
  1. Sleep Duration — #7FAABC (dawn)
  2. Deep Sleep % — rgba(127,170,188,0.6) (dawn at 60%)
  3. Resting HR — #c4856a (clay), inverted (lower = better)
  4. Sauna Frequency — #c45a4a (ember)
  5. Nutrition — #e8c47a (gold)
- Recharts `<Line>` components, strokeWidth 2, dot false

**Performance Overlay Chart**
- ~200px tall ComposedChart, full width
- Header: "RECOVERY ↔ PERFORMANCE" (label-text)
- Area: recovery composite (normalized avg of sleep, RHR inverse, sauna, nutrition) — stroke #d4a04a, fill #d4a04a, fillOpacity 0.08
- Line: run distance — stroke #b8a878 (sand), strokeWidth 2
- Line: strength frequency — stroke #b47050 (rust), strokeWidth 2
- X-axis: dates, tick fill #9a9080, fontSize 10
- Y-axis: hidden (dual scale via normalization)
- CartesianGrid: stroke #222018, dasharray "2 4", opacity 0.6
- Tooltip: bg #1e1d18, border 1px solid #222018, text #f0ece4, radius 10px
- Legend: 3 colored dots with labels below chart

**Correlation Summary**
- Header: "CORRELATION INSIGHTS" (label-text)
- Pearson r on 7-day rolling averages:
  1. Sleep duration → Run distance
  2. RHR (inverted) → Strength frequency
  3. Recovery composite → Overall activity volume
- Display: label (body-text, text-secondary) + "r = 0.72" (small-number)
- Color coding: |r| > 0.5 = signal-good, 0.3–0.5 = signal-caution, < 0.3 = text-muted
- Brief interpretation: "Strong positive" / "Moderate" / "Weak" (label-text, same color)

**Data Endpoints** (all accept `days` param)
- `/api/data/sleep?days=N` → [{date, duration_hrs, deep_pct}]
- `/api/data/rhr?days=N` → [{date, rhr_bpm}]
- `/api/data/sauna?days=N` → [{date, duration_minutes, temperature_c}]
- `/api/data/food/weekly` → [{week_start, avg_calories, consistency_pct}]
- `/api/data/activities?days=N&type=run` → [{date, name, distance_km}]
- `/api/data/activities?days=N&type=strength` → [{date, name, sets}]

**Correlation Logic**
- `src/lib/correlation.ts`: `rollingAverage(data, window)` + `pearsonR(x, y)`

---

### Integration & Deploy — Task 09

**Auth Gate**
- Full-screen wrapper, bg-base
- "GOE" in hero-value, ochre + "Health" in section-head, text-muted
- Password input: bg-elevated, border-default, radius-md, body-text font
- "Enter" button: bg ochre, text bg-base
- Wrong password: border flashes signal-poor (#c47a6a) for 1s + shake animation
- Correct (`goe2026`): store in sessionStorage, render app
- On mount: check sessionStorage, skip gate if already authed

**Route Transitions**
- Fade + subtle translateY(8px→0) on route change
- Duration: duration-normal (200ms), ease-drift + ease-settle
- Minimal — no page slides or complex choreography

**Pull-to-Refresh (Dashboard only)**
- Touch event listeners on scroll container
- 60px pull threshold
- Indicator: Loader2 icon (lucide) spinning, ochre, centered above first card
- On release: re-fetch all 3 dashboard endpoints

**Error Boundary**
- React error boundary wrapping component tree
- Centered card: bg-card, border-default, radius-lg
- AlertTriangle icon + "Something went wrong" + "Reload" button
- Reload: `window.location.reload()`

**Deployment**
- Build: `cd /mnt/goe-health && npm run build`
- Clone: `git clone https://github.com/gavan-stil/gavhealth.git /tmp/gavhealth-push`
- Copy: `cp -r /mnt/goe-health/dist/* /tmp/gavhealth-push/`
- Push: `git push https://gavan-stil:<PAT>@github.com/gavan-stil/gavhealth.git main`

**Smoke Test (7 items)**
1. Auth gate appears, rejects wrong password, accepts `goe2026`
2. Dashboard loads with live data, pull-to-refresh works
3. Calendar shows month grid with dots, day detail sheet opens
4. Log cards accept input, NLP parsing works, confirmation saves
5. Trends charts render with correct time ranges
6. Tab bar navigates between all 4 routes
7. No console errors on any route

---

## Task Execution Order

```
01-scaffold → 02-dashboard-layout → 03-dashboard-live → 04-calendar-logic
→ 05-calendar-ui → 06-log-flow → 07-log-api → 08-trends-view → 09-integration
```

Each task file has its own "After Completion" section: move to `tasks/done/`, update README, update CHANGELOG, start next task.

---

## Brand Quick Reference

- **Primary:** ochre #d4a04a on near-black #0d0d0a
- **Numbers:** JetBrains Mono, weight 800, tight tracking
- **Text:** Inter, weight 400/600/700/800
- **Sleep = dawn blue #7FAABC** (only exception to warm palette)
- **Signal colors:** good=#e8c47a, caution=#d4a04a, poor=#c47a6a (NOT red/yellow/green)
- **Cards:** bg #14130f, border #222018, radius 20px
- **Touch targets:** minimum 44px
- **Animations:** ease-settle for enters, ease-drift for ambient, duration-fast/normal/slow = 120/200/400ms
