# Task T22 — Momentum Card + Goals System

> Purpose: Replace ReadinessCard with Momentum — a three-layer health progress tracker (target range → personal baseline → 7-day trend). Add user-editable health goals with history.
>
> Full design spec: `specs/momentum.md`
> Status: Pending HTML mockup approval before coding starts

---

## Scope Gate

DOES:
- DB migration: `health_goals` table (append-only, signal + target_min/max + notes)
- Seed initial targets: sleep 7.0–8.5hr, RHR 45–50bpm, weight 82–86kg, protein 160–200g, water 2500–3500ml
- Backend: `GET /api/momentum`, `GET /api/momentum/signals`, `GET /api/goals`, `POST /api/goals`, `GET /api/goals/{signal}/history`
- Frontend: `MomentumCard` (replaces `ReadinessCard` on Dashboard, above Sleep)
- Frontend: `/goals` route — GoalsPage with target editing + history per signal
- Frontend: `GoalDetailSheet` — bottom sheet with 7-day deviation chart per signal
- Remove hardcoded 180g protein target from Trends, read from `health_goals`
- Remove hardcoded 3L water target from Trends, read from `health_goals`

DOES NOT:
- Add AI narrative to MomentumCard (future task)
- Add workout frequency as a signal
- Add a tab bar entry for `/goals` (reachable via link only)
- Add push notifications
- Touch Calendar, Log, or Trends routes (except removing hardcoded protein/water targets)

---

## Pre-flight Checks

- [ ] Curl `GET /api/sleep?days=7` — confirm `total_sleep_hrs` field present
- [ ] Curl `GET /api/rhr?days=7` — confirm `rhr_bpm` field present
- [ ] Curl `GET /api/weight?limit=28` — confirm `weight_kg` field present
- [ ] Curl `GET /api/water?days=7` — confirm `ml` field present
- [ ] Curl `GET /api/summary/daily` — confirm `calories_in` and `protein_g` present
- [ ] Verify Railway DB accessible for migration
- [ ] Confirm `npm run build` passes before starting

---

## Design Tokens (inline)

```css
--bg-card: #1a1814
--bg-elevated: #211f1b
--border-default: rgba(255,255,255,0.08)
--border-subtle: rgba(255,255,255,0.04)
--ochre: #e8c47a
--signal-good: #7ab87a
--signal-caution: #d4a04a
--signal-poor: #c47a6a
--text-primary: #f0ebe0
--text-secondary: #b8b0a0
--text-muted: #7a7468
--space-xs: 4px
--space-sm: 8px
--space-md: 12px
--space-lg: 16px
--space-xl: 24px
--radius-sm: 6px
--radius-lg: 12px

/* Momentum-specific additions */
--momentum-underwater-bar: rgba(100,140,200,0.6)
--momentum-underwater-fill: rgba(100,140,200,0.08)
--momentum-underwater-card: rgba(100,140,200,0.04)
--momentum-target-fill: rgba(232,196,122,0.08)
```

---

## API Endpoints (inline)

### Existing endpoints used for data

| Endpoint | Field used |
|----------|-----------|
| `GET /api/sleep?days=28` | `total_sleep_hrs` per day |
| `GET /api/rhr?days=28` | `rhr_bpm` per day |
| `GET /api/weight?limit=28` | `weight_kg` per day |
| `GET /api/water?days=28` | `ml` per day |
| `GET /api/summary/daily?date=X` | `calories_in`, `protein_g` |

### New endpoints to build

#### `GET /api/momentum`

```
Headers: X-API-Key: <key>
Response:
{
  "overall_trend": "improving" | "declining" | "stable",
  "signals_on_track": 3,
  "signals_total": 6,
  "signals": [
    {
      "signal": "sleep_hrs",
      "label": "Sleep",
      "unit": "hrs",
      "target_min": 7.0,
      "target_max": 8.5,
      "baseline_28d": 6.8,
      "today": 7.1,
      "trend_7d": "improving",
      "gap_pct": -2.9,
      "status": "improving"   // "on_track" | "improving" | "off_track"
    }
  ]
}
```

