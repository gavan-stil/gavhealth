# Task — Strength Session Consistency + Session Picker

> Status: **READY TO BUILD**
> Created: 2026-03-11
> Mockup: `archive/strength-session-consistency-mockup.html` — **all 4 sections approved**

---

## Goal

Two parallel objectives, implemented together in one sprint:

1. **Session picker** — replace the "Load last session" button in the Strength card with a "Load a recent session…" trigger that opens a bottom sheet listing up to 5 past sessions for the selected split.

2. **Design consistency** — all 4 strength session views now share a single visual language (area chips → totals row → 4-col exercise table → action row). Update the 3 existing views to match.

---

## Design Source of Truth

`archive/strength-session-consistency-mockup.html` — **all 4 sections approved**. Do not deviate from this file for layout, colours, or typography.

### Shared exercise body design (all 4 views)

| Element | Detail |
|---|---|
| Area chips | Rust-dim bg pills, `font: 600 12px/1 Inter`, `--rust` text, `8px` padding, `6px` radius, horizontal scroll, no wrap |
| Totals row | 3 equal cells: `Sets / Reps / Volume`. Large value (`font: 700 20px/1 'JetBrains Mono'`, `--text-pri`), small label (`font: 500 11px/1 Inter`, `--text-muted`, uppercase) |
| Exercise table columns | `Exercise (flex-1) | Sets (28px) | Reps (32px) | Top (52px)` |
| Exercise table header | `font: 600 10px/1 Inter`, `--text-muted`, uppercase, `4px 0` padding, border-bottom `--border` |
| Exercise rows | `font: 600 13px/1 'JetBrains Mono'`, `--text-sec`; name in `font: 500 14px/1 Inter` |
| PB indicator | 5px ochre circle (`.ex-pb-dot`) left of exercise name + name text in `--ochre`. Non-PB rows get an invisible dot (keeps alignment). |
| Volume label | `"Volume"` — no `kg` suffix |

### 4 views and their files

| # | View | File | Status |
|---|---|---|---|
| 1 | Session Picker sheet | `src/components/log/SessionPickerSheet.tsx` (new) | Build |
| 2 | Calendar day detail | `src/components/DayDetailSheet.tsx` | Update |
| 3 | Log activity detail (linked session) | `src/components/log/ActivityDetailSheet.tsx` | Update |
| 4 | Log activity feed — orphan card | `src/components/log/ActivityFeed.tsx` | Update |

---

## Backend

### New endpoint: `GET /api/log/strength/recent/{split}?limit=5`

**File:** `backend/app/routers/new_endpoints.py`

**Path param:** `split` — one of `push`, `pull`, `legs`, `abs`

**Query param:** `limit` — integer, default `5`, max `10`

**Response shape:**
```typescript
interface RecentSession {
  id: number;
  date: string;                // YYYY-MM-DD local (Brisbane UTC+10 — AT TIME ZONE 'Australia/Brisbane')
  start_time: string | null;   // HH:MM local, null if not recorded
  exercise_count: number;
  total_sets: number;
  avg_reps_per_set: number;    // 1 dp
  total_volume_kg: number;     // SUM(reps × weight_kg), skip null weight, round to int
  is_pb: boolean;
  most_loaded: boolean;
  exercises: RecentSessionExercise[];
}

interface RecentSessionExercise {
  name: string;
  sets: number;
  avg_reps: number;            // 1 dp
  top_weight_kg: number | null; // null = bodyweight
  is_pb: boolean;
}
```

**SQL notes:**

`is_pb` (session): for each exercise in the session, check if any set's `weight_kg` = all-time max OR any set's `reps` = all-time max reps for that exercise name in that split. If any exercise passes → session `is_pb = true`.

`most_loaded`: compare exercise name lists (order-insensitive, normalised lowercase). Session whose name-set appears most frequently in history gets `most_loaded = true`. One winner only — prefer more recent if tied.

`date`: `created_at AT TIME ZONE 'Australia/Brisbane'` → date only. NOT `::date` (that gives UTC).

**Ordering:** PB sessions first (newest first), then most_loaded (if not already top), then remaining chronological desc.

**Errors:** 400 if split invalid. Return `[]` (not null) if no sessions.

---

## Frontend

### 1. New component: `SessionPickerSheet.tsx`

**Location:** `src/components/log/SessionPickerSheet.tsx`

**Props:**
```typescript
interface SessionPickerSheetProps {
  split: string;
  open: boolean;
  onClose: () => void;
  onLoad: (exercises: WorkoutExercise[]) => void;
}
```

**Behaviour:**
- Fetch `/api/log/strength/recent/{split}?limit=5` when `open` becomes `true`. No pre-fetch.
- Loading: single skeleton row inside sheet body.
- Error: inline message + retry button. Do not close sheet.
- Each card collapsed by default. Tap header → expand. One expanded at a time (preferred).
- Chevron SVG rotates 180° when open.
- "Load this session" inside expanded body → calls `onLoad(session.exercises)` then `onClose()`.
- z-index: `210` on overlay (above TabBar z-100).
- Tap overlay to close.

