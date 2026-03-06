# Task 08 — Trends View

Purpose: Build the Trends route — recovery vs performance correlation visualization. **This is the core value proposition.** The user's primary interest is seeing how recovery signals correlate with performance outputs.

---

## Scope Gate

**DOES:**
- Build `TrendsPage` with time range selector (7d / 30d / 90d pill toggle)
- Build Recovery Overview section: 5 sparklines (sleep duration, deep sleep %, RHR, sauna frequency, nutrition consistency)
- Build Performance Overlay section: ~200px chart showing run distance + strength frequency overlaid on recovery composite
- Compute client-side Pearson correlation on 7-day rolling averages
- Use Recharts for all chart rendering
- Apply brand chart tokens

**DOES NOT:**
- Build data export or sharing
- Build individual metric deep-dive pages
- Add annotations or goal lines
- Touch Dashboard, Calendar, or Log routes

---

## Pre-flight Checks

- [ ] Task 07 completed (or at minimum Task 03 — this task needs live API)
- [ ] Trends route exists and renders (from Task 01)
- [ ] Recharts installed (`npm ls recharts`)
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

### Recharts Tokens (from brand guide)

```
cartesianGrid.stroke: #222018
cartesianGrid.strokeDasharray: "2 4"
cartesianGrid.strokeOpacity: 0.6
axis tick fill: #9a9080
axis tick fontSize: 10
axis tick fontFamily: Inter
axis line stroke: #222018
tooltip bg: #1e1d18
tooltip border: 1px solid #222018
tooltip text: #f0ece4
tooltip borderRadius: 10px
line strokeWidth: 2
line dot: false
line activeDot r: 4
area fillOpacity: 0.08
```

### Category Colors (for chart lines)

```
Sleep duration:   #7FAABC  (dawn)
Deep sleep %:     #7FAABC at 60% opacity
RHR:              #c4856a  (clay)
Sauna frequency:  #c45a4a  (ember)
Nutrition:        #e8c47a  (gold)
Run distance:     #b8a878  (sand)
Strength freq:    #b47050  (rust)
Recovery composite: #d4a04a (ochre)
```

---

## API Endpoints (inline)

**Base URL:** `https://gavhealth-production.up.railway.app`
**Auth header:** `X-API-Key: gavhealth-prod-api-2026-xK9mP3`

All endpoints accept a `days` query parameter (7, 30, or 90).

### GET `/api/data/sleep?days=N`
```typescript
Array<{ date: string, duration_hrs: number, deep_pct: number }>
```

### GET `/api/data/rhr?days=N`
```typescript
Array<{ date: string, rhr_bpm: number }>
```

### GET `/api/data/sauna?days=N`
```typescript
Array<{ date: string, duration_minutes: number, temperature_c: number }>
```

### GET `/api/data/food/weekly`
```typescript
Array<{ week_start: string, avg_calories: number, consistency_pct: number }>
```

### GET `/api/data/activities?days=N&type=run`
```typescript
Array<{ date: string, name: string, distance_km: number }>
```

### GET `/api/data/activities?days=N&type=strength`
```typescript
Array<{ date: string, name: string, sets: number }>
```

---

## Component Specs

### 1. `src/pages/TrendsPage.tsx`

Layout:
```
[Time Range Selector]         — 7d / 30d / 90d pills
[Recovery Overview]           — section with 5 sparklines
[Performance Overlay]         — ~200px composite chart
[Correlation Summary]         — text summary of Pearson r values
```

### 2. `src/components/trends/TimeRangeSelector.tsx`

3-pill toggle bar.

- Container: `display: flex; gap: var(--space-xs); bg: var(--bg-card); border-radius: var(--radius-pill); padding: var(--space-xs);`
- Each pill: `padding: var(--space-xs) var(--space-lg); border-radius: var(--radius-pill);`
- Active: `bg: var(--ochre); color: var(--bg-base); font-weight: 700;`
- Inactive: `bg: transparent; color: var(--text-muted);`
- Options: "7D", "30D", "90D"
- Default: 30D

### 3. `src/components/trends/RecoverySparklines.tsx`

5 mini sparkline rows stacked vertically in a card.

