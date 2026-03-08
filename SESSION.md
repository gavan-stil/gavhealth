# Session — T14 Item 3: Calendar bars + split icons

> Status: Mockup APPROVED. Ready to build production code.

---

## What's approved

Mockup: `archive/mockup-calendar-item3.html` — review it if needed.

Design decisions (all approved):
- **Full-width activity bars** — `height: 14px`, `border-radius: 3px`, colored fill, text+icon inside
- **Split icons inside bar** — solid ▲ push, ▼ pull, // legs (monospace, `font-weight: 700`)
- **Continuous vertical month scroll** — months stack as `div.month-block`, oldest at top
- **"Load previous month" button** — sticky at top, prepends month block without scroll jump
- **Sticky month labels** — `top: 43px` (below button bar)
- **WK column toggle** — "Wk" button in top bar; hides `.wk-col` + collapses grid to `repeat(7,1fr)`
- **WK summary pills** — outline-only (no fill), same shape as bars, `border: 1px solid <color>`, colored text (e.g. "1h35 str", "13km run")

---

## Production implementation plan

### Step 1 — curl-verify workout_split

Check if `/api/activity` already returns `workout_split`. It almost certainly doesn't — need to add it.

```bash
curl -s "https://gavhealth-production.up.railway.app/api/activity?limit=5" \
  -H "X-API-Key: $API_KEY" | jq '.[0]'
```

If missing → backend: add `workout_split` to activity query (join `strength_sessions` → `workout_split` col).
Update `reference/api.md` with actual shape before touching frontend.

### Step 2 — Types (`src/types/calendar.ts`)

Add to `CategoryDot`:
```ts
workoutSplit?: 'push' | 'pull' | 'legs'
```

### Step 3 — Hook (`src/hooks/useCalendarData.ts`)

- Change from single-month fetch to multi-month: store array of `{ year, month, data }` blocks
- `loadPrevMonth()` action: prepend a new month block
- Map `workout_split` from API response onto strength `CategoryDot`

### Step 4 — MonthGrid (`src/components/calendar/MonthGrid.tsx`)

Major changes:
- Grid: `repeat(7, 1fr) 50px` → add WK column (toggle-able)
- `minHeight: 48px` → `72px`
- Replace dot circles with `.act-bar` full-width bars
- Strength bars: include split icon (▲/▼//) prefix
- WK column: outline pills per activity type
- WK toggle button state (local state, no persistence needed)

### Step 5 — Calendar page (`src/pages/Calendar.tsx` or similar)

- Remove month prev/next buttons (or keep for now, they can coexist temporarily)
- Add "Load previous month" sticky button at top
- Scroll to current month on load

---

## Key file paths

| File | Role |
|------|------|
| `src/types/calendar.ts` | `CategoryDot` type — add `workoutSplit` |
| `src/hooks/useCalendarData.ts` | Data fetch — extend to multi-month |
| `src/components/calendar/MonthGrid.tsx` | Grid render — full rewrite of cell/bar logic |
| `src/components/calendar/` | Check for other calendar sub-components |
| `reference/api.md` | Update with `workout_split` field once curl-verified |

---

## Existing toggles to preserve

The production calendar already has sleep/sauna visibility toggles. These must carry through — don't break them when rewriting MonthGrid. Check exactly where they live before touching anything.

---

## Done when

- `npm run build` passes
- Calendar shows full-width bars with split icons on real data
- WK column toggles on/off
- "Load previous month" prepends correctly without scroll jump
- Sleep/sauna toggles still work
