# Session — T17 Strength Session Consistency + Session Picker

> Overwrite each session. Delete when task is done.

## Task
`tasks/active/task-strength-session-picker.md` — all 4 sections of mockup approved.

## Checklist
- [ ] T17-1: curl `/api/log/strength/last/{split}` → record exercises shape in `reference/api.md`
- [ ] T17-2: Backend `GET /api/log/strength/recent/{split}` in `new_endpoints.py`; curl Railway; record in `reference/api.md`
- [ ] T17-3: Build `src/components/log/SessionPickerSheet.tsx`
- [ ] T17-4: `StrengthCard.tsx` — swap trigger button, mount sheet, add `sheetOpen` state, remove `noLastSession`
- [ ] T17-5: `DayDetailSheet.tsx` — update exercise body to 4-col + area chips + totals + PB dots
- [ ] T17-6: `ActivityDetailSheet.tsx` — update linked-session exercise body (keep HR block)
- [ ] T17-7: `ActivityFeed.tsx` — update orphan expanded body (area chips + totals + 4-col + PB dots + action buttons)
- [ ] T17-8: `npm run build` + push to main

## Design reference
`archive/strength-session-consistency-mockup.html`
- Section 1: Session Picker sheet
- Section 2: Calendar day detail
- Section 3: Log activity detail (linked)
- Section 4: Log feed orphan (unlinked)

## Key shared design elements
- 4-col table: `Exercise (flex-1) | Sets (28px) | Reps (32px) | Top (52px)`
- PB: 5px ochre dot + ochre name text; invisible dot on non-PB rows (alignment)
- Totals: Sets / Reps / **Volume** (no kg suffix)
- Area chips: rust-dim bg, `--rust` text
