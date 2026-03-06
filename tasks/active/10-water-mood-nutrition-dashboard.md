# Task 10 — Water, Mood/Energy, Nutrition + Dashboard Revamp

Purpose: Add 4 new tracking features to the Log page and completely revamp the Dashboard with trend charts.

## Scope Gate

DOES:
- Create `WaterCard.tsx` — quick-add buttons, vessel visual, today's total + log list
- Create `MoodEnergyCard.tsx` — 5-emoji mood scale + 5-emoji energy scale, 2-col grid
- Create `NutritionCard.tsx` — calorie total vs target, macro progress bars (reads today's food logs)
- Add 3 new cards to `LogCards.tsx` accordion
- Add `POST /api/log/water` + `GET /api/water` endpoints to `new_endpoints.py`
- Add `POST /api/log/mood` + `GET /api/mood` endpoints to `new_endpoints.py`
- Create `useDashboardV2.ts` hook (parallel fetches for all dashboard data)
- Create `QuickStatsRow.tsx`, `ActivityChart.tsx`, `MoodEnergyChart.tsx`, `WaterNutritionChart.tsx`
- Revamp `DashboardPage.tsx` with new layout
- Create `archive/mockup-v2.html` for design inspection before wiring

DOES NOT:
- Change Calendar or Trends pages
- Modify backend schema (SQL statements are in new_endpoints.py as comments only)
- Add blended/overlay charts (deferred to later)
- Add configurable water/calorie targets (hardcoded for now)

## Pre-flight Checks
- [ ] `npm run build` passes before starting
- [ ] `src/styles/tokens.css` color values confirmed (already read)
- [ ] `new_endpoints.py` existing endpoints confirmed (already read)

## Design Tokens (inline)

```css
--bg-base: #0d0d0a;
--bg-card: #14130f;
--bg-elevated: #1e1d18;
--border-default: #222018;
--text-primary: #f0ece4;
--text-secondary: #b0a890;
--text-muted: #7a7060;
--ochre: #d4a04a;
--gold: #e8c47a;
--dawn: #7FAABC;   /* water */
--rust: #b47050;   /* strength */
--ember: #c45a4a;  /* sauna */
--sand: #b8a878;   /* run */
--signal-good: #e8c47a;
--signal-poor: #c47a6a;
--radius-sm: 8px; --radius-md: 14px; --radius-lg: 20px; --radius-pill: 100px;
--space-xs: 4px; --space-sm: 8px; --space-md: 14px; --space-lg: 20px;
```

Typography:
- `.stat-number` — JetBrains Mono 28px 800 weight -1.5px tracking (data values)
- `.label-text` — Inter 10px 600 uppercase 1.2px tracking
- `.section-head` — Inter 16px 700 -0.5px tracking

## API Endpoints (inline)

Existing (verified):
- `GET /api/activities/feed?days=14` → `[{ id, type, date, start_time, duration_minutes, avg_bpm, effort }]`
- `GET /api/food?days=14` → food log entries (shape TBD from existing FoodCard response)
- `GET /api/readiness` → `{ score, components, narrative }`

New (to add):
- `POST /api/log/water` body `{ ml: number, logged_at?: string }` → `{ id, logged_at, ml }`
- `GET /api/water?days=N` → `[{ id, logged_at, ml }]`
- `POST /api/log/mood` body `{ mood: 1-5, energy: 1-5, logged_at?: string }` → `{ id, logged_at, mood, energy }`
- `GET /api/mood?days=N` → `[{ id, logged_at, mood, energy }]`

Note: Verify food endpoint response shape by reading FoodCard or api.md before wiring NutritionCard.

## Components to Build

### WaterCard.tsx
- Card header: water drop SVG icon (`--dawn`) + "Water Intake" + today's total (`.small-number`)
- Quick-add pills: 250ml / 500ml / 750ml / 1000ml (border-radius pill, border `--border-default`, text `--dawn`)
- Vessel visual: 52w × 88h px rectangle, border 2px `--dawn`, bg `--bg-base`, animated fill (gradient blue)
- Below vessel: total `x ml` (`.stat-number`, `--ochre`) + "of 3,000 ml" (`--text-muted`)
- Log list: timestamp (`.small-number`, `--text-muted`) + "250 ml" right-aligned
- POST to `/api/log/water` on quick-add; GET `/api/water?days=1` on mount
- States: loading → error → data (standard 3-state)

### MoodEnergyCard.tsx
- Card header: Smile icon (lucide-react, `--ochre`) + "Mood & Energy"
- 2-col grid: left "Mood" + right "Energy"
- Each column: small label + row of 5 emoji buttons (40px × 40px, border 1px `--border-default`, radius-sm)
- Mood emoji: 😞 😕 😐 🙂 😄 (index 1–5)
- Energy emoji: 🪫 😴 ⚡ 🔥 💥 (index 1–5)
- Active state: border → `--ochre`, transform scale(1.15), opacity 1; inactive opacity 0.45
- Save button: "Save" (primary, `--ochre` bg, white text) — enabled only when both selected
- POST `/api/log/mood`; GET `/api/mood?days=1` on mount to show today's existing scores
- States: empty → saving → confirmed (show selected scores + Check icon)

### NutritionCard.tsx
- Card header: BarChart2 icon (lucide-react, `--gold`) + "Today's Nutrition"
- On mount: GET `/api/food` or similar to aggregate today's macros (determine exact endpoint)
- Calorie total: `.stat-number` `--ochre` + " kcal" + "of 2,358 target" (`--text-muted`)
- Progress bar: full width, 8px height, border-radius pill, gradient `--signal-good` → `--ochre`
- 3 macro rows: label (PROTEIN / CARBS / FAT, `.label-text`) + bar + "Xg" (`.small-number`)
- Empty state: "No food logged yet — use Food Log above"
- Loading/error standard states

### ActivityChart.tsx (recharts)
- recharts `BarChart` stacked
- Data: 14-day window from `/api/activities/feed?days=14`
- Transform: group by date, count per type (run, strength/workout, ride, sauna)
- 4 bar series: Run (`--sand`), Strength (`--rust`), Ride (`--dawn`), Sauna (`--ember`)
- X-axis: "Mon 3" format, `--text-muted`, 10px
- Y-axis: hidden (counts visible in bars)
- Horizontal scroll wrapper for mobile
- Chart height: 160px

### MoodEnergyChart.tsx (recharts)
- recharts `LineChart`, 2 lines
- Data: 30-day from `/api/mood?days=30`
- Mood line: `--ochre`, dot 6px, strokeWidth 2, type="monotone"
- Energy line: `--gold`, dot 6px, strokeWidth 2, type="monotone"
- Y-axis: 1–5 domain, `--text-muted`, 10px
- X-axis: date labels, `--text-muted`, 10px
- Horizontal scroll wrapper
- Chart height: 160px

### WaterNutritionChart.tsx (recharts)
- recharts `ComposedChart`
- Bar: daily water ml (`--dawn`, left Y-axis, opacity 0.8)
- Line: daily calories (`--ochre`, right Y-axis, strokeWidth 2)
- Data: 14-day from `/api/water?days=14` + `/api/food?days=14`
- Horizontal scroll wrapper
- Chart height: 160px

### QuickStatsRow.tsx
- 2×2 grid of stat tiles (gap `--space-sm`)
- Tiles: Mood (Smile icon), Energy (Zap icon), Water (drop SVG), Calories (UtensilsCrossed icon)
- Each: icon + value + label, bg `--bg-elevated`, border `--border-default`, radius-md, padding `--space-md`
- Tap → navigate to `/log` (react-router useNavigate)
- Values from `todayStats` prop

### DashboardPage.tsx layout
```
pull-to-refresh wrapper
  QuickStatsRow
  ReadinessCard
  ActivityChart (card wrapper)
  MoodEnergyChart (card wrapper)
  WaterNutritionChart (card wrapper)
  <details> collapsed:
    <summary>More stats</summary>
    VitalsCard
    StreaksCard
```

## Mock Data (inline)

Activity feed (last 14 days, one per day):
```json
[
  {"type":"run","date":"2026-03-06","duration_minutes":35},
  {"type":"strength","date":"2026-03-05","duration_minutes":55},
  {"type":"sauna","date":"2026-03-05","duration_minutes":20},
  {"type":"ride","date":"2026-03-04","duration_minutes":45},
  {"type":"strength","date":"2026-03-03","duration_minutes":60}
]
```

Mood data:
```json
[
  {"logged_at":"2026-03-06","mood":4,"energy":4},
  {"logged_at":"2026-03-05","mood":3,"energy":3},
  {"logged_at":"2026-03-04","mood":5,"energy":5}
]
```

Water data (daily totals):
```json
[
  {"date":"2026-03-06","total_ml":1750},
  {"date":"2026-03-05","total_ml":2500},
  {"date":"2026-03-04","total_ml":3000}
]
```

## Done-When
- [ ] `open archive/mockup-v2.html` — design looks correct in browser
- [ ] WaterCard renders with vessel animation, quick-add works
- [ ] MoodEnergyCard saves mood + energy, shows confirmed state
- [ ] NutritionCard shows today's food macros (or empty state if none)
- [ ] All 3 new cards present in LogCards accordion
- [ ] Dashboard shows QuickStatsRow + ReadinessCard + 3 charts + collapsed section
- [ ] `npm run build` passes with 0 TypeScript errors

## If Blocked
1. Try 3 different approaches
2. Document what was tried and what failed
3. Stop — do NOT keep looping
4. Report the blocker with specifics

## After Completion
1. Move this file from `tasks/active/` to `tasks/done/`
2. Update `STATUS.md` active task → "None"
3. Add entry to `CHANGELOG.md`
4. Update `README.md` if any route status changed
