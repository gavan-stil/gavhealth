# T15 Sprint — Trends Redesign: Energy Balance + Strength Quality

> Started: 2026-03-10
> Status: 🟡 In Progress
> Depends on: T14 complete ✅

---

## Why We're Building This

The current Trends page is a data dump — 7 separate cards with no cross-card narrative.
The two most actionable questions for the current training/nutrition phase are:

1. **"Is my calorie deficit actually moving my weight?"** — visible only if food intake,
   training output, and weight are on the same axis.

2. **"Is my strength capacity improving?"** — visible as HR dropping for the same volume
   over time.

These two charts replace CorrelationSummary (text-only, same info) and give the page
a narrative spine.

---

## Legend

- `[ ]` — pending
- `[~]` — in progress
- `[x]` — done
- `[B]` — blocked (reason noted)

---

## Tasks

### T15-1 — Energy Balance Chart

**What:** Daily bars for calories eaten (ochre) + active calories burned (dawn),
weight trend line overlay (clay), training since Mar 7.

**Why:** Only way to see if "eating less → weight dropping" without a spreadsheet.
Shows feedback loop visually. Inspired by Garmin Connect energy balance view.

**Component:** `src/components/trends/EnergyBalanceChart.tsx`
**Hook:** no new hook needed — fetch in component via `apiFetch`

#### Sub-tasks

- [ ] **T15-1a** — HTML mockup (`archive/trends-energy-balance-mockup.html`) — APPROVED FIRST
- [ ] **T15-1b** — New endpoint `GET /api/energy-balance?days=N`
  - Returns daily: `{ date, calories_in, protein_g, calories_burned_total, weight_kg | null }`
  - `calories_in`: sum of `food_logs.calories_kcal` by `log_date`
  - `protein_g`: sum of `food_logs.protein_g` by `log_date` (user priority metric)
  - `calories_burned_total`: `activity_logs.calories_burned` WHERE `activity_type = 'daily_summary'`
    — Withings TDEE (includes basal + all movement, already calculated by device hardware)
    — Single row per day; use NULL if no daily_summary for that day
    — NOTE: do NOT sum workout active calories here — `daily_summary` already includes them
  - `weight_kg`: latest `weight_logs` reading for that date (or null)
  - Only returns days where `food_logs` has entries (starts Mar 7)
  - Curl test: `curl /api/energy-balance?days=14`
- [ ] **T15-1c** — React component `EnergyBalanceChart.tsx`
  - Week/Month toggle (7 or 30 days)
  - Grouped bars: intake (ochre) + burn (dawn) — both on left y-axis
    - Burn = `calories_burned_total` (Withings TDEE); omit burn bar if null for that day
  - Weight as smooth SVG polyline, right y-axis
  - Summary row (protein FIRST — user priority): avg protein · avg intake · avg burn · net · weight Δ
    - Protein cell: "Avg Xg / 180g" coloured green if ≥ 180g, ochre if below
  - "Tracking from Mar 7" label when showing ≥ date of first food log
  - Graceful: < 3 days data → "Keep logging food to see your trend"
- [ ] **T15-1d** — Wire into TrendsPage, replace CorrelationSummary

#### Curl tests (run after T15-1b deployed)

```bash
# Primary endpoint
curl -s "https://gavhealth-production.up.railway.app/api/energy-balance?days=14" \
  -H "X-API-Key: gavhealth-prod-api-2026-xK9mP3" | python3 -m json.tool

# Verify food aggregation (Mar 7 onwards)
curl -s "https://gavhealth-production.up.railway.app/api/food?days=7&limit=200" \
  -H "X-API-Key: gavhealth-prod-api-2026-xK9mP3" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); entries=d.get('data',d); by_day={}; \
  [by_day.update({e['log_date']: by_day.get(e['log_date'],0) + (e.get('calories_kcal') or 0)}) for e in entries]; \
  print(json.dumps(by_day, indent=2))"

# Verify active calories (exclude daily_summary)
curl -s "https://gavhealth-production.up.railway.app/api/activity?days=7&limit=200" \
  -H "X-API-Key: gavhealth-prod-api-2026-xK9mP3" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); acts=d.get('data',[]); by_day={}; \
  [by_day.update({a['activity_date']: by_day.get(a['activity_date'],0) + (a.get('calories_burned') or 0)}) \
  for a in acts if a['activity_type'] not in ('daily_summary','other')]; \
  print(json.dumps(by_day, indent=2))"

# Verify weight data
curl -s "https://gavhealth-production.up.railway.app/api/weight?days=14" \
  -H "X-API-Key: gavhealth-prod-api-2026-xK9mP3" | python3 -m json.tool | head -30
```

#### Data quirks documented

- `daily_summary` activity type = Withings TDEE (whole day, includes basal + all movement)
  — USE THIS as `calories_burned_total`. One row per day. Already calculated by Withings hardware.
- Do NOT sum `workout` or other activity_type rows for burn — `daily_summary` already includes them.
- `other` activity type can have inflated values (travel days 7095 cal etc.) — irrelevant, not used.
- Some activities have `calories_burned: null` — treat as 0
- Food tracking started 2026-03-07 — chart gracefully shows "from Mar 7" label
- Weight logged most days but not every day — interpolate or just show dots

