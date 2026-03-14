# Log Route — Feature Spec

> Unified logging hub. All manual data entry happens here.

---

## Route

`/log` — accessible from bottom tab bar (pencil/plus icon)

## Layout

Mobile-first card stack. Each log type is a collapsible card. Default state: all collapsed, most-used on top.

### Card Order (top to bottom)

1. **Food** — NLP input → Claude parse → confirm
2. **Strength** — NLP input → Claude parse → confirm
3. **Sauna** — Direct form
4. **Habits** — Checkbox list

---

## Food Logging (2-step NLP flow)

### Step 1: Parse

- Text input: "2 eggs scrambled with cheese and toast"
- POST `/api/log/food` with `{ "description": "..." }`
- Returns: `{ parsed: { protein, carbs, fat, calories, food_items[] } }`
- Model: Claude Haiku 4.5

### Step 2: Confirm

- Display parsed result as editable card (macro breakdown, calorie total)
- User taps "Confirm" or edits values
- POST `/api/log/food/confirm` with confirmed data
- Row written to `food_logs` table

### UI States

- **Empty:** Text input with placeholder "What did you eat?"
- **Parsing:** Skeleton card with pulse animation (200ms normal timing)
- **Parsed:** Macro breakdown card — protein/carbs/fat as colored bars, calorie total as hero number (JBM 28px)
- **Confirmed:** Success state, card collapses, toast notification "Logged ✓"
- **Error:** Red border on card, retry button, error message

---

## Strength Logging (2-step NLP flow)

### Step 1: Parse

- Text input: "squat 100kg 3x5, leg press 180kg 3x8"
- POST `/api/log/strength` with `{ "description": "..." }`
- Returns: `{ parsed: { exercises: [{ exercise_name, sets: [{ reps, weight_kg }] }] } }`
- Model: Claude Haiku 4.5

### Step 2: Confirm

- Display parsed sets as table (exercise | sets × reps @ weight)
- User can edit individual values or add/remove sets
- POST `/api/log/strength/confirm` with confirmed data
- Rows written to `strength_sessions` + `strength_sets` tables
- PRs auto-updated if new max detected

### UI States

Same pattern as food: empty → parsing → parsed → confirmed → error

---

## Sauna Logging (direct form)

- Date picker (defaults to today)
- Duration slider or input (minutes, default 20)
- Temperature input (°C, default 85)
- Optional notes text field
- POST `/api/log/sauna` with `{ date, duration_min, temp_celsius, notes }`
- Row written to `sauna_logs`

---

## Habits Logging (checkbox list)

- Date (defaults to today)
- Checkboxes: Breathing, Devotions
- POST `/api/log/habits` with `{ date, breathing: bool, devotions: bool }`
- Row written to (or upserted in) `daily_habits`

---

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/log/food` | POST | NLP food parse (step 1) |
| `/api/log/food/confirm` | POST | Confirm and write food (step 2) |
| `/api/log/strength` | POST | NLP strength parse (step 1) |
| `/api/log/strength/confirm` | POST | Confirm and write strength (step 2) |
| `/api/log/sauna` | POST | Direct sauna log |
| `/api/log/habits` | POST | Direct habits log |
| `/api/exercises` | GET | Exercise lookup for strength dropdowns |

All require header: `X-API-Key: <your-api-key>`

---

## Design Notes

- All inputs use 44px minimum touch targets
- Text inputs use Inter 14px, results use JBM for numbers
- Card backgrounds: `#14130f` (card), borders: `#222018`
- Confirm buttons: ochre `#d4a04a` background, `#0d0d0a` text
- Error states: signal poor `#c47a6a` border
- Success states: signal good `#e8c47a` text

---

## Phase 1 Excludes

- Photo-based food logging
- Barcode scanning
- Exercise history autocomplete
- Recurring habit templates
- Batch logging (multiple days at once)
