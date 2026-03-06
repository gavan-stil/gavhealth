# Task 06 — Log Flow (UI Only) — REVISED

Purpose: Build the Log route with 4 logging cards and an Activity Feed sub-tab. Strength card is a full workout logger with split recall. Sauna card includes meditation and devotions toggles. No API wiring — mock data only.

---

## Scope Gate

**DOES:**
- Create `/log` route with 2 sub-tabs: "Log" and "Activity"
- Build Food card (NLP text input → mock parsed result → confirm)
- Build Strength card — full workout logger (split selector, exercise cards, set rows, brain dump fallback)
- Build Sauna card (duration + temperature + meditation toggle + devotions toggle)
- Build Habits card (checkbox grid)
- Implement 5 card states: empty → parsing → parsed → confirmed → error
- Build Activity Feed sub-tab (mock data, effort badges, effort selector UI)
- Use inline mock data throughout — no API calls

**DOES NOT:**
- Call any API endpoints (that's Task 07)
- Persist any data
- Build edit/delete for past entries
- Touch Dashboard, Calendar, or Trends routes

---

## Pre-flight Checks

- [ ] Task 05b complete (or at minimum Task 02 — Log route exists from Task 01)
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
  --space-xs: 4px; --space-sm: 8px; --space-md: 14px; --space-lg: 20px; --space-xl: 32px;
  --radius-sm: 8px; --radius-md: 14px; --radius-lg: 20px; --radius-pill: 100px;
  --ease-settle: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 120ms; --duration-normal: 200ms; --duration-slow: 400ms;
}
```

### Typography
```
.section-head { font: 700 16px/1.2 'Inter', sans-serif; letter-spacing: -0.5px; }
.body-text    { font: 400 14px/1.5 'Inter', sans-serif; }
.small-number { font: 600 14px/1 'JetBrains Mono', monospace; letter-spacing: -0.5px; }
.label-text   { font: 600 10px/1 'Inter', sans-serif; letter-spacing: 1.2px; text-transform: uppercase; }
.stat-number  { font: 800 28px/1 'JetBrains Mono', monospace; letter-spacing: -1.5px; }
```

---

## Mock Data — `src/mocks/log.ts`

```typescript
export const MOCK_PARSED_FOOD = {
  items: [
    { name: "Chicken breast", calories: 280, protein_g: 52 },
    { name: "Brown rice", calories: 220, protein_g: 5 },
    { name: "Broccoli", calories: 40, protein_g: 3 },
  ],
  total_calories: 540,
};

export const MOCK_LAST_PUSH_SESSION = {
  date: "2026-03-01",
  exercises: [
    {
      name: "Bench Press",
      superset: false,
      sets: [
        { load_type: "kg", kg: 80, reps: 8 },
        { load_type: "kg", kg: 85, reps: 6 },
        { load_type: "kg", kg: 85, reps: 5 },
      ],
    },
    {
      name: "Incline DB Press",
      superset: false,
      sets: [
        { load_type: "kg", kg: 30, reps: 10 },
        { load_type: "kg", kg: 32, reps: 8 },
      ],
    },
    {
      name: "OHP",
      superset: false,
      sets: [
        { load_type: "kg", kg: 60, reps: 8 },
        { load_type: "kg", kg: 60, reps: 7 },
      ],
    },
  ],
};