---

### T15-2 — Strength Quality Scatter

**What:** Scatter plot of strength sessions — X = total volume (kg), Y = avg HR.
Shows cardiovascular adaptation: same volume → lower HR = getting fitter.

**Why:** Gives meaning to the load numbers. Currently "14,217 kg" is just a number.
With HR context it becomes "14,217 kg at 97 BPM — will that HR drop over time?"

**Component:** `src/components/trends/StrengthQualityChart.tsx`

#### Sub-tasks

- [ ] **T15-2a** — HTML mockup (same file as T15-1a)
- [ ] **T15-2b** — Fix sessions API to return `date` field
  - Bug: `GET /api/strength/sessions` returns `date: null` for all sessions
  - Need to check `new_endpoints.py` sessions query and ensure `session_date` or
    `started_at` is aliased to `date` in response
  - Curl test: `curl /api/strength/sessions?days=90` — all sessions should have non-null `date`
- [ ] **T15-2c** — React component `StrengthQualityChart.tsx`
  - SVG scatter, each dot = one session
  - Color by category (push=ochre, pull=dawn, legs=clay, abs=sand, mixed=rust)
  - Dot size = total_sets (min 8px, max 20px)
  - X-axis: load in tonnes (e.g. 14.2t) for readability
  - Empty state: "< 5 sessions with HR data" → "Keep lifting to see trends"
    (currently 2/5 sessions have HR — show stub)
- [ ] **T15-2d** — Wire into TrendsPage, after WorkoutVolumeChart

#### Curl tests

```bash
# Sessions with date field (should be non-null after T15-2b fix)
curl -s "https://gavhealth-production.up.railway.app/api/strength/sessions?days=90" \
  -H "X-API-Key: gavhealth-prod-api-2026-xK9mP3" | \
  python3 -c "import json,sys; sessions=json.load(sys.stdin); \
  print(json.dumps([{'date':s.get('date'),'load_kg':s.get('total_load_kg'),'hr':s.get('avg_hr'),'sets':s.get('total_sets')} for s in sessions], indent=2))"
```

---

### T15-3 — Run HR Zones (BLOCKED — backend first)

**What:** Stacked horizontal bar per run — time in zones 1-5.

**Why:** Shows training quality distribution. Are all runs easy recovery pace,
or are some sessions pushing zone 4-5?

**Status:** 🔴 BLOCKED — `activity_logs.hr_zone_*` columns always NULL.
Withings API provides zone data in workout payload but sync doesn't populate it.

**Backend work needed (separate task, probably T16):**
1. Update `withings.py` sync to read `hr_zone_0/1/2/3/4` from workout API payload
2. Store in `activity_logs` (columns already exist from earlier migration)
3. Re-sync or backfill last 90 days of runs

**Curl to check current state:**
```bash
curl -s "https://gavhealth-production.up.railway.app/api/activity?days=30&limit=200" \
  -H "X-API-Key: gavhealth-prod-api-2026-xK9mP3" | \
  python3 -c "import json,sys; acts=json.load(sys.stdin).get('data',[]); \
  runs=[a for a in acts if a['activity_type']=='run']; \
  print(json.dumps(runs[:3], indent=2))"
```
If `hr_zone_0` (or similar) appears in run records → backend is done, unblock T15-3.

---

### T15-4 — Remove CorrelationSummary

- [ ] Remove `<CorrelationSummary />` from `TrendsPage.tsx` (replaced by EnergyBalanceChart)
- [ ] Review `PerformanceOverlay` — check if it duplicates Dashboard readiness info
  - If so, remove it
  - If unique, keep and consider repositioning

---

## TrendsPage order after T15

```
RecoverySparklines          (keep — compact)
EnergyBalanceChart          (new T15-1 — flagship)
NutritionTrendsChart        (keep — protein weekly)
WorkoutVolumeChart          (keep — weekly volume)
StrengthQualityChart        (new T15-2 — scatter)
ExerciseProgressSection     (keep — by body part)
WaterTrendsChart            (keep)
[RunHRZonesChart]           (future T15-3 — blocked)
```

---

## Design tokens used

```
--ochre           (#d4a04a)  calories in bars
--dawn            (#7FAABC)  calories burned bars
--clay            (#c4856a)  weight line + scatter legs
--rust            (#b47050)  scatter mixed
--sand            (#b8a878)  scatter abs
--text-primary    (#f0ece4)  axis values
--text-muted      (#7a7060)  axis labels
--bg-card         (#14130f)  chart background
--border-default  (#222018)  grid lines
```

---

## Acceptance criteria

- [ ] Energy Balance: 4+ days of real food + activity data shows correctly
- [ ] Energy Balance: days with missing food show as empty (no bar for that day)
- [ ] Energy Balance: burn bar absent (not zero) when no daily_summary for a day
- [ ] Energy Balance: weight line interpolates smoothly between readings
- [ ] Energy Balance: summary row shows protein avg + colour (green ≥ 180g, ochre below)
- [ ] Strength scatter: all sessions have dates (bug T15-2b fixed)
- [ ] Strength scatter: 2 sessions with HR render as coloured dots
- [ ] `npm run build` passes
- [ ] No regressions on Dashboard, Calendar, Log pages

---

## Done

(none yet)
