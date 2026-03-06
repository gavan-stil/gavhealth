# Task 05 — Calendar UI

Purpose: Build the Calendar route — 8-column month grid (7 days + weekly summary), colored dots with toggleable duration text, category filters with sub-toggles, day detail bottom sheet, stats/patterns sections.

Reference mockup: `archive/calendar-mockup.html` — open in browser to see exact layout and interactions.

---

## Scope Gate

**DOES:**
- Build `CalendarPage` with 8-column grid (Mon–Sun + weekly summary column)
- Arrow-based month navigation
- Render colored category dots in each day cell from `useCalendarData`
- Toggleable duration text next to dots (meta toggle "Dur", off by default)
- Category filter toggles (pill-shaped, colored) in a toggle bar
- Sub-toggle bar when exactly 1 category is active (e.g. running → Dist, Pace, BPM)
- Stats section: per-category count pills (toggleable, off by default)
- Patterns section: Active Days %, Best Streak, Rest Days, Total Time (toggleable, off by default)
- Tappable day cells → bottom sheet with that day's full data
- Weekly summary column showing aggregated time per active category
- Mobile-first: grid fits 375px viewport

**DOES NOT:**
- Fetch data (uses `useCalendarData` from Task 04)
- Build week view or year view
- Add drag-to-select date ranges
- Touch Dashboard, Log, or Trends routes

---

## Pre-flight Checks

- [ ] Task 04 completed: `useCalendarData` returns `Record<string, CategoryDot[]>`
- [ ] Calendar route exists and renders (from Task 01)
- [ ] `npm run dev` runs without errors

---

## Design Tokens (inline)

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

### Typography

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

### Category Colors

```
Weight:   #e8c47a  (gold)
Sleep:    #7FAABC  (dawn)
Heart:    #c4856a  (clay)
Running:  #b8a878  (sand)
Strength: #b47050  (rust)
Sauna:    #c45a4a  (ember)
Body:     #d4a890  (blush)
```

---

## API Endpoints (inline)

No direct API calls — this task uses `useCalendarData` from Task 04, which handles all fetching.

---

## Component Specs

### 1. `src/pages/CalendarPage.tsx`

Top-level layout:
```
[Toggle Bar]                     — category pills + meta toggles (Dur, Stats, Pat)
[Sub-toggle Bar]                 — appears when exactly 1 category active (e.g. Dist, Pace, BPM)
[Month Header + Nav Arrows]      — "March 2026" with ← →
[Day-of-week headers + Wk]      — M T W T F S S Wk
[Month Grid]                     — 5–6 rows × 8 cols (7 days + weekly summary)
[Stats Section]                  — per-category count pills (hidden by default)
[Patterns Section]               — Active Days %, Best Streak, etc (hidden by default)
[Bottom Sheet]                   — slides up when day tapped
```

State managed at page level:
- `activeCategories: Set<CategoryName>` — which categories are visible (default: all)
- `showDuration: boolean` — meta toggle (default: false)
- `showStats: boolean` — meta toggle (default: false)
- `showPatterns: boolean` — meta toggle (default: false)
- `subToggles: Record<string, boolean>` — per-sub-metric toggles when single category isolated
- `currentMonth: { year: number; month: number }` — month navigation
- `selectedDate: string | null` — for bottom sheet

### 2. `src/components/calendar/ToggleBar.tsx`

Row with two sections: category toggles (left) and meta toggles (right).

**Category toggles:**
- Each pill: `border-radius: var(--radius-pill)`, `padding: var(--space-xs) var(--space-md)`
- Active: filled with category color at ~20% opacity, border matches category color, text in category color
- Inactive: `border: 1px solid var(--border-default)`, text `var(--text-muted)`
- Categories: Weight, Sleep, Heart, Running, Strength, Sauna
- Tapping toggles that category on/off
- "All" button to reset all active
- Default: all active

**Meta toggles (right side):**
- Small pills: "Dur" (duration), "Stats", "Pat" (patterns)
- Same pill style but `var(--ochre)` when active, muted when inactive
- All off by default

### 3. `src/components/calendar/SubToggleBar.tsx`

Conditional bar that appears ONLY when exactly 1 category is active.

Sub-toggle definitions per category:
- **Running:** Dist (distance), Pace, BPM (heart rate)
- **Strength:** Sets, Reps, Load
- **Sleep:** Hrs (hours), Deep%, REM
- **Heart:** RHR, HRV, Zones
- **Weight:** kg, Δ (delta from previous)
- **Sauna:** Mins, Temp

- Small pills with category color when active
- All on by default when bar appears
- Toggling shows/hides that sub-metric in the day cells

### 4. `src/components/calendar/MonthGrid.tsx`

8-column grid for one month (7 days + weekly summary).

