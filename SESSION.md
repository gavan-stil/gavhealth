# Session — T14 1c: Previous session preview in ExerciseCard

## Task
When user adds/types an exercise name that matches a known exercise, show a small
"last session" affordance inside the ExerciseCard: last date, top weight, set count.

## File
`src/components/log/StrengthCard.tsx` — specifically `ExerciseCard` component (~143–302)

## API endpoint (curl-verify first)
`GET /api/strength/exercise/:id/history?days=90`
Returns array of sessions chronological. Take last entry.
`GET /api/exercises` — already fetched, gives `{ id, name }[]`

## Response shape (to verify)
From docs: session_date, sets, total_reps, top_weight_kg, session_volume_kg, estimated_1rm
Need to confirm `sets` is integer (count) or array.

## Approach

### In ExerciseCard
- Add `useEffect` watching `exercise.name`
- When name matches exerciseList exactly (case-insensitive) → get exercise ID → fetch history
- `prevSession: ExerciseHistoryEntry | null` local state
- Clear prevSession when name changes to no-match

### Affordance UI (inline, no tap needed)
Below the exercise name input row, when prevSession exists:
```
Last: 80kg top · 5 sets · 1 Mar
```
Small muted text, single line.

### Match strategy
- Exact case-insensitive match against exerciseList
- After user picks from dropdown → name is exact match → auto-trigger fetch
- Manual typing that happens to match → same trigger

### No prop changes needed
ExerciseCard already receives `exerciseList: Exercise[]` — use it to resolve name→id

## Changes needed
1. `ExerciseHistoryEntry` type (after curl verify)
2. `prevSession` state + fetch useEffect in ExerciseCard
3. Render affordance below exercise name row

## Status
[ ] In progress
