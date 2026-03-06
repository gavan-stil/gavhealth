# Task 05b — Calendar Amendments

Purpose: Update the existing Calendar route to add Ride as a 6th category, effort/special markers on activity dots, updated sauna markers, and corrected sub-metrics across all categories.

---

## Scope Gate

**DOES:**
- Add Ride as a new category (colour #c4789a, rose)
- Add effort triangle marker (▲) to any "Let's Go" activity on the calendar grid
- Add sauna meditation marker (○ hollow circle) and devotions marker (▲) to sauna day cells
- Update sub-metrics per category to match confirmed spec
- Update `useCalendarData` hook to fetch ride data and effort/marker fields
- Update `DayDetailSheet` to show effort badge and sauna extras
- Update `ToggleBar` to include Ride pill
- Update `types/calendar.ts` with Ride and new marker fields

**DOES NOT:**
- Change the month grid layout or navigation
- Change the weekly summary column behaviour
- Change stats/patterns sections
- Touch Dashboard, Log, or Trends routes
- Add effort editing to the calendar (editing happens in Activity Feed — Task 06b)

---

## Pre-flight Checks

- [ ] Task 04b complete: backend has effort field on activities and sauna extras
- [ ] Task 05 complete: Calendar UI is fully built
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
  --dawn: #7FAABC; --blush: #d4a890; --ember: #c45a4a; --rose: #c4789a;
  --signal-good: #e8c47a; --signal-caution: #d4a04a; --signal-poor: #c47a6a;
}
```

---

## Type Changes — `src/types/calendar.ts`

### Add Ride to CategoryName

```typescript
export type CategoryName = "weight" | "sleep" | "heart" | "running" | "strength" | "ride" | "sauna";
```

### Add marker fields to CategoryDot

```typescript
export type CategoryDot = {
  category: CategoryName;
  color: string;
  duration?: string;
  subMetrics?: Record<string, string>;
  // New marker fields:
  isLetsGo?: boolean;         // true if effort === 'lets_go' — shows ▲ on dot
  isInterval?: boolean;        // true if run type is interval/tempo/sprint — shows ▲
  saunaHasMeditation?: boolean; // shows ○ on sauna dot
  saunaHasDevotion?: boolean;   // shows ▲ on sauna dot
};
```

### Update CATEGORY_COLORS

```typescript
export const CATEGORY_COLORS: Record<CategoryName, string> = {
  weight: "#e8c47a",
  sleep: "#7FAABC",
  heart: "#c4856a",
  running: "#b8a878",
  strength: "#b47050",
  ride: "#c4789a",   // NEW — rose
  sauna: "#c45a4a",
};
```

### Update CATEGORY_ORDER

```typescript
export const CATEGORY_ORDER: CategoryName[] = [
  "weight", "sleep", "heart", "running", "strength", "ride", "sauna"
];
```

### Update CATEGORY_LABELS

```typescript
export const CATEGORY_LABELS: Record<CategoryName, string> = {
  weight: "Weight", sleep: "Sleep", heart: "Heart",
  running: "Running", strength: "Strength", ride: "Ride", sauna: "Sauna",
};
```

### Update SUB_TOGGLE_DEFS

```typescript
export const SUB_TOGGLE_DEFS: Record<CategoryName, { id: string; label: string }[]> = {
  running: [{ id: "dist", label: "Dist" }, { id: "time", label: "Time" }, { id: "pace", label: "Pace" }],
  strength: [{ id: "sets", label: "Sets" }],
  ride: [{ id: "dist", label: "Dist" }, { id: "speed", label: "Speed" }],
  sleep: [{ id: "deep", label: "Deep%" }],
  heart: [{ id: "rhr", label: "RHR" }],
  weight: [{ id: "kg", label: "kg" }, { id: "delta", label: "Δ" }],
  sauna: [{ id: "mins", label: "Mins" }, { id: "temp", label: "Temp" }],
};
```

---

## Hook Changes — `src/hooks/useCalendarData.ts`

### Add ride fetch

Add a 6th parallel fetch for ride activities:

```typescript
const rideRes = await apiFetch<RideActivity[]>(`/api/data/activities?days=90&type=ride`);
```

### Ride activity shape

```typescript
type RideActivity = {
  date: string;
  name: string;
  duration_minutes?: number;
  avg_bpm?: number;
  distance_km?: number;
  avg_speed_kmh?: number;
  effort: string;
};
```

### Map ride to CategoryDot

```typescript
// For each ride activity on a given date:
{
  category: "ride",
  color: CATEGORY_COLORS.ride,
  duration: act.duration_minutes ? `${act.duration_minutes}m` : undefined,
  subMetrics: {
    ...(act.distance_km != null ? { dist: `${act.distance_km.toFixed(1)}km` } : {}),
    ...(act.avg_speed_kmh != null ? { speed: `${act.avg_speed_kmh.toFixed(1)}km/h` } : {}),
    ...(act.avg_bpm != null ? { bpm: `${act.avg_bpm}bpm` } : {}),
  },
  isLetsGo: act.effort === 'lets_go',
}
```

### Add effort and marker fields to existing activity mapping

**Running activities** — add isLetsGo and isInterval:
```typescript
const intervalKeywords = ['interval', 'tempo', 'sprint', 'repeat', 'fartlek'];
const isInterval = intervalKeywords.some(kw => act.name?.toLowerCase().includes(kw));
{
  category: "running",
  // ...existing fields...
  isLetsGo: act.effort === 'lets_go',
  isInterval,
}
```

**Strength activities** — add isLetsGo:
```typescript
{
  category: "strength",
  // ...existing fields...
  isLetsGo: act.effort === 'lets_go',
}
```

**Sauna activities** — add meditation/devotion markers:
```typescript
{
  category: "sauna",
  // ...existing fields...
  saunaHasMeditation: act.meditation_minutes != null && act.meditation_minutes > 0,
  saunaHasDevotion: act.devotions === true,
  isLetsGo: false,  // sauna doesn't use effort triangle
}
```

---

## MonthGrid Changes — `src/components/calendar/MonthGrid.tsx`

### Dot rendering — add markers

Each dot currently renders as a small coloured circle. Update the dot cell to show markers:

**Marker logic per dot:**
- ▲ (triangle up, 7px, same color as dot) if: `dot.isLetsGo === true` OR `dot.isInterval === true`
- ○ (hollow circle, 6px, stroke only) if: `dot.saunaHasMeditation === true`
- ▲ (triangle up) if: `dot.saunaHasDevotion === true`

Markers can stack — a sauna session with both meditation AND devotions shows ○ and ▲.

**Marker rendering approach:**
```tsx
// Below or beside the dot circle, render a small marker row
{(dot.isLetsGo || dot.isInterval) && (
  <span style={{ fontSize: 6, color: dot.color, lineHeight: 1 }}>▲</span>
)}
{dot.saunaHasMeditation && (
  <span style={{
    display: 'inline-block', width: 6, height: 6,
    borderRadius: '50%', border: `1px solid ${dot.color}`,
    lineHeight: 1
  }} />
)}
{dot.saunaHasDevotion && (
  <span style={{ fontSize: 6, color: dot.color, lineHeight: 1 }}>▲</span>
)}
```

Keep markers compact — they sit beneath the dot, max 2 rows.

---

## DayDetailSheet Changes — `src/components/calendar/DayDetailSheet.tsx`

### Show effort badge per activity

For each dot in the sheet, show an effort badge if the activity has effort data:

```tsx
// Effort badge colours:
// basic → var(--text-muted), no fill, subtle border
// mid → var(--text-tertiary), no fill
// lets_go → var(--ochre), filled

