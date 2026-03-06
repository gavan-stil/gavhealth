# Task 06 — Log Flow (UI Only)

Purpose: Build the Log route with all 4 logging cards and their UI states. No API wiring — mock parsed responses only.

---

## Scope Gate

**DOES:**
- Create `/log` route with 4 collapsible cards
- Build Food card (NLP text input → mock parsed result → confirm)
- Build Strength card (NLP text input → mock parsed result → confirm)
- Build Sauna card (direct form: duration + temperature)
- Build Habits card (checkbox grid: stretching, meditation, cold shower, supplements)
- Implement 5 card states: empty → parsing → parsed → confirmed → error
- Use inline mock data for parsed states

**DOES NOT:**
- Call any API endpoints (that's Task 07)
- Persist data
- Build edit/delete for past entries
- Touch Dashboard, Calendar, or Trends routes

---

## Pre-flight Checks

- [ ] Task 05 completed (or at minimum Task 02 — this task is independent of Calendar)
- [ ] Log route exists and renders (from Task 01)
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

No API calls in this task. All parsed results use inline mock data below.

---

## Mock Data

```typescript
// src/mocks/log.ts

export const MOCK_PARSED_FOOD = {
  items: [
    { name: "Chicken breast", calories: 280, protein_g: 52 },
  ],
  total_calories: 280,
};

export const MOCK_PARSED_STRENGTH = {
  exercise: "Bench Press",
  sets: [
    { weight_kg: 80, reps: 8 },
    { weight_kg: 85, reps: 6 },
  ],
};
```

---

## Component Specs

### 1. `src/pages/LogPage.tsx`

Vertical stack of 4 collapsible cards. `padding: var(--space-lg)`, `gap: var(--space-md)`.

Each card has a header row (icon + title + chevron) that toggles collapse. Only one card expanded at a time (accordion behavior).

### 2. Card State Machine (all 4 cards)

```
empty → (user submits) → parsing → parsed → (user confirms) → confirmed
                           ↓                                      ↓
                         error                                  (reset to empty after 2s)
```

- **Empty:** Input visible (text field or form), submit button
- **Parsing:** Input disabled, pulsing animation on submit button, "Parsing…" text
- **Parsed:** Show parsed result for review, "Confirm" + "Edit" buttons
- **Confirmed:** Green check + "Logged!" message, auto-resets to empty after 2 seconds
- **Error:** Red inline message + "Try again" button

For mock: "parsing" state lasts 1.5 seconds (setTimeout), then shows mock parsed data.

### 3. `src/components/log/FoodCard.tsx`

- Icon: `UtensilsCrossed` (lucide-react), `var(--gold)`
- Title: "Food" (`section-head`)
- Input: single textarea, placeholder "e.g. chicken breast 200g, rice 150g, broccoli"
- Submit: "Parse" button, `bg: var(--ochre)`, `text: var(--bg-base)`, `radius: var(--radius-md)`
- Parsed state shows:
  - Item list: name, calories, protein per item (`body-text`)
  - Total row: total calories (`stat-number`, `var(--ochre)`)
  - "Confirm" button (same style as Parse) + "Edit" (ghost button)

### 4. `src/components/log/StrengthCard.tsx`

- Icon: `Dumbbell` (lucide-react), `var(--rust)`
- Title: "Strength" (`section-head`)
- Input: single textarea, placeholder "e.g. bench press 80kg x8, 85kg x6"
- Submit: "Parse" button
- Parsed state shows:
  - Exercise name (`section-head`)
  - Sets table: columns for Set #, Weight, Reps (`small-number` for values)
  - "Confirm" + "Edit" buttons

### 5. `src/components/log/SaunaCard.tsx`

- Icon: `Thermometer` (lucide-react), `var(--ember)`
- Title: "Sauna" (`section-head`)
- Direct form (no NLP, no parsing step):
  - Duration: number input (minutes), `placeholder: "20"`
  - Temperature: number input (°C), `placeholder: "80"`
- Submit: "Log Sauna" button → confirmed state directly (no parsing step)
- Input styling: `bg: var(--bg-elevated)`, `border: 1px solid var(--border-default)`, `radius: var(--radius-sm)`, `padding: var(--space-sm) var(--space-md)`, `color: var(--text-primary)`, `font: small-number`

### 6. `src/components/log/HabitsCard.tsx`

- Icon: `CheckSquare` (lucide-react), `var(--ochre)`
- Title: "Habits" (`section-head`)
- 2×2 checkbox grid:
  - Stretching, Meditation, Cold Shower, Supplements
  - Each: custom checkbox (24px square, `border: 2px solid var(--border-default)`, `radius: var(--radius-sm)`)
  - Checked: `bg: var(--ochre)`, white checkmark
  - Label: `body-text`, `var(--text-secondary)`
- Submit: "Log Habits" button → confirmed state directly

---

## File Structure

```
src/
├── mocks/
│   └── log.ts                  (new)
├── components/
│   └── log/
│       ├── FoodCard.tsx         (new)
│       ├── StrengthCard.tsx     (new)
│       ├── SaunaCard.tsx        (new)
│       └── HabitsCard.tsx       (new)
├── pages/
│   └── LogPage.tsx              (replace placeholder)
```

---

## Done-When

- [ ] Log route shows 4 collapsible cards (accordion — one open at a time)
- [ ] Food card: text input → 1.5s parsing animation → mock parsed items → confirm → "Logged!"
- [ ] Strength card: text input → 1.5s parsing animation → mock parsed sets → confirm → "Logged!"
- [ ] Sauna card: duration + temp form → submit → "Logged!"
- [ ] Habits card: 2×2 checkbox grid → submit → "Logged!"
- [ ] All card states work: empty → parsing → parsed → confirmed (and error state reachable)
- [ ] Confirmed state auto-resets to empty after 2 seconds
- [ ] Input styling matches design tokens
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
2. Update `README.md` route status table (Log → "UI with mock parsing")
3. Add entry to `CHANGELOG.md`
4. Start next task: `tasks/active/07-log-api.md`