**Status logic:**
- `on_track`: today's value is inside `[target_min, target_max]`
- `improving`: outside target but last 7-day avg is moving in correct direction vs baseline
- `off_track`: outside target, not improving

**Gap pct:** `(baseline_28d - target_midpoint) / target_midpoint × 100`. Negative = below target midpoint.

**Overall trend:** `"improving"` if majority of signals are `on_track` or `improving`. `"declining"` if majority are `off_track`. Else `"stable"`.

#### `GET /api/momentum/signals?days=7`

```
Response:
{
  "baselines": {
    "sleep_hrs": 6.8,
    "rhr_bpm": 51.2,
    "weight_kg": 86.1,
    "calories_in": 2180,
    "protein_g": 148,
    "water_ml": 2200
  },
  "targets": {
    "sleep_hrs": { "min": 7.0, "max": 8.5 },
    "rhr_bpm": { "min": 45.0, "max": 50.0 },
    "weight_kg": { "min": 82.0, "max": 86.0 },
    "calories_in": { "min": 2000.0, "max": 2400.0 },
    "protein_g": { "min": 160.0, "max": 200.0 },
    "water_ml": { "min": 2500.0, "max": 3500.0 }
  },
  "days": [
    {
      "date": "2026-03-14",
      "sleep_hrs": 7.1,
      "rhr_bpm": 49,
      "weight_kg": 85.4,
      "calories_in": 2050,
      "protein_g": 162,
      "water_ml": 2800
    }
  ]
}
```

#### `GET /api/goals`

```
Response: [
  {
    "signal": "sleep_hrs",
    "label": "Sleep",
    "unit": "hrs",
    "target_min": 7.0,
    "target_max": 8.5,
    "set_at": "2026-03-14T10:00:00Z",
    "notes": "Initial goal"
  }
]
```

#### `POST /api/goals`

```
Body: { "signal": "sleep_hrs", "target_min": 7.5, "target_max": 9.0, "notes": "..." }
Response: { "id": 1, "signal": "sleep_hrs", "target_min": 7.5, "target_max": 9.0, "set_at": "...", "notes": "..." }
```

#### `GET /api/goals/{signal}/history`

```
Response: [  // newest first
  { "id": 2, "target_min": 7.5, "target_max": 9.0, "set_at": "2026-03-14T10:00:00Z", "notes": "Raised target" },
  { "id": 1, "target_min": 7.0, "target_max": 8.5, "set_at": "2026-03-01T10:00:00Z", "notes": "Initial goal" }
]
```

---

## Mock Data (inline)

Use this for HTML mockup and development before backend is live:

```json
{
  "overall_trend": "improving",
  "signals_on_track": 2,
  "signals_total": 6,
  "signals": [
    { "signal": "sleep_hrs", "label": "Sleep", "unit": "hrs", "target_min": 7.0, "target_max": 8.5, "baseline_28d": 6.8, "today": 7.1, "trend_7d": "improving", "gap_pct": -5.5, "status": "improving" },
    { "signal": "rhr_bpm", "label": "Resting HR", "unit": "bpm", "target_min": 45, "target_max": 50, "baseline_28d": 52.3, "today": 49, "trend_7d": "improving", "gap_pct": 7.2, "status": "improving" },
    { "signal": "weight_kg", "label": "Weight", "unit": "kg", "target_min": 82, "target_max": 86, "baseline_28d": 86.4, "today": 86.1, "trend_7d": "stable", "gap_pct": 2.8, "status": "off_track" },
    { "signal": "calories_in", "label": "Calories", "unit": "kcal", "target_min": 2000, "target_max": 2400, "baseline_28d": 2310, "today": 2050, "trend_7d": "stable", "gap_pct": 1.2, "status": "on_track" },
    { "signal": "protein_g", "label": "Protein", "unit": "g", "target_min": 160, "target_max": 200, "baseline_28d": 148, "today": 162, "trend_7d": "improving", "gap_pct": -9.8, "status": "improving" },
    { "signal": "water_ml", "label": "Water", "unit": "ml", "target_min": 2500, "target_max": 3500, "baseline_28d": 2180, "today": 2800, "trend_7d": "improving", "gap_pct": -18.3, "status": "off_track" }
  ]
}
```

