# Task 02 — Dashboard Layout (Static)

Purpose: Build the Dashboard route with all 4 cards using mock data — no API calls yet.

---

## Scope Gate

**DOES:**
- Build `DashboardPage` with 4 stacked cards (vertical scroll)
- Build `ReadinessCard` — hero score, signal color background, narrative text
- Build `VitalsCard` — sleep, deep %, RHR, weight in a 2×2 grid
- Build `RecentActivityCard` — last 3 activities list
- Build `StreaksCard` — 4 streak counters in a row
- Use hardcoded mock data (inline below)
- Apply all GOE design tokens correctly
- Ensure JetBrains Mono for numbers, Inter for text

**DOES NOT:**
- Fetch any data from API (that's Task 03)
- Build pull-to-refresh or loading states
- Build error states
- Add transitions or animations beyond basic CSS
- Modify Layout, TabBar, or routing (done in Task 01)

---

## Pre-flight Checks

- [ ] Task 01 completed: `npm run dev` runs, all 4 routes render
- [ ] Tab bar navigates between routes
- [ ] Fonts load (Inter + JetBrains Mono)

---

## Design Tokens (inline)

```css
:root {
  --bg-base: #0d0d0a;
  --bg-card: #14130f;
  --bg-card-hover: #1c1b15;
  --bg-elevated: #1e1d18;
  --border-default: #222018;
  --border-subtle: #1a1914;
  --text-primary: #f0ece4;
  --text-secondary: #b0a890;
  --text-tertiary: #9a9080;
  --text-muted: #7a7060;
  --ochre: #d4a04a;
  --ochre-light: #e8c47a;
  --signal-good: #e8c47a;
  --signal-caution: #d4a04a;
  --signal-poor: #c47a6a;
  --dawn: #7FAABC;
  --clay: #c4856a;
  --sand: #b8a878;
  --rust: #b47050;
  --ember: #c45a4a;
  --gold: #e8c47a;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 14px;
  --space-lg: 20px;
  --space-xl: 32px;
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;
}
```

### Typography (subset)

```css
.hero-value   { font-family: 'JetBrains Mono', monospace; font-size: 52px; font-weight: 800; letter-spacing: -3px; }
.card-value   { font-family: 'JetBrains Mono', monospace; font-size: 40px; font-weight: 800; letter-spacing: -2px; }
.stat-number  { font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 800; letter-spacing: -1.5px; }
.small-number { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 600; letter-spacing: -0.5px; }
.section-head { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 700; letter-spacing: -0.5px; }
.body-text    { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 400; }
.label-text   { font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; }
```

---

## Mock Data

```typescript
// src/mocks/dashboard.ts

export const MOCK_READINESS = {
  score: 78,
  breakdown: {
    sleep_score: 82,
    rhr_score: 75,
    activity_balance: 70,
    recovery_score: 85,
  },
  narrative: "Solid recovery overnight. Deep sleep was above your 30-day average and resting heart rate has been trending down. You're well-positioned for a harder session today.",
};

export const MOCK_DAILY_SUMMARY = {
  date: "2026-03-04",
  weight_kg: 78.2,
  sleep: { duration_hrs: 7.4, deep_pct: 22 },
  rhr_bpm: 52,
  activities: [
    { type: "run", name: "Easy 5k", distance_km: 5.1, date: "2026-03-04" },
    { type: "strength", name: "Upper Body", sets: 18, date: "2026-03-03" },
    { type: "run", name: "Tempo 8k", distance_km: 8.2, date: "2026-03-02" },
  ],
};

export const MOCK_STREAKS = {
  running_streak: 3,
  strength_streak: 5,
  sauna_streak: 2,
  habits_streak: 12,
};
```

---

## Components to Build

### 1. `src/pages/DashboardPage.tsx`

Vertical card stack with `padding: var(--space-lg)` and `gap: var(--space-md)` between cards.

```tsx
<div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
  <ReadinessCard data={MOCK_READINESS} />
  <VitalsCard data={MOCK_DAILY_SUMMARY} />
  <RecentActivityCard activities={MOCK_DAILY_SUMMARY.activities} />
  <StreaksCard data={MOCK_STREAKS} />
</div>
```

### 2. `src/components/dashboard/ReadinessCard.tsx`

The hero card. Visually dominant.

- Card: `bg: var(--bg-card)`, `border: 1px solid var(--border-default)`, `border-radius: var(--radius-lg)`, `padding: var(--space-lg)`
- Top: `LABEL` "READINESS" (label-text style, `var(--text-muted)`)
- Score: `hero-value` class (JBM 52px/800/-3px), color based on score:
  - 70–100: `var(--signal-good)` (#e8c47a)
  - 40–69: `var(--signal-caution)` (#d4a04a)
  - 0–39: `var(--signal-poor)` (#c47a6a)
- Narrative: `body-text` class, `var(--text-secondary)`, max 3 lines
- Bottom row: 4 mini breakdown scores in a row (sleep, rhr, activity, recovery) — `small-number` class, `var(--text-tertiary)`

### 3. `src/components/dashboard/VitalsCard.tsx`

2×2 grid of today's key vitals.

- Card: same card styling as ReadinessCard
- Top: `LABEL` "TODAY'S VITALS"
- Grid: `display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);`
- Each cell:
  - Label (label-text): "SLEEP", "DEEP SLEEP", "RHR", "WEIGHT"
  - Value (stat-number): "7.4h", "22%", "52", "78.2"
  - Unit (body-text, text-muted): "hrs", "%", "bpm", "kg"
- Category colors for values:
  - Sleep: `var(--dawn)` (#7FAABC)
  - Deep: `var(--dawn)` at 60% opacity
  - RHR: `var(--clay)` (#c4856a)
  - Weight: `var(--gold)` (#e8c47a)

### 4. `src/components/dashboard/RecentActivityCard.tsx`

Last 3 activities.

- Card: same card styling
- Top: `LABEL` "RECENT ACTIVITY"
- List of 3 items, each:
  - Left: colored dot (8px circle) by type — run: `var(--sand)`, strength: `var(--rust)`
  - Middle: activity name (body-text, text-primary), date below (label-text, text-muted)
  - Right: distance or sets (small-number, text-secondary)
- Items separated by `border-bottom: 1px solid var(--border-subtle)`

### 5. `src/components/dashboard/StreaksCard.tsx`

4 streak counters in a horizontal row.

- Card: same card styling
- Top: `LABEL` "STREAKS"
- Row: `display: flex; justify-content: space-around;`
- Each streak:
  - Number (stat-number, text-primary)
  - Label below (label-text, text-muted): "RUN", "LIFT", "SAUNA", "HABITS"
  - Icon above number (lucide-react, 16px, text-tertiary): `Flame` for run, `Dumbbell` for lift, `Thermometer` for sauna, `Check` for habits

---

## File Structure (new files only)

```
src/
├── mocks/
│   └── dashboard.ts
├── components/
│   └── dashboard/
│       ├── ReadinessCard.tsx
│       ├── VitalsCard.tsx
│       ├── RecentActivityCard.tsx
│       └── StreaksCard.tsx
├── pages/
│   └── DashboardPage.tsx  (replace placeholder)
```

---

## Done-When

- [ ] Dashboard shows 4 stacked cards with mock data
- [ ] Readiness score displays in hero-value (JBM 52px), colored by signal
- [ ] Narrative text renders below score
- [ ] Vitals grid shows sleep/deep/RHR/weight with correct category colors
- [ ] Recent activity shows 3 items with colored dots
- [ ] Streaks show 4 counters with icons
- [ ] All text uses correct typography classes
- [ ] Background is `#0d0d0a`, cards are `#14130f`
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
2. Update `README.md` route status table (Dashboard → "Static layout with mock data")
3. Add entry to `CHANGELOG.md`
4. Start next task: `tasks/active/03-dashboard-live.md`
