# T14 Sprint — System Updates & Polish

> Started: 2026-03-08
> Status: 🟡 In Progress
> When an item is done → move its line to the ## Done section at the bottom.

---

## Legend
- `[ ]` — pending
- `[~]` — in progress
- `[x]` — done
- `[B]` — blocked on backend
- `[?]` — blocked on design question (see questions below)

---

## Quick Wins (frontend only)

<!-- All done — see Done section below -->

---

## Medium (frontend + small backend)

- [ ] **1.7** — Water: delete individual water log entries `[B: needs DELETE /api/water/:id]`
- [x] **3** — Calendar: row-per-category bars + Option A WK outline pills + workout split icons (▲/▼//) (2026-03-08)
- [x] **1.1-sessions** — Activity feed: unlinked strength sessions appear as first-class feed cards sorted by date. Rust left border + Link2Off pill. Expand → Delete or Link-to-workout picker. Pure frontend (no new endpoints). (2026-03-09)

---

## Complex (new backend endpoints needed)

- [ ] **1.8** — Food log: (a) bug — FoodCard does not reset between calendar days (check if items are fetched by date or just latest); (b) date navigation at top of log page (left/right arrows) — each section shows summary tally in preview tile; (c) "Load previous day's items" button for the food input (Item 1.5 merged here)
- [ ] **1.2** — Weights activity feed card: expand detail on tap — session length, date/time, avg HR (if available), push/pull/legs/abs label, smart icons, total exercise count, total sets, total weight moved (sum kg across all sets). Other activity types also become tappable for detail.
- [ ] **2** — Trends: exercise body-part mapping — format is `[Exercise name] - [Body part]` (e.g. `L sit chin up - Back and arms`). System uses the body-part portion to assign trend category. New body parts auto-create new trend categories from that date forward. Unused exercises (not linked to any session+activity) can be cleaned up.

---

## Spec / Research Only

- [ ] **1.6** — Food photo: write cost spec for Claude Vision "From Picture" flow — camera/gallery → scan for nutritional text → serving qty / total grams prompt (style matching strength session buttons). No implementation yet.

---

## Done

- [x] **1a** — Weights session: persist unsaved session state to localStorage; "Resume session?" banner on return (2026-03-08)
- [x] **2.1** — Trends: remove 30/60/90 day toggle (2026-03-08)
- [x] **1.4** — Mood/energy: replace emojis with lucide icons; collapsed header shows "Mood X · Energy Y" (2026-03-08)
- [x] **4** — Dashboard: readiness score tap-tooltips on SLEEP/RHR/LOAD/REST (2026-03-08)
- [x] **1b** — Weights session: cancel confirmation (separate button below list → inline [Yes, cancel] / [Keep going]; closes card on confirm) (2026-03-08)
- [x] **1f** — Weights session: completed sets collapse to compact read-only; Pencil icon re-opens for editing (2026-03-08)
- [x] **1g** — Weights session: date field under "Time started"; defaults to current day (2026-03-08)
- [x] **1h** — Weights session: session notes field with edit/save icons (2026-03-08)
- [x] **1c** — Weights session: previous session affordance in ExerciseCard (name match → fetch history → "Last: 80kg top · 5 sets · 1 Mar") (2026-03-08)
- [x] **1d** — Weights session: broad-match exercise autocomplete dropdown (2026-03-08)
- [x] **1e** — Weights session: per-set tick button (green check + stays visible) (2026-03-08)
- [x] **1.3** — Weights session: running totals summary (BW sets excluded from kg total) (2026-03-08)
- [x] **1.1-filter** — Activity feed: type filter pills (All / Run / Ride / Weights / Sauna) (2026-03-08)

---

## Mockups Needed Before Code

| Item | Why |
|------|-----|
| 3 (Calendar bars) | Full-width bar is a significant visual change to MonthGrid layout |
| 1.8 (Food date nav) | New top-level nav paradigm on Log page |
| 1c (Exercise preview) | New UI element — inline expansion or bottom sheet? |
| 1.2 (Activity detail) | New detail sheet for weights activity card |

---

## Open Questions (blocking `[?]` items)

| # | Item | Question |
|---|------|----------|
| Q1 | 1.4 | Mood icons (1→5): confirm `Frown → Frown → Minus → Smile → SmilePlus` or provide alternatives |
| Q2 | 1.4 | Energy icons (1→5): confirm `BatteryLow → Battery → Zap → Flame → Flame` or provide alternatives |
| Q3 | 1.4 | Collapsed card header: currently shows two emojis when logged. Replace with (a) two small inline icons, (b) text "Mood 4 · Energy 3", or (c) something else? |
| Q4 | 1b | Cancel button location: (a) separate "Cancel session" button below exercise list, or (b) tapping the card header triggers confirmation? After cancel: stay open (empty) or close card? |
| Q5 | 1e | Set tick visual: (a) grey out + strikethrough, (b) green check + stays visible, (c) collapse row? |
| Q6 | 1.3 | BW sets in weight total: (a) count as 0kg (shown in total), or (b) exclude entirely from total? |
