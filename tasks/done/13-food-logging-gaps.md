# T13 — Food Logging Gaps

**Created:** 2026-03-07
**Status:** In Progress

---

## Gaps Identified (two-session analysis)

| # | Gap | Root Cause | Severity |
|---|-----|-----------|----------|
| G1 | NutritionCard renders alongside FoodNutritionCard | LogCards.tsx renders both | High — stale data shown |
| G2 | NutritionCard has wrong macro targets (150g vs 180g protein) | Hardcoded, not using FOOD_TARGETS | High — wrong info |
| G3 | FoodCard.tsx is dead code | Not imported anywhere | Low — cleanup |
| G4 | Saved meal × delete button invisible | opacity: 0.3 | Medium — usability |
| G5 | No protein/macro trends chart | useTrendsData ignores macro fields returned by backend | High — key feature gap |
| G6 | Nutrition sparkline shows consistency_pct not calories | RecoverySparklines maps wrong field | Medium |

**Key discovery:** Backend `/api/food/weekly` already returns `avg_protein_g`, `avg_carbs_g`, `avg_fat_g`. Frontend just ignores them. No backend work needed.

---

## Build Plan

### Frontend changes only

1. **LogCards.tsx** — remove `<NutritionCard>` and the `'nutrition'` card key entirely. Fixes G1 + G2.
2. **Delete FoodCard.tsx** — dead file, never imported. Fixes G3.
3. **FoodNutritionCard.tsx** — increase saved meal × opacity: 0.3 → 0.65. Fixes G4.
4. **useTrendsData.ts** — update `RawFoodWeekly` + `NutritionPoint` to include macro fields; map them in the food transform. Fixes G5 prerequisite.
5. **NutritionTrendsChart.tsx** — new component: weekly avg protein bar chart with 180g target line + over/under colouring. Green = ≥ target, ochre = < target. Fixes G5.
6. **TrendsPage.tsx** — add `<NutritionTrendsChart>` below CorrelationSummary.

---

## Testing Framework (done = all green)

### G1/G2 — NutritionCard removed
- [x] LogCards.tsx: NutritionCard import + render removed; only FoodNutritionCard for food
- [x] Macro targets from FOOD_TARGETS (protein 180g, carbs 260g, fat 80g, kcal 2358) — correct
- [x] No stale duplicate card: grep confirms no 'NutritionCard' in LogCards.tsx

### G3 — Dead code
- [x] `FoodCard.tsx` deleted — confirmed DELETED
- [x] Build passes with no errors

### G4 — Saved meal × visibility
- [x] opacity changed from 0.3 → 0.65 at FoodNutritionCard.tsx:148
- [x] Functionality unchanged (same `handleDeleteMeal` call)

### G5 — Protein trends chart
- [x] NutritionTrendsChart.tsx created with weekly protein bars
- [x] Green (≥ 180g) / ochre (< 180g) colouring via Cell fill
- [x] Gold dashed ReferenceLine at y=180
- [x] Empty state render when nutrition.length === 0
- [x] Wired in TrendsPage.tsx after CorrelationSummary
- [x] useTrendsData.ts NutritionPoint + RawFoodWeekly updated to include avg_protein_g/carbs_g/fat_g
- [x] Backend /api/food/weekly already returns these fields — confirmed in data.py:296-323

### G6 — Nutrition sparkline note
- RecoverySparklines NUTRITION row still shows consistency_pct (unchanged — this is separate from the new chart)

### Build
- [x] `npm run build` exits 0 — 2442 modules, no TS errors (chunk warning pre-existing/known)

---

## Files Changed

- `src/components/log/LogCards.tsx`
- `src/components/log/FoodNutritionCard.tsx`
- `src/components/log/FoodCard.tsx` (deleted)
- `src/hooks/useTrendsData.ts`
- `src/components/trends/NutritionTrendsChart.tsx` (new)
- `src/pages/TrendsPage.tsx`
