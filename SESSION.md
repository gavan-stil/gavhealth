# Session — T14 1f: Edit completed set (feather icon)

## Task
When a set is marked complete, collapse it to compact read-only display.
Feather icon beside it re-opens it for editing.

## File
`src/components/log/StrengthCard.tsx` — `ExerciseCard` component (~143–328)

## Current state
Set row always shows steppers regardless of `set.completed`.
No locking or edit-mode toggle.

## Approach
- Add `editingSet: number | null` state in ExerciseCard
- When `set.completed && editingSet !== si`: render compact row
  - "80kg × 5" (or "BW × 5") text + check icon + feather icon
- When `editingSet === si` OR `!set.completed`: render existing stepper row
- Feather click: `setEditingSet(si)`
- Check button click (on editing completed set): mark complete + `setEditingSet(null)`
- Check button click (on incomplete set): mark complete, no editingSet change
- X (remove) remains on compact view too

## Compact row display
`{kg}kg × {reps}` or `BW × {reps}` (bw+ shows `+{kg}kg × {reps}`)
Check icon stays green. Feather icon (Edit2, size 12) muted.

## Changes
1. Add `editingSet` state + setter in ExerciseCard
2. Wrap set render in conditional: compact vs full
3. Update check button handler to also clear editingSet when collapsing

## Status
[ ] In progress