export const MOCK_ACTIVITY_FEED = [
  {
    id: 1,
    type: "run",
    name: "Morning Run",
    date: "2026-03-04",
    duration_minutes: 42,
    avg_bpm: 158,
    distance_km: 7.2,
    pace_min_km: "5:49",
    effort: "mid",
    effort_is_default: true,
  },
  {
    id: 2,
    type: "strength",
    name: "Strength Training",
    date: "2026-03-03",
    duration_minutes: 58,
    avg_bpm: 134,
    total_sets: 18,
    workout_split: "push",
    effort: "lets_go",
    effort_is_default: false,
  },
  {
    id: 3,
    type: "sauna",
    name: "Sauna Session",
    date: "2026-03-03",
    duration_minutes: 25,
    avg_bpm: 112,
    meditation_minutes: 10,
    devotions: true,
    effort: "mid",
    effort_is_default: true,
  },
  {
    id: 4,
    type: "ride",
    name: "Afternoon Ride",
    date: "2026-03-02",
    duration_minutes: 65,
    avg_bpm: 145,
    distance_km: 28.4,
    avg_speed_kmh: 26.2,
    effort: "basic",
    effort_is_default: false,
  },
];
```

---

## Component Specs

### 1. `src/pages/LogPage.tsx` — Sub-tab shell

Two sub-tabs at the top of the page:

```tsx
// Sub-tab bar
<div style={{
  display: 'flex',
  gap: 'var(--space-xs)',
  padding: 'var(--space-md) var(--space-lg) 0',
  borderBottom: '1px solid var(--border-default)',
}}>
  <button
    onClick={() => setActiveTab('log')}
    style={{
      padding: '8px 16px',
      borderRadius: 'var(--radius-pill) var(--radius-pill) 0 0',
      background: activeTab === 'log' ? 'var(--bg-elevated)' : 'transparent',
      border: 'none',
      color: activeTab === 'log' ? 'var(--text-primary)' : 'var(--text-muted)',
      font: '600 13px/1 Inter, sans-serif',
      cursor: 'pointer',
    }}
  >Log</button>
  <button
    onClick={() => setActiveTab('activity')}
    style={{ /* same styling, activeTab === 'activity' */ }}
  >Activity</button>
</div>

{activeTab === 'log' && <LogCards />}
{activeTab === 'activity' && <ActivityFeed />}
```

### 2. `src/components/log/LogCards.tsx`

Vertical stack of 4 collapsible cards, accordion (one open at a time).
`padding: var(--space-lg)`, `gap: var(--space-md)`.

Card header: icon + title + ChevronDown/Up (lucide) — toggles collapse.

### 3. Card State Machine (Food and Strength)

```
empty → (submit) → parsing → parsed → (confirm) → confirmed → (2s) → empty
                      ↓                    ↓
                    error                error
```

- **Empty:** input visible, submit button active
- **Parsing:** input disabled, button pulsing animation ("Parsing…"), setTimeout 1500ms → parsed
- **Parsed:** result shown, Confirm + Edit buttons
- **Confirmed:** green check icon + "Logged!", auto-reset after 2s
- **Error:** AlertTriangle icon + message + "Try again" button

Sauna and Habits skip parsing — go empty → confirmed directly.

### 4. `src/components/log/FoodCard.tsx`

- Icon: `UtensilsCrossed` (lucide), `var(--gold)`
- Textarea placeholder: "e.g. chicken breast 200g, rice 150g, broccoli"
- "Parse" button: bg `var(--ochre)`, text `var(--bg-base)`
- Parsed state: item list (name / calories / protein) + total calories in `stat-number` ochre
- Confirm + Edit buttons

### 5. `src/components/log/StrengthCard.tsx` — FULL WORKOUT LOGGER

This is the most complex card. Full spec below.

**Header row:**
- Icon: `Dumbbell` (lucide), `var(--rust)`
- Title: "Strength"
- Two input modes toggled by a small pill: "Builder" | "Brain Dump"

**Builder mode (default):**

Split selector — 4 pills: Push / Pull / Legs / Abs
```tsx
// Active pill: bg var(--rust), text var(--bg-base)
// Inactive: border var(--border-default), text var(--text-muted)
```

"Load last [Push] session" button — appears once split is selected, shows date of last session:
```tsx
<button onClick={loadLastSession}>
  Load last Push · 1 Mar
