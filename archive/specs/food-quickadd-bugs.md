# Food Quick-Add — Pre-Build Bug Register
_Written before implementation. Each bug has a mitigation baked into the build plan._

---

## 1. Brisbane date bugs

**Bug:** Computing "yesterday" with JS `new Date()` gives UTC date. Before ~10am Brisbane (UTC+10), `new Date()` UTC date is still "yesterday" local, making yesterday = 2 days ago Brisbane time.

**Mitigation:** Use the same pattern already established across the codebase:
```ts
const today = new Date().toLocaleDateString('en-CA');       // YYYY-MM-DD Brisbane
const yesterday = new Date(Date.now() - 864e5).toLocaleDateString('en-CA');
```
Never use `.toISOString().split('T')[0]`.

---

## 2. Staged item appears in both tabs — double-staging

**Bug:** "Protein shake" exists in Yesterday (id `y4`) and Frequent (id `f1`) with different source IDs. Staging from Yesterday doesn't dim the Frequent chip. User could stage it twice, landing two "Protein shake" rows in staging.

**Decision:** Allow it. Two taps = two servings (e.g. morning + post-workout shake). The staged list is editable — user can × the duplicate if unintended. No special dedup logic needed.

---

## 3. Frequent items: case-insensitive grouping of `description_raw`

**Bug:** "Protein shake", "protein shake", and "PROTEIN SHAKE" are three distinct DB rows but the same food. Naïve grouping by exact string counts them separately, preventing any from hitting the ×3 threshold.

**Mitigation:** Group client-side by `description_raw.toLowerCase().trim()`. Display name = the most recent entry's `description_raw`. Macros = average across the group.

---

## 4. Frequent items: macro averaging

**Bug:** If "Flat white" was logged as 120 kcal once and 110 kcal another time, the averaged chip shows 115 kcal — but `logItem` will POST 115, which may not match what the user expects.

**Mitigation:** Round averaged macros to integers before display and before POST. Accept this as an inherent approximation — the user is copying a habit, not a precise recipe. No further action needed.

---

## 5. Confirm-staged fires N parallel POSTs — race condition with optimistic state

**Bug:** Calling `logItem` N times concurrently fires N optimistic updates simultaneously, all appending temp entries with negative IDs. The real-ID replacement logic (`prev.map(e => e.id === tempId ? ...)`) depends on a unique tempId per call. Concurrent calls could race.

**Mitigation:** Call `logItem` sequentially with `for...of` + `await` — not `Promise.all`. This is slightly slower (N × ~200ms network) but eliminates the race. With typical staging of 3–5 items this is imperceptible.

---

## 6. Partial confirm failure

**Bug:** "Add 5 items to today" — items 1–3 POST successfully, item 4 fails (network drop). Item 4 rolls back optimistically but items 1–3 are already logged. User doesn't know item 4 was missed.

**Mitigation:** Collect failures during the sequential loop. After the loop, if any failed: show an inline error banner above the staged area listing the failed item names with a "Retry" button (retries only the failures). Successfully confirmed items are removed from staging; failed ones remain.

---

## 7. Date change while items are staged

**Bug:** `FoodNutritionCard` receives a `date` prop. If the user navigates to a different date (calendar) while items are in staging, the staged items still reference the old date. On confirm they'd be POSTed to the wrong date.

**Mitigation:** `useEffect(() => { clearStaged(); }, [date])` in the component — any date change flushes staging silently. The 8-day fetch and today's log fetch already reset on date change (existing behaviour).

---

## 8. ✓ indicator comparison — already-logged items

**Bug:** Yesterday chip for "Chicken rice bowl" should show ✓ if it's already in today's log. Comparison must be by name not by ID (different rows, different dates). Case-insensitive match required or a renamed version won't match.

**Mitigation:** Build a `Set<string>` of `todayLog` entry names, lowercased. Compare `item.name.toLowerCase()` against it when rendering chips. This set is derived from the existing `todayLog` state in `useFoodNutrition`.

---

## 9. 8-day fetch vs today-only fetch — two fetches on mount

**Bug:** `useFoodNutrition` already fetches today's log (`/api/food?start_date=today&end_date=today`). The new quick-add hook fetches 8 days. That's two fetches on every card open, with the 8-day range being a superset of today.

**Mitigation:** Keep them separate — the 8-day fetch is owned by a new `useQuickAdd(date)` hook. Today's log stays in `useFoodNutrition` for totals/display. The overlap (today's data returned in both) is harmless. Combining into one fetch would require refactoring `useFoodNutrition`, which is out of scope.

---

## 10. "Add all" on Frequent tab stages items already staged from Yesterday

**Bug:** User taps "Add all" on Yesterday (stages all 7 items). Switches to Frequent. Taps "Add all". Frequent's "Protein shake" has a different source ID (`f1`) than Yesterday's (`y4`), so it isn't considered staged — a second copy gets added.

**Mitigation:** Track staged items by `name.toLowerCase()` as a secondary check in addition to source ID. Before staging, check: "is an item with this name already in `staged[]`?" If yes, skip (don't stage duplicate). This dedup applies to "Add all" only — individual chip taps intentionally allow duplicates (second serving).

---

## 11. Staged area height — overflow pushing "New food" off screen

**Bug:** "Add all yesterday" with 8 items creates a staged list that could be 200px+ tall, pushing the NLP textarea below the fold with no scroll cue.

**Mitigation:** Cap staged list at `max-height: 180px; overflow-y: auto` — roughly 4 items visible, scrollable for more. The confirm button stays pinned at the bottom of the staged area (not the screen).

---

## 12. Empty Yesterday → auto-tab behaviour

**Bug:** If nothing was logged yesterday, Yesterday tab is empty. Defaulting to it shows an empty state, which is a weak first impression.

**Mitigation:** On load: if `yesterdayItems.length === 0` AND `frequentItems.length > 0`, default active tab to Frequent. If both empty, default to Saved. Order of preference: Yesterday → Frequent → Saved.

---

## 13. Frequent items: the `meal_label` stored is always `'snack'`

**Bug:** All items logged via `POST /api/log/food/item` store `meal_label='snack'` (hardcoded in the endpoint). When these items are fetched back in the 8-day window and counted for frequency, they all carry `meal_label='snack'` regardless of when they were actually eaten. This doesn't break anything but is worth knowing.

**Mitigation:** No action needed — frequency grouping is by `description_raw`, not `meal_label`.

---

## 14. `useQuickAdd` re-fetches on every card open/close

**Bug:** If `useQuickAdd` is initialised inside `FoodNutritionCard` and the card is a collapsible (the hook runs when the component mounts), the 8-day fetch fires every time the card is opened.

**Mitigation:** Move `useQuickAdd` to the parent (`LogCards`) alongside `useFoodNutrition`, so it fetches once on page load regardless of card open state. Pass data down as props.

---

## Summary — Build order

1. `useQuickAdd(date)` hook — fetch, compute yesterday/frequent
2. Staged state in `FoodNutritionCard` — stage, remove, confirm (sequential POSTs, failure collection)
3. `QuickAddSection` sub-component — tabs, chips, staged area, ✓ indicator
4. Wire into `FoodNutritionCard` — replace current saved meals section
5. Auto-tab default logic
6. Error banner for partial confirm failures