{dot.isLetsGo !== undefined && (
  <span style={{
    fontSize: 9,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    padding: '2px 6px',
    borderRadius: 'var(--radius-pill)',
    background: dot.isLetsGo ? 'var(--ochre)' : 'transparent',
    border: `1px solid ${dot.isLetsGo ? 'var(--ochre)' : 'var(--border-default)'}`,
    color: dot.isLetsGo ? 'var(--bg-base)' : 'var(--text-muted)',
    marginLeft: 'auto',
  }}>
    {dot.isLetsGo ? "Let's Go" : 'Mid'}
  </span>
)}
```

### Show sauna extras in detail sheet

When a sauna dot has meditation or devotions, show them in the detail section:

```tsx
{dot.category === 'sauna' && (dot.saunaHasMeditation || dot.saunaHasDevotion) && (
  <div style={{ paddingLeft: 16, display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
    {dot.saunaHasMeditation && dot.subMetrics?.meditation && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ /* hollow circle */ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', border: '1.5px solid var(--ember)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          Meditation · {dot.subMetrics.meditation}
        </span>
      </div>
    )}
    {dot.saunaHasDevotion && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 9, color: 'var(--ember)' }}>▲</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Devotions</span>
      </div>
    )}
  </div>
)}
```

---

## ToggleBar Changes — `src/components/calendar/ToggleBar.tsx`

Add Ride pill between Strength and Sauna in the category toggle list. Order:
Weight → Sleep → Heart → Running → Strength → Ride → Sauna

Ride pill active colour: `#c4789a` (rose).

---

## Sub-Metrics Reference (confirmed spec)

| Category | Sub-metrics shown |
|----------|------------------|
| All | Duration, Avg BPM |
| Running | Distance total, Time total, Pace |
| Strength | Total sets |
| Ride | Avg speed, Distance |
| Sleep | Deep % |
| Sauna | Duration (already captured) |
| Weekly column | Total time always |

---

## Done-When

- [ ] Ride appears as a 7th category pill in ToggleBar with rose colour (#c4789a)
- [ ] Ride dots appear on calendar days where ride activities exist
- [ ] ▲ marker appears beneath dots for any "Let's Go" activity (run, strength, ride)
- [ ] ▲ marker appears for interval/tempo/sprint runs (keyword match)
- [ ] ○ hollow circle marker appears for sauna sessions with meditation
- [ ] ▲ marker appears for sauna sessions with devotions
- [ ] Markers can stack (sauna with both shows both)
- [ ] DayDetailSheet shows effort badge (Let's Go = ochre filled, others = subtle)
- [ ] DayDetailSheet shows meditation duration and devotions label for sauna
- [ ] Running sub-metrics: distance, time, pace
- [ ] Strength sub-metrics: total sets
- [ ] Ride sub-metrics: avg speed, distance
- [ ] Sleep sub-metrics: deep %
- [ ] Weekly column still shows total time
- [ ] No TypeScript errors (`npm run build` succeeds)

---

## If Blocked

1. Try 3 different approaches
2. Document what was tried and what failed
3. Stop — do NOT keep looping
4. Report blocker to Gav with specifics

---

## After Completion

1. Move this file from `tasks/active/` to `tasks/done/`
2. Update `README.md`: Calendar → "Month grid with Ride, effort markers, sauna markers"
3. Add entry to `CHANGELOG.md`
4. Start next task: `tasks/active/06-log-flow.md`