</button>
// Style: ghost button, text var(--ochre), border var(--border-default)
// Uses MOCK_LAST_PUSH_SESSION in Task 06, real API in Task 07
```

**Exercise cards** — rendered list of `wlExercise` objects:

Each exercise card:
```
┌─────────────────────────────────────────┐
│ [Exercise name input]         [SS] [✕]  │
│ ─────────────────────────────────────── │
│ 1  [kg▼]  [−] 80 [+] kg   [−] 8 [+] reps  [✕] │
│ 2  [kg▼]  [−] 85 [+] kg   [−] 6 [+] reps  [✕] │
│ + Add Set                               │
└─────────────────────────────────────────│
```

- Exercise name: text input, `var(--text-primary)`, `font-weight: 600`
- SS badge: toggles superset — when active shows gold "SS" badge, card gets left border `var(--ember)`
- Load type selector: dropdown or pills — kg / BW / BW+
  - BW: hides kg stepper, shows "bodyweight" label
  - BW+: shows kg stepper labelled "extra kg"
- Kg stepper: − / value / + in 2.5kg increments, min 0
- Reps stepper: − / value / + in 1 rep increments, min 1
- Remove set: ✕ button, disabled (opacity 0.3) if only 1 set
- "Add Set": copies previous set's values as default for new set

Below exercise list:
```tsx
<button onClick={addExercise}>+ Add Exercise</button>
```

Session time inputs (below exercises):
```
Start time: [time input]    Duration: [−] 55 [+] min
```
- Duration stepper: 5 min increments, min 5, max 300
- Start time: HTML time input, defaults to current time

Submit: "Save Session" button, bg `var(--rust)`

**Brain Dump mode:**
- Single textarea: "e.g. bench press 80kg x8 x3, squat 100kg x5 x4, OHP 60kg x8 x3"
- "Parse" button → parsing animation (1500ms mock) → shows structured exercise cards in parsed state
- Same confirm flow as Food card

**TypeScript types for workout state:**
```typescript
type LoadType = 'kg' | 'bw' | 'bw+';

type WorkoutSet = {
  load_type: LoadType;
  kg: number;
  reps: number;
};

type WorkoutExercise = {
  name: string;
  superset: boolean;
  sets: WorkoutSet[];
};
```

### 6. `src/components/log/SaunaCard.tsx` — UPDATED

- Icon: `Thermometer` (lucide), `var(--ember)`
- Duration input (minutes) + Temperature input (°C) — as before
- **NEW: Meditation toggle row**
  ```tsx
  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
    <span style={{ /* hollow circle icon */ width: 14, height: 14, borderRadius: '50%',
      border: '1.5px solid var(--ember)', display: 'inline-block' }} />
    <span style={{ font: '400 13px Inter', color: 'var(--text-secondary)' }}>Meditation</span>
    <input
      type="checkbox"
      checked={hasMeditation}
      onChange={e => setHasMeditation(e.target.checked)}
      // custom styled checkbox
    />
    {hasMeditation && (
      <input
        type="number"
        value={meditationMinutes}
        onChange={e => setMeditationMinutes(Number(e.target.value))}
        placeholder="mins"
        style={{ width: 54, /* small-number font */ }}
      />
    )}
  </div>
  ```
- **NEW: Devotions toggle row**
  ```tsx
  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
    <span style={{ fontSize: 10, color: 'var(--ember)' }}>▲</span>
    <span style={{ font: '400 13px Inter', color: 'var(--text-secondary)' }}>Devotions</span>
    <input type="checkbox" checked={hasDevotion} onChange={...} />
  </div>
  ```
- Custom checkbox styling: 20px square, border `var(--border-default)`, checked: bg `var(--ember)`
- Submit: "Log Sauna" → confirmed directly (no parse step)

### 7. `src/components/log/HabitsCard.tsx`

- Icon: `CheckSquare` (lucide), `var(--ochre)`
- 2×2 checkbox grid: Stretching, Meditation (general habit), Cold Shower, Supplements
- Custom checkbox: 24px square, checked bg `var(--ochre)`, white checkmark
- "Log Habits" → confirmed directly

> Note: This "Meditation" habit is a general daily habit checkbox, separate from the sauna-specific meditation toggle. No conflict.

### 8. `src/components/log/ActivityFeed.tsx`

Scrollable list of recent activities (14 days). Uses `MOCK_ACTIVITY_FEED`.

**Feed item layout:**
```
┌────────────────────────────────────────────────┐
│  [type dot]  Morning Run          [Mid ·]       │
│              Tue 4 Mar · 42m · 158bpm           │
│              7.2km · 5:49/km                    │
└────────────────────────────────────────────────┘
```

- Type dot: 10px circle, category colour (run=#b8a878, strength=#b47050, ride=#c4789a, sauna=#c45a4a)
- Activity name: `section-head`, `var(--text-primary)`
- Effort badge (top right):
  - "Let's Go": bg `var(--ochre)`, text `var(--bg-base)`, filled pill
  - "Mid" (default/unreviewed): border `var(--border-default)`, text `var(--text-muted)`, subtle dot indicator showing it's system-defaulted
  - "Basic": border `var(--border-default)`, text `var(--text-muted)`
  - Unreviewed indicator: small ochre dot in top-right corner of badge
- Stats line: duration, avg BPM, type-specific stats (`small-number`, `var(--text-secondary)`)
- Sauna extras: show ○ and/or ▲ markers if meditation/devotions present

**Effort editor (tap to open):**

Tapping an activity row expands an inline effort selector:
```tsx
<div style={{
  display: 'flex', gap: 'var(--space-sm)',
  padding: 'var(--space-sm) 0',
  borderTop: '1px solid var(--border-default)',
}}>
  {(['basic', 'mid', 'lets_go'] as const).map(level => (
    <button
      key={level}
      onClick={() => setEffort(item.id, level)}
      style={{
        flex: 1,
        padding: '6px 0',
        borderRadius: 'var(--radius-pill)',
        border: `1px solid ${item.effort === level ? 'var(--ochre)' : 'var(--border-default)'}`,
        background: item.effort === level ? 'var(--ochre)' : 'transparent',
        color: item.effort === level ? 'var(--bg-base)' : 'var(--text-muted)',
        font: '600 11px/1 Inter, sans-serif',
        cursor: 'pointer',
      }}
    >
      {level === 'basic' ? 'Basic' : level === 'mid' ? 'Mid' : "Let's Go"}
    </button>
  ))}
