# Momentum — Feature Spec

> Version 1.0 — 2026-03-14
> Status: Approved, pending HTML mockup before build

---

## Purpose

**Momentum** replaces the `ReadinessCard` on the Dashboard. It answers one question:

> *"Am I trending toward or away from my goals — and how far off am I?"*

This drives a daily decision: if you're drifting from your targets, train light or rest. If you're tracking well, push.

---

## Why "Momentum" (not "Readiness")

Readiness = *can I train hard today?* (acute — based on yesterday's sleep, today's RHR)
Momentum = *am I building better habits over time?* (longitudinal — based on weekly trends vs personal baseline vs target)

These are different questions. Momentum is the primary card. Readiness (acute) is derived from it.

---

## Three-Layer Model

Each signal has three reference points:

```
TARGET ZONE  ████████████████  [user-set range, stored in health_goals]
                 ↑ gap label ("–0.8hr below target zone")
BASELINE     ─ ─ ─ ─ ─ ─ ─ ─  [28-day rolling average — dashed line]
                 ↑ trend indicator (↑↓ vs last 7d direction)
7-DAY BARS   ▂ ▃ ▅ ▄ ▃ ▆ ▇    [deviation from baseline, colored by zone]
```

**Gap** = how far your baseline is from your target range (ambition gap)
**Trend** = are the last 7 days closing or widening that gap? (momentum direction)

The two together tell the story: *you're below target (gap), but improving (trend)* = momentum building.

---

## Signals

All six signals have editable user-set target ranges. All live in `health_goals`.

| Signal key | Label | Direction | DB source | Replaces |
|------------|-------|-----------|-----------|---------|
| `sleep_hrs` | Sleep | ≥ range | `sleep_logs.total_sleep_hrs` | — |
| `rhr_bpm` | Resting HR | ≤ range | `rhr_logs.rhr_bpm` | — |
| `weight_kg` | Weight | range | `weight_logs.weight_kg` | — |
| `calories_in` | Calories | range | `daily_summary.calories_in` | — |
| `protein_g` | Protein | ≥ range | `food_logs` (daily sum) | 180g hardcoded in Trends |
| `water_ml` | Water | ≥ range | `water_logs` (daily sum) | 3L hardcoded in Trends |

**Baseline** = 28-day rolling average from the source table.
**Target** = latest row in `health_goals` for that signal.
**Deviation** = `(today_value - baseline_28d) / baseline_28d × 100` — clamped ±50%.

### Signal status logic

| Status | Condition | Color |
|--------|-----------|-------|
| On Track | Today's value inside target range | Green |
| Improving | Outside target but trending correct direction vs baseline | Ochre |
| Off Track | Outside target, trending wrong direction | Red / blue |

---

## DB Schema — `health_goals`

Append-only. Never update or delete rows. Active target = latest row per signal.

```sql
CREATE TABLE health_goals (
  id          SERIAL PRIMARY KEY,
  signal      VARCHAR(50)   NOT NULL,   -- 'sleep_hrs', 'rhr_bpm', 'weight_kg', 'calories_in', 'protein_g', 'water_ml'
  target_min  FLOAT,                    -- lower bound of target range (NULL = no lower bound)
  target_max  FLOAT,                    -- upper bound of target range (NULL = no upper bound)
  set_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  notes       TEXT                      -- optional context ("hit first goal, raising target")
);

CREATE INDEX idx_health_goals_signal_set_at ON health_goals (signal, set_at DESC);
```

**Examples:**

| signal | target_min | target_max | notes |
|--------|-----------|-----------|-------|
| sleep_hrs | 7.0 | 8.5 | Initial goal |
| rhr_bpm | 45 | 50 | After cardio block |
| weight_kg | 82 | 85 | Cut phase |
| protein_g | 160 | 200 | — |
| water_ml | 2500 | 3500 | — |

---

## API Endpoints

### `GET /api/momentum`

Dashboard card data. Returns per-signal summary + overall trend.

**Response:**
```json
{
  "overall_trend": "improving",
  "signals_on_track": 3,
  "signals_total": 6,
  "signals": [
    {
      "signal": "sleep_hrs",
      "label": "Sleep",
      "target_min": 7.0,
      "target_max": 8.5,
      "baseline_28d": 6.8,
      "today": 7.1,
      "trend_7d": "improving",
      "gap_pct": -2.9,
      "status": "improving"
    }
  ]
}
```

- `gap_pct`: `(baseline_28d - target_midpoint) / target_midpoint × 100`. Negative = below target.
- `trend_7d`: direction of last 7 days vs baseline. `"improving" | "declining" | "stable"`.
- `overall_trend`: majority signal trend direction.

### `GET /api/momentum/signals`

7 days of daily values per signal for chart rendering.

**Query params:** `?days=7` (default 7, max 30)