**Sheet title:** `Recent {split} sessions` (capitalise first letter)
**Sheet subtitle:** `Tap to preview · select to load as template`
**Section divider:** `"Older sessions"` — only render if cards exist on both sides.

**PB badge:** inline SVG flame (paths below), size `10×10`, stroke `#e8c47a` + `" PB"` text.
**Most-loaded badge:** `↺ Most loaded` text only.

Flame SVG paths:
```
viewBox="0 0 24 24"
<path d="M 12 2 C 12 2 6 10 6 14.5 A 6 6 0 0 0 18 14.5 C 18 10 12 2 12 2 Z"
      fill="none" stroke="#e8c47a" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round"/>
<path d="M 12 22 C 12 22 9 17 9 15 A 3 3 0 0 1 15 15 C 15 17 12 22 12 22"
      fill="none" stroke="#e8c47a" stroke-width="1.2"
      stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
```

**Exercise meta format (collapsed preview row):** `{sets}×{avg_reps} · {top_weight_kg}kg top` — if null, render `BW`.

**Expanded card body:** area chips → totals row (Sets / Reps / Volume) → 4-col exercise table with PB dots → "Load this session" button. Matches Section 1 of mockup exactly.

---

### 2. `StrengthCard.tsx` changes

1. Replace "Load last session" button with trigger matching mockup Section 1 `.load-session-btn` style (full-width, surface bg, border, centred, icon left).
2. Button label: `Load a recent session…`
3. Button icon: inline SVG circular arrow, `16×16`, stroke `var(--ochre)`.
4. Add `const [sheetOpen, setSheetOpen] = useState(false);`
5. Mount `<SessionPickerSheet>` with:
   ```tsx
   <SessionPickerSheet
     split={selectedSplit}
     open={sheetOpen}
     onClose={() => setSheetOpen(false)}
     onLoad={(exs) => {
       setExercises(exs.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s })) })));
       setStartDate(today());
       setNoLastSession(false);
     }}
   />
   ```
6. Remove `noLastSession` state and its `<span>`. Keep `loadLastSession`, `lastDate`, all other state.

---

### 3. `DayDetailSheet.tsx` changes

Update the strength session expanded body to use the shared design:
- Area chips row (use `workout_split` body-area mapping: push→Chest/Shoulders/Triceps, pull→Back/Biceps, legs→Quads/Hamstrings/Glutes, abs→Core)
- Totals row: Sets / Reps / Volume (compute from exercises JSONB)
- 4-col exercise table with PB dots (compare against all-time max for that exercise)
- Remove any old 2-col or 3-col exercise layout

Data source: `manual_strength_logs` (via the bridge — current code may be using `strength_sessions`; verify and fix if so).

---

### 4. `ActivityDetailSheet.tsx` changes (linked session view)

The "linked session" expanded body inside the Withings activity detail sheet.

- Replace current exercise grid with shared design: area chips → totals → 4-col exercise table with PB dots
- Keep HR block and effort picker (they are Withings-sourced, unaffected by this task)
- Data source: `manual_strength_logs` via `bridged_session_id`

---

### 5. `ActivityFeed.tsx` orphan card changes

The orphan (unlinked) session card inline in the feed.

**Collapsed state** (existing — do not change):
- Rust `3px` left border
- Rust dot + "Strength" title + "unlinked" badge (broken-chain SVG)
- JetBrains Mono meta row: date · exercise count · duration
- Split pill

**Expanded state** (update to match mockup Section 4):
- Replace current expanded panel with: area chips → totals row (Sets / Reps / Volume) → 4-col exercise table with PB dots
- Keep "Delete session" (red border) and "Link to workout" (ghost border) action buttons below the exercise table
- Remove any old expanded layout

---

## Implementation Order

1. **curl-verify first**: curl `GET /api/log/strength/last/{split}` to confirm `exercises` JSONB field names. Record in `reference/api.md`.
2. **Backend**: add `GET /api/log/strength/recent/{split}` in `new_endpoints.py`. curl-test Railway. Record response in `reference/api.md`.
3. **SessionPickerSheet.tsx**: build new component.
4. **StrengthCard.tsx**: swap trigger, mount sheet.
5. **DayDetailSheet.tsx**: update exercise body to shared design.
6. **ActivityDetailSheet.tsx**: update linked-session exercise body.
7. **ActivityFeed.tsx**: update orphan expanded body.
8. **`npm run build`** must pass.
9. Push to main.

---

## Out of Scope

- Swipe-to-dismiss gesture
- Pagination beyond 5 sessions
- Editing sessions from within the picker
- Changes to food, water, mood cards
- HR block in ActivityDetailSheet (keep as-is)