</div>
```

In Task 06 (UI only): effort changes update local state only.
In Task 07: effort changes call `PATCH /api/activities/:id/effort`.

---

## File Structure

```
src/
├── mocks/
│   └── log.ts                          (new)
├── components/
│   └── log/
│       ├── LogCards.tsx                (new — accordion wrapper)
│       ├── FoodCard.tsx                (new)
│       ├── StrengthCard.tsx            (new — full workout logger)
│       ├── SaunaCard.tsx               (new — with meditation/devotions)
│       ├── HabitsCard.tsx              (new)
│       └── ActivityFeed.tsx            (new)
├── pages/
│   └── LogPage.tsx                     (replace placeholder — sub-tab shell)
```

---

## Done-When

- [ ] Log page shows 2 sub-tabs: "Log" and "Activity"
- [ ] Food card: textarea → 1.5s mock parse → items → confirm → "Logged!"
- [ ] Strength card Builder mode: split selector, load last session, exercise cards with steppers, add/remove sets and exercises, superset toggle, save session
- [ ] Strength card Brain Dump mode: textarea → 1.5s mock parse → structured exercises → confirm
- [ ] Sauna card: duration + temp + meditation toggle (with minutes input) + devotions toggle → "Logged!"
- [ ] Habits card: 2×2 checkboxes → "Logged!"
- [ ] All card confirmed states auto-reset after 2s
- [ ] Activity Feed sub-tab: shows mock activities with effort badges
- [ ] Tapping activity in feed opens inline effort selector (Basic/Mid/Let's Go)
- [ ] Unreviewed (effort_is_default: true) activities show subtle indicator on badge
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
2. Update `README.md`: Log → "UI with mock data, workout logger, activity feed"
3. Add entry to `CHANGELOG.md`
4. Start next task: `tasks/active/07-log-api.md`