7-day signal data (sleep example — bars for chart):
```json
[
  { "date": "2026-03-08", "value": 6.3, "dev": -0.5 },
  { "date": "2026-03-09", "value": 7.2, "dev": +0.4 },
  { "date": "2026-03-10", "value": 6.1, "dev": -0.7 },
  { "date": "2026-03-11", "value": 6.8, "dev": 0.0 },
  { "date": "2026-03-12", "value": 7.4, "dev": +0.6 },
  { "date": "2026-03-13", "value": 6.9, "dev": +0.1 },
  { "date": "2026-03-14", "value": 7.1, "dev": +0.3 }
]
```

---

## Components to Build

### 1. `MomentumCard` (`src/components/dashboard/MomentumCard.tsx`)

Props: `{ data: MomentumData }`

**Collapsed state:**
```
┌─────────────────────────────────────┐
│ MOMENTUM                            │
│ ↑ Trending toward goals     Edit → │
│ ● ● ● ● ○ ○   3 of 6 on track      │
└─────────────────────────────────────┘
```
- Tap card → toggle expanded
- `Edit Goals →` link: `useNavigate()` to `/goals`
- Card background: `--momentum-underwater-card` if `signals_on_track < 3`

**Expanded state (below collapsed content):**
- 6 signal rows, each:
  ```
  Sleep     7.1 hrs   +0.3hr vs avg   [sparkline]   ↑ Improving
  ```
- Tap row → open `GoalDetailSheet` for that signal

**Hooks:** `useMomentum()` — fetches `GET /api/momentum`

---

### 2. `useMomentum` hook (`src/hooks/useMomentum.ts`)

Fetches `/api/momentum`. Returns `{ data, loading, error }`.

---

### 3. `useMomentumSignals` hook (`src/hooks/useMomentumSignals.ts`)

Fetches `/api/momentum/signals`. Returns 7-day data + baselines + targets.

---

### 4. `GoalDetailSheet` (`src/components/dashboard/GoalDetailSheet.tsx`)

Props: `{ signal: string; onClose: () => void }`

Bottom sheet (zIndex ≥ 110). Shows:
- Signal title + unit
- `SignalDeviationChart` (7-day bars, baseline dashed, target zone shaded)
- Current target range display
- `Edit Target →` → `useNavigate('/goals')`

---

### 5. `SignalDeviationChart` (`src/components/dashboard/SignalDeviationChart.tsx`)

Props: `{ days: DayValue[]; baseline: number; targetMin?: number; targetMax?: number; unit: string }`

Recharts `BarChart`:
- Reference line at `baseline` (dashed, `--text-muted`)
- Reference area from `targetMin` to `targetMax` (ochre tint fill, `--momentum-target-fill`)
- Bars: value = `day.dev` (deviation from baseline)
- Bar fill: above baseline = `--ochre`, below baseline = `--momentum-underwater-bar`
- If `baseline < targetMin`: render a second reference area from chart floor to targetMin in blue tint — the "underwater" zone
- X-axis: day labels (Mon, Tue, etc.)
- Y-axis: hidden, but tooltips show absolute value

---

### 6. `/goals` route — `GoalsPage` (`src/pages/GoalsPage.tsx`)

No tab bar entry. Route: `/goals`.

Layout:
- Full-screen page with back button → Dashboard
- List of 6 signal sections
- Each signal section:
  - Name + current target range
  - `Your 28-day average: X [unit]`
  - Inline 7-day sparkline (`SignalDeviationChart` compact mode)
  - `Set New Target` button → expands inline form
  - `Target History` toggle → list of past goals