- Grid: `display: grid; grid-template-columns: repeat(7, 1fr) 56px;`
- **Day cell:** ~48px wide, vertically stacked
  - Day number: `small-number`, `var(--text-secondary)` (current month) or `var(--text-muted)` (overflow days)
  - Today: day number gets `var(--ochre)` color and a subtle underline
  - Activity stack: for each active category present that day:
    - Colored dot (6px circle) + optional duration text (if Dur toggle on)
    - Duration text: `font: 500 9px/1 'JetBrains Mono'`, `var(--text-tertiary)`
    - e.g. `● 45m` or `● 7.2h` or `● 78.5`
  - When sub-toggles active (single category mode): show sub-metric values instead
  - Tapping a cell → opens bottom sheet for that date

- **Weekly summary column:**
  - Background: slightly elevated (`var(--bg-card)`)
  - Shows aggregated time/value per active category for that week row
  - Same dot + value format but summarized
  - Label: "Wk" in the header row

### 5. `src/components/calendar/MonthHeader.tsx`

- Center: month + year in `section-head` style, `var(--text-primary)`
- Left arrow: `ChevronLeft` (lucide-react), `var(--text-tertiary)`, tappable
- Right arrow: `ChevronRight`, same style
- `display: flex; justify-content: space-between; align-items: center;`

### 6. `src/components/calendar/StatsSection.tsx`

Only visible when Stats meta toggle is on.

- Row of small pills, one per active category
- Each pill: category color dot + count text (e.g. "Run: 12", "Sleep: 28")
- Counts how many days in the displayed month have that category
- Flex wrap layout

### 7. `src/components/calendar/PatternsSection.tsx`

Only visible when Patterns meta toggle is on.

- 4 pattern cards in a 2×2 grid:
  - **Active Days %** — days with any logged data / total days in month, color-coded (green >70%, ochre 50-70%, red <50%)
  - **Best Streak** — longest consecutive run of days with data
  - **Rest Days** — days with no activity logged
  - **Total Time** — sum of all duration across active categories
- Small cards with `var(--bg-card)` background, `var(--radius-sm)` corners

### 8. `src/components/calendar/DayDetailSheet.tsx`

Bottom sheet that slides up from viewport bottom.

- Backdrop: `rgba(0,0,0,0.5)`, tapping dismisses
- Sheet: `bg: var(--bg-elevated)`, `border-radius: var(--radius-lg) var(--radius-lg) 0 0`, `padding: var(--space-lg)`
- Max height: 60vh, scrollable if overflow
- Top: grab handle (40px × 4px rounded bar, `var(--border-default)`, centered)
- Date header: `section-head`, `var(--text-primary)` — e.g. "Tuesday, 4 March"
- Content sections per category present that day:
  - Section label: `label-text` with category color dot (8px)
  - Data: relevant values in `body-text`
  - e.g. Sleep: "7.4 hrs (22% deep)" / Running: "Easy 5k — 5.1 km" / Weight: "78.2 kg"
- Slide-up animation: `transform: translateY(100%) → translateY(0)`, `transition: transform var(--duration-slow) var(--ease-settle)`

---

## File Structure

```
src/
├── components/
│   └── calendar/
│       ├── ToggleBar.tsx          (new — category + meta toggles)
│       ├── SubToggleBar.tsx       (new — per-category sub-metric toggles)
│       ├── MonthGrid.tsx          (new — 8-col grid with weekly summary)
│       ├── MonthHeader.tsx        (new)
│       ├── StatsSection.tsx       (new — per-category count pills)
│       ├── PatternsSection.tsx    (new — Active Days %, Best Streak, etc)
│       └── DayDetailSheet.tsx     (new)
├── pages/
│   └── CalendarPage.tsx           (replace placeholder)
```

---

## Done-When

- [ ] Calendar shows current month in 8-column grid (7 days + weekly summary)
- [ ] Colored dots appear in day cells matching data from `useCalendarData`
- [ ] Duration text toggleable via "Dur" meta toggle (off by default)
- [ ] Month navigation (← →) works, grid re-renders for new month
- [ ] Tapping a day opens bottom sheet with that day's data
- [ ] Category filter toggles show/hide dot types
- [ ] Sub-toggle bar appears when exactly 1 category is active
- [ ] Stats section toggleable via "Stats" meta toggle (off by default)
- [ ] Patterns section toggleable via "Pat" meta toggle (off by default)
- [ ] Weekly summary column shows aggregated values per week row
- [ ] Today is visually distinct (ochre number)
- [ ] Grid fits 375px viewport
- [ ] Bottom sheet slides up with animation, backdrop dismisses
- [ ] No TypeScript errors (`npm run build` succeeds)

---

## If Blocked

1. Try 3 different approaches
2. Document what was tried and what failed
3. Stop — do NOT keep looping
4. Report the blocker to Gav with specifics

---

## After Completion

1. Move this file from `tasks/active/` to `tasks/done/`
2. Update `README.md` route status table (Calendar → "Month grid with dots + day detail sheet")
3. Add entry to `CHANGELOG.md`
4. Start next task: `tasks/active/06-log-flow.md`