- Card: standard card styling (`bg-card`, `border-default`, `radius-lg`, `padding: var(--space-lg)`)
- Header: "RECOVERY SIGNALS" (`label-text`, `var(--text-muted)`)
- Each sparkline row:
  - Left: label (`label-text`) + current value (`small-number`)
  - Right: sparkline (~120px wide, 32px tall, Recharts `<Line>`)
  - Line color: category color for that metric
  - No axes, no grid — just the line and area fill
- Metrics:
  1. Sleep Duration — value: "7.4h", line color: `#7FAABC`
  2. Deep Sleep % — value: "22%", line color: `rgba(127, 170, 188, 0.6)`
  3. Resting HR — value: "52", line color: `#c4856a` (inverted: lower is better)
  4. Sauna Frequency — value: "3/wk", line color: `#c45a4a`
  5. Nutrition — value: "85%", line color: `#e8c47a`

### 4. `src/components/trends/PerformanceOverlay.tsx`

Composite chart — ~200px tall, full width.

- Card: standard card styling
- Header: "RECOVERY ↔ PERFORMANCE" (`label-text`)
- Chart: Recharts `<ComposedChart>` with:
  - Area: recovery composite (average of normalized sleep, RHR inverse, sauna, nutrition) — `stroke: #d4a04a`, `fill: #d4a04a`, `fillOpacity: 0.08`
  - Line: run distance (sum per day/week) — `stroke: #b8a878`, `strokeWidth: 2`
  - Line: strength frequency (sessions per week) — `stroke: #b47050`, `strokeWidth: 2`
  - X-axis: dates, `tick: { fill: '#9a9080', fontSize: 10 }`
  - Y-axis: hidden (dual scale handled by normalization)
  - CartesianGrid: `stroke: #222018`, `strokeDasharray: "2 4"`, `strokeOpacity: 0.6`
  - Tooltip: `bg: #1e1d18`, `border: 1px solid #222018`, `color: #f0ece4`, `borderRadius: 10px`
- Legend: 3 items (Recovery, Run, Strength) as colored dots with labels below chart

### 5. `src/components/trends/CorrelationSummary.tsx`

Text-based summary of computed correlations.

- Card: standard card styling
- Header: "CORRELATION INSIGHTS" (`label-text`)
- Each correlation pair:
  - Label: e.g. "Sleep → Run Performance" (`body-text`, `var(--text-secondary)`)
  - Value: Pearson r formatted as "r = 0.72" (`small-number`)
  - Color: `var(--signal-good)` if |r| > 0.5, `var(--signal-caution)` if 0.3–0.5, `var(--text-muted)` if < 0.3
  - Brief interpretation: e.g. "Strong positive" (`label-text`, same color)

### Pearson Correlation Logic

```typescript
// src/lib/correlation.ts

// Compute 7-day rolling average for a time series
function rollingAverage(data: number[], window: number): number[]

// Pearson correlation coefficient
function pearsonR(x: number[], y: number[]): number
// Returns r value between -1 and 1

// Compute on:
// 1. Sleep duration (7-day avg) vs Run distance (7-day avg)
// 2. RHR (7-day avg, inverted) vs Strength frequency (7-day avg)
// 3. Recovery composite vs overall activity volume
```

---

## File Structure

```
src/
├── lib/
│   └── correlation.ts                   (new)
├── hooks/
│   └── useTrendsData.ts                 (new — fetches all 6 endpoints)
├── components/
│   └── trends/
│       ├── TimeRangeSelector.tsx         (new)
│       ├── RecoverySparklines.tsx        (new)
│       ├── PerformanceOverlay.tsx        (new)
│       └── CorrelationSummary.tsx        (new)
├── pages/
│   └── TrendsPage.tsx                   (replace placeholder)
```

---

## Done-When

- [ ] Time range selector switches between 7d/30d/90d and re-fetches data
- [ ] 5 recovery sparklines render with correct colors and current values
- [ ] Performance overlay chart shows recovery area + run line + strength line
- [ ] Recharts styling matches brand tokens (dark bg, subtle grid, ochre tooltip)
- [ ] Pearson correlation computed and displayed with color-coded strength
- [ ] Loading states while data fetches
- [ ] Charts responsive at 375px width
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
2. Update `README.md` route status table (Trends → "Recovery vs performance with correlations")
3. Add entry to `CHANGELOG.md`
4. Start next task: `tasks/active/09-integration.md`