**New target form (inline):**
- Min input + Max input (number, labelled)
- Notes textarea (optional)
- `Save` button → `POST /api/goals` → refetch

**History:**
- Shows `set_at` date + range + notes
- Newest first

---

### 7. Backend — `app/routers/momentum.py`

New router registered in `main.py` at prefix `/api`.

Endpoints:
- `GET /momentum` → calls `services/momentum.py::compute_momentum(db, target_date)`
- `GET /momentum/signals` → calls `services/momentum.py::get_signal_history(db, days)`
- `GET /goals` → latest row per signal from `health_goals`
- `POST /goals` → insert new row
- `GET /goals/{signal}/history` → all rows for signal, newest first

---

### 8. Backend — `app/services/momentum.py`

Core calculation:

```python
async def compute_momentum(db, target_date):
    # For each signal:
    # 1. Query 28-day rolling average
    # 2. Query today's value
    # 3. Query latest target from health_goals
    # 4. Compute gap_pct, trend_7d, status
    # 5. Return full momentum response
```

**Trend calculation:**
- Fetch last 7 days of signal values
- Compare 7-day average to 28-day baseline
- For ≥ signals (sleep, protein, water): `avg_7d > baseline_28d` = improving
- For ≤ signals (rhr): `avg_7d < baseline_28d` = improving
- For range signals (weight, calories): `abs(avg_7d - target_mid) < abs(baseline_28d - target_mid)` = improving

---

## Visual Sign-off Checklist (before coding)

- [ ] HTML mockup created at `archive/momentum-mockup.html`
- [ ] Real data curled from Railway and hard-coded into mockup
- [ ] Collapsed MomentumCard looks correct
- [ ] Expanded signal rows look correct
- [ ] SignalDeviationChart: bars + dashed baseline + target zone + underwater fill renders correctly
- [ ] "Underwater" card tint visible when majority signals off-track
- [ ] GoalsPage signal section (target range + sparkline + history) looks correct
- [ ] Gav approves visual before any React code is written

---

## Done-When

- [ ] `GET /api/momentum` returns correct data for today
- [ ] `GET /api/momentum/signals` returns 7-day data for all 6 signals
- [ ] `GET /api/goals` returns current target per signal
- [ ] `POST /api/goals` inserts new row, old row preserved
- [ ] `GET /api/goals/{signal}/history` returns all rows newest-first
- [ ] `health_goals` table created with initial seed data
- [ ] `MomentumCard` renders on Dashboard above SleepCard
- [ ] `ReadinessCard` removed from Dashboard
- [ ] MomentumCard collapsed state shows trend + 6 signal chips
- [ ] MomentumCard expanded state shows 6 signal rows with sparklines
- [ ] Tap signal row → `GoalDetailSheet` opens correctly
- [ ] `SignalDeviationChart` renders bars + baseline + target zone correctly
- [ ] Underwater fill appears when baseline < target_min
- [ ] `/goals` route navigates from `Edit Goals →` link
- [ ] GoalsPage shows all 6 signals with current targets + baselines
- [ ] Set New Target form saves and history updates
- [ ] Protein target reads from `health_goals` (not hardcoded)
- [ ] Water target reads from `health_goals` (not hardcoded)
- [ ] `npm run build` passes

---

## After Completion

1. Move this file to `tasks/done/T22-momentum.md`
2. Update `STATUS.md` — T22 to Recently Completed, clear Active Task
3. Add entry to `CHANGELOG.md`
4. Update `features.md` — Dashboard route: replace ReadinessCard with MomentumCard; add /goals route
5. Update `reference/api.md` — add all 5 new endpoints
6. Delete `SESSION.md` if it exists

---

## If Blocked

1. Try 3 different approaches
2. Document what was tried and what failed
3. Stop — do NOT keep looping
4. Report to Gav with specifics: what was tried, what failed, suggested next step
