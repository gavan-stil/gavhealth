# Task 07 — Log API Wiring

Purpose: Connect all 4 log cards to their live POST endpoints. Handle the 2-step NLP confirm flow for food and strength.

---

## Scope Gate

**DOES:**
- Wire Food card to `POST /api/log/food` → parse → `POST /api/log/food/confirm` → save
- Wire Strength card to `POST /api/log/strength` → parse → `POST /api/log/strength/confirm` → save
- Wire Sauna card to `POST /api/log/sauna` → save
- Wire Habits card to `POST /api/log/habits` → save
- Handle 2–3 second parse response times with parsing animation
- Replace all mock data usage with live responses

**DOES NOT:**
- Modify card UI design (done in Task 06)
- Add offline queueing or retry logic
- Build edit/delete for past entries
- Touch Dashboard, Calendar, or Trends routes

---

## Pre-flight Checks

- [ ] Task 06 completed: All 4 log cards render with mock data
- [ ] `apiFetch<T>()` exists in `src/lib/api.ts`
- [ ] `npm run dev` runs without errors
- [ ] **ENDPOINT VERIFICATION** — Before writing any fetch/transform code, hit every POST endpoint listed below with a real request and confirm: (a) it exists and returns 2xx, (b) the response shape matches what's documented here. Task 03 had major shape mismatches that required on-the-fly transforms; assume these specs may be wrong too. Fix the specs in this file first, then build.

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
}
```

---

## API Endpoints (inline)

**Base URL:** `https://gavhealth-production.up.railway.app`
**Auth header:** `X-API-Key: gavhealth-prod-api-2026-xK9mP3`

### Food — 2-step NLP flow

**Step 1: Parse**
```
POST /api/log/food
Body: { text: string }
Response: {
  items: Array<{
    name: string,
    calories: number,
    protein_g: number
  }>,
  total_calories: number
}
```

**Step 2: Confirm**
```
POST /api/log/food/confirm
Body: {
  items: Array<{ name: string, calories: number, protein_g: number }>,
  date: string   // YYYY-MM-DD
}
Response: { success: boolean }
```

### Strength — 2-step NLP flow

**Step 1: Parse**
```
POST /api/log/strength
Body: { text: string }
Response: {
  exercise: string,
  sets: Array<{
    weight_kg: number,
    reps: number
  }>
}
```

**Step 2: Confirm**
```
POST /api/log/strength/confirm
Body: {
  exercise_id: string,
  sets: Array<{ weight_kg: number, reps: number }>,
  date: string   // YYYY-MM-DD
}
Response: { success: boolean }
```

### Sauna — direct save

```
POST /api/log/sauna
Body: {
  duration_minutes: number,
  temperature_c: number,
  date: string   // YYYY-MM-DD
}
Response: { success: boolean }
```

### Habits — direct save

```
POST /api/log/habits
Body: {
  date: string,   // YYYY-MM-DD
  habits: {
    stretching: boolean,
    meditation: boolean,
    cold_shower: boolean,
    supplements: boolean
  }
}
Response: { success: boolean }
```

---

## Component Specs

### NLP Parse Flow (Food + Strength)

These use Claude Haiku 4.5 on the backend for NLP parsing. Response times may be 2–3 seconds.

1. User types free text → taps "Parse"
2. Card transitions to `parsing` state (input disabled, pulsing animation)
3. `POST /api/log/food` (or strength) with `{ text }`
4. On response → card transitions to `parsed` state showing parsed result
5. User taps "Confirm" → `POST /api/log/food/confirm` (or strength/confirm) with parsed data + today's date
6. On success → card transitions to `confirmed` state ("Logged!"), auto-resets after 2s
7. On error at any step → card transitions to `error` state with message + "Try again"

### Direct Save Flow (Sauna + Habits)

1. User fills form → taps submit button
2. Button shows loading spinner
3. `POST /api/log/sauna` (or habits) with form data + today's date
4. On success → `confirmed` state, auto-reset after 2s
5. On error → `error` state with retry

### Date Handling

All log entries use today's date. Format as `YYYY-MM-DD` using:
```typescript
const today = new Date().toISOString().split('T')[0];
```

---

## File Structure

```
src/
├── components/
│   └── log/
│       ├── FoodCard.tsx        (modify — replace mock with API calls)
│       ├── StrengthCard.tsx    (modify — replace mock with API calls)
│       ├── SaunaCard.tsx       (modify — add API call)
│       └── HabitsCard.tsx      (modify — add API call)
├── mocks/
│   └── log.ts                  (can be removed or kept as fallback)
```

---

## Done-When

- [ ] Food card: free text → API parse (2–3s) → show parsed items → confirm → saved
- [ ] Strength card: free text → API parse → show parsed sets → confirm → saved
- [ ] Sauna card: form → API save → "Logged!"
- [ ] Habits card: checkboxes → API save → "Logged!"
- [ ] Error states show for failed API calls with retry option
- [ ] Parsing animation plays during NLP API wait time
- [ ] No mock data imports used in production flow
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
2. Update `README.md` route status table (Log → "Live API with NLP parsing")
3. Add entry to `CHANGELOG.md`
4. Start next task: `tasks/active/08-trends-view.md`