**Response:**
```json
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
    "rhr_bpm": { "min": 45, "max": 50 }
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

### `GET /api/goals`

All current targets (latest row per signal).

**Response:**
```json
[
  {
    "signal": "sleep_hrs",
    "label": "Sleep",
    "target_min": 7.0,
    "target_max": 8.5,
    "set_at": "2026-03-14T10:00:00Z",
    "notes": "Initial goal"
  }
]
```

### `POST /api/goals`

Insert a new target. Always inserts — never updates existing rows.

**Body:**
```json
{
  "signal": "sleep_hrs",
  "target_min": 7.5,
  "target_max": 9.0,
  "notes": "Raising target after hitting baseline"
}
```

### `GET /api/goals/{signal}/history`

All past target rows for a signal, newest first.

**Response:** array of goal rows with `set_at` and `notes`.

---

## Frontend Structure

### `MomentumCard` — Dashboard (replaces `ReadinessCard`)

**Position:** Above Sleep card on Dashboard.

**Collapsed state (default):**
- Label: `MOMENTUM` (same style as other card labels)
- Overall trend line: `↑ Trending toward goals` or `↓ Drifting from goals` or `→ Holding steady`
- Signal chips row: 6 chips, each showing signal name + status dot (green / ochre / blue-red)
- Subtext: `3 of 6 signals on track`
- `Edit Goals →` text link — navigates to `/goals` route
- Card background: subtle cool blue wash (`rgba(100, 140, 200, 0.06)`) if `signals_on_track < 3`, neutral otherwise
- Tap card body → expands to detail state

**Expanded state:**
- Per-signal rows (6 total), each showing:
  - Signal name + unit
  - Today's value
  - `vs baseline` delta annotation (e.g. `+0.3hr vs avg`)
  - 7-day mini sparkline (inline, 60px wide)
  - Status chip
- Tap any signal row → opens `GoalDetailSheet` for that signal

### `/goals` — GoalsPage

New route. No tab bar entry. Reached via `Edit Goals →` from MomentumCard.

**Layout:**
- Header: `← Back` + `Goals` title
- List of 6 signal sections, each containing:
  - Signal name + current target range (e.g. `7.0 – 8.5 hrs`)
  - Baseline context: `Your 28-day average: 6.8 hrs`
  - 7-day sparkline (so targets can be set realistically)
  - `Set New Target` button → expands inline form:
    - Min input + Max input (numeric, labelled with unit)
    - Notes text field (optional)
    - `Save` button → `POST /api/goals`
  - `History` toggle → expands timeline of past targets, newest first, each showing value range + date + notes

### `GoalDetailSheet` — Bottom sheet

Reached by tapping a signal row in expanded MomentumCard.

**Content:**
- Signal name header + unit
- Full 7-day deviation chart (see below)
- Current target range display
- `Edit Target →` button → navigates to `/goals` scrolled to that signal

---

## Visual Language

### Signal deviation chart (per-signal, 7 bars)

```
         TARGET ZONE (shaded band, ochre tint)
  ─────────────────────────────────────────────  ← target_max
  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ← target zone (ochre fill, 10% opacity)
  ─────────────────────────────────────────────  ← target_min

         BASELINE (dashed line = zero)
  - - - - - - - - - - - - - - - - - - - - - - -  ← baseline_28d

  ▁ ▂ ▅ ▄ ▂ ▆ █                                 ← bars (above baseline = ochre/green)
  ─────────────────────────────────────────────  ← zero / baseline

  ▇ ▅                                            ← bars (below baseline = desaturated blue)
  ────────────────── ↓ underwater zone ──────────
  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ← blue tint fill (if baseline < target)
```

**Color rules:**

| Zone | Bar fill | Area fill |
|------|----------|-----------|
| Bar above target zone | `var(--signal-good)` green | — |
| Bar in target zone | `var(--ochre)` | — |
| Bar between baseline and target (above baseline but below target) | ochre desaturated | `rgba(200,160,80,0.08)` warm tint |
| Bar below baseline | `rgba(100,140,200,0.6)` blue | `rgba(100,140,200,0.08)` cool tint |
| Baseline is below target min | Entire chart area below target min gets persistent blue tint — "underwater" state |

**Underwater feel:** when `baseline_28d < target_min`, the space between the dashed baseline and the target floor line is filled with a cool blue gradient — deepening toward the bottom. This is a persistent, ambient state (not a flash or alert) that communicates "you're living below your target zone."

### Card-level underwater

When `signals_on_track < 3` (majority off-track), the MomentumCard background takes on a subtle cool blue wash: `background: linear-gradient(180deg, rgba(100,140,200,0.04) 0%, transparent 100%)`.

When trending well: neutral card background.

---

## Target Editing — UX Notes

- Targets are editable from `/goals` only. Not inline on the card.
- Dashboard MomentumCard has a small `Edit Goals →` text link.
- GoalsPage shows baseline + sparkline alongside target input so user can set realistic goals.
- Every `POST /api/goals` inserts a new row — previous targets are preserved in history.
- History timeline shows: target range, date set, notes. Useful for seeing how goals have evolved.
- Protein 180g and water 3L will be seeded as initial `health_goals` rows on migration. Hardcoded values removed from Trends components.

---

## Execution Order

> Do not start coding until HTML mockup is approved.

1. **Curl API** — pull 7 days of real values for all 6 signals from Railway
2. **HTML mockup** — `archive/momentum-mockup.html` with real data hard-coded; approve visual language before building
3. **DB migration** — `health_goals` table + seed initial targets
4. **Backend T22a** — `GET /api/momentum`, `GET /api/momentum/signals`, `GET /api/goals`, `POST /api/goals`, `GET /api/goals/{signal}/history`
5. **Frontend T22b** — `MomentumCard` (collapsed + expanded), remove `ReadinessCard`
6. **Frontend T22c** — `/goals` route (GoalsPage), `GoalDetailSheet`
7. **Wire protein/water** — remove hardcoded 180g/3L from Trends, read from `health_goals`

---

## Out of Scope (v1)

- No AI narrative on MomentumCard (can be added later via `/api/readiness` pattern)
- No workout frequency as a signal (data too sparse)
- No deep sleep % as a signal (data too sparse)
- No push notifications for off-track signals
- calories_in data reliability: include if daily_summary has ≥50% coverage for past 28 days, otherwise omit from v1 signal set
