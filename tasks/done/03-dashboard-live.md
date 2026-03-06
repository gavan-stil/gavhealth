# Task 03 — Dashboard Live Data

Purpose: Replace mock data with live API calls on Dashboard route. Add loading skeletons and error states.

---

## Scope Gate

**DOES:**
- Wire `ReadinessCard` to `GET /api/readiness`
- Wire `VitalsCard` to `GET /api/summary/daily`
- Wire `StreaksCard` to `GET /api/streaks`
- Wire `RecentActivityCard` to activities from daily summary
- Use `apiFetch<T>()` helper from `src/lib/api.ts` (created in Task 01)
- Add loading skeleton state (pulsing card placeholders)
- Add error state (inline retry message per card)

**DOES NOT:**
- Modify card visual design or layout (done in Task 02)
- Add pull-to-refresh (that's Task 09)
- Add caching or SWR
- Touch Calendar, Log, or Trends routes

---

## Pre-flight Checks

- [ ] Task 02 completed: Dashboard shows 4 stacked cards with mock data
- [ ] `apiFetch<T>()` exists in `src/lib/api.ts`
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

---

## API Endpoints (inline)

**Base URL:** `https://gavhealth-production.up.railway.app`
**Auth header:** `X-API-Key: gavhealth-prod-api-2026-xK9mP3`

### GET `/api/readiness`
```typescript
// Response
{
  score: number,           // 0–100
  breakdown: {
    sleep_score: number,
    rhr_score: number,
    activity_balance: number,
    recovery_score: number
  },
  narrative: string        // 1–3 sentences
}
```

### GET `/api/summary/daily`
```typescript
// Response
{
  date: string,            // YYYY-MM-DD
  weight_kg: number,
  sleep: {
    duration_hrs: number,
    deep_pct: number
  },
  rhr_bpm: number,
  activities: Array<{
    type: "run" | "strength",
    name: string,
    distance_km?: number,
    sets?: number,
    date: string
  }>
}
```

### GET `/api/streaks`
```typescript
// Response
{
  running_streak: number,
  strength_streak: number,
  sauna_streak: number,
  habits_streak: number
}
```

---

## Component Specs

### Loading Skeleton

Each card gets a skeleton variant — same card dimensions, with pulsing placeholder blocks replacing content.

```css
.skeleton-pulse {
  background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-card-hover) 50%, var(--bg-card) 75%);
  background-size: 200% 100%;
  animation: pulse 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}
@keyframes pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- ReadinessCard skeleton: large block (52px tall), small block (3 lines), 4 small blocks in row
- VitalsCard skeleton: 2×2 grid of blocks
- RecentActivityCard skeleton: 3 list items (dot + 2 lines each)
- StreaksCard skeleton: 4 columns (icon + number + label placeholders)

### Error State

Per-card inline error. Card still renders at normal size but shows:

```
[WarningIcon]  Couldn't load [section name]
[Tap to retry]
```

- Icon: lucide-react `AlertTriangle`, 16px, `var(--signal-poor)`
- Message: `body-text`, `var(--text-muted)`
- "Tap to retry": `label-text`, `var(--ochre)`, cursor pointer, calls refetch

### DashboardPage Changes

Replace mock imports with 3 `useEffect` + `useState` calls (or a custom `useDashboard` hook). Each endpoint fetched independently so partial failures show per-card errors while successful cards render normally.

---

## File Structure

```
src/
├── components/
│   └── dashboard/
│       └── CardSkeleton.tsx      (new — reusable skeleton block)
├── hooks/
│   └── useDashboard.ts           (new — fetches all 3 endpoints)
├── pages/
│   └── DashboardPage.tsx          (modify — replace mocks with live data)
```

---

## Done-When

- [ ] Dashboard loads live data from all 3 endpoints
- [ ] Pulsing skeleton shows while each card loads
- [ ] Per-card error state with retry button works
- [ ] Partial failure: one card can error while others render
- [ ] No mock data imports remain in DashboardPage
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
2. Update `README.md` route status table (Dashboard → "Live data with loading/error states")
3. Add entry to `CHANGELOG.md`
4. Start next task: `tasks/active/04-calendar-logic.md`
