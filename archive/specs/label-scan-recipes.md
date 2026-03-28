# Label Scan + Recipes — Feature Spec

> Snap a nutrition label or recipe photo, review extracted data, specify servings/grams, log to day.

---

## 1. UX Flow

### A. Label Scan (single product)
1. Tap **camera icon** next to "New food" in FoodNutritionCard
2. Phone camera opens (or photo library picker)
3. Image preview shown in **LabelScanSheet** (bottom sheet, fullscreen)
4. "Analysing..." spinner while backend extracts nutrition
5. **Review screen**: product name + per-serving macros (editable)
6. **Serving input**: number field + unit toggle (grams / servings)
   - Per-serving size shown (e.g. "1 serving = 30g")
   - Macros auto-scale as user types
7. **"Add →"** stages item into existing staged area
8. User confirms via existing staging flow → logged to day

### B. Recipe (multi-ingredient)
1. Tap **"Recipes"** tab in quick-add strip (alongside Yesterday/Frequent/Saved)
2. Shows saved recipes list + "New recipe" button
3. **New recipe** (two entry modes):
   - **Photo**: snap recipe/ingredient list photo → AI extracts ingredients + amounts
   - **Manual**: add ingredients one by one (name + grams + macros via AI parse)
4. Set recipe name + total weight in grams + number of servings
5. Save recipe → stored in `recipes` table with ingredient breakdown
6. **Using a saved recipe**: tap recipe → specify grams or servings consumed → stages item

### C. Manage saved items
- **Saved tab** in FoodNutritionCard: existing saved meals (unchanged)
- **Recipes tab**: list of saved recipes with swipe-to-delete or edit icon
- **Edit recipe**: opens RecipeSheet pre-filled, can modify ingredients/servings
- **Delete**: confirm prompt before removing

---

## 2. Data Model

### `recipes` table (new)
```sql
CREATE TABLE IF NOT EXISTS recipes (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    total_weight_g  NUMERIC(8,1),           -- total recipe weight in grams
    servings        NUMERIC(6,2) DEFAULT 1, -- how many servings the recipe makes
    calories_kcal   INTEGER NOT NULL,       -- total recipe macros
    protein_g       NUMERIC(6,1) NOT NULL DEFAULT 0,
    carbs_g         NUMERIC(6,1) NOT NULL DEFAULT 0,
    fat_g           NUMERIC(6,1) NOT NULL DEFAULT 0,
    ingredients     JSONB NOT NULL DEFAULT '[]',
    -- ingredients shape: [{name, grams, calories_kcal, protein_g, carbs_g, fat_g}]
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### `saved_meals` table (unchanged)
Existing simple items (name + macros). No changes needed.

---

## 3. API Endpoints

### New endpoints

| Method | Path | Body | Returns | Purpose |
|--------|------|------|---------|---------|
| POST | `/api/log/food/scan` | `{ image_base64, mode }` | `{ name, per_serving: {cal,p,c,f}, serving_size_g, servings_per_container, confidence, ingredients? }` | Vision AI: extract nutrition from label or recipe photo |
| GET | `/api/recipes` | — | `[{id, name, total_weight_g, servings, calories_kcal, protein_g, carbs_g, fat_g, ingredients, created_at}]` | List saved recipes |
| POST | `/api/recipes` | `{name, total_weight_g, servings, calories_kcal, protein_g, carbs_g, fat_g, ingredients}` | recipe object | Create recipe |
| PATCH | `/api/recipes/:id` | partial fields | recipe object | Update recipe |
| DELETE | `/api/recipes/:id` | — | `{ok: true}` | Delete recipe |

### Existing endpoints (no changes)
- `POST /api/log/food/item` — log with known macros (used after scan review)
- `GET/POST/DELETE /api/saved-meals` — simple saved items

### Scan endpoint detail

**Request:**
```json
{
  "image_base64": "data:image/jpeg;base64,...",
  "mode": "label"  // or "recipe"
}
```

**Response (label mode):**
```json
{
  "name": "Chobani Greek Yoghurt",
  "per_serving": {
    "calories_kcal": 130,
    "protein_g": 15.0,
    "carbs_g": 12.0,
    "fat_g": 3.0
  },
  "serving_size_g": 170,
  "servings_per_container": 1,
  "per_100g": {
    "calories_kcal": 76,
    "protein_g": 8.8,
    "carbs_g": 7.1,
    "fat_g": 1.8
  },
  "confidence": "high"
}
```

**Response (recipe mode):**
```json
{
  "name": "Chicken Stir Fry",
  "ingredients": [
    {"name": "chicken breast", "grams": 300, "calories_kcal": 495, "protein_g": 93, "carbs_g": 0, "fat_g": 10.8},
    {"name": "brown rice", "grams": 200, "calories_kcal": 222, "protein_g": 4.6, "carbs_g": 46, "fat_g": 1.8}
  ],
  "totals": {
    "calories_kcal": 717,
    "protein_g": 97.6,
    "carbs_g": 46,
    "fat_g": 12.6
  },
  "confidence": "high"
}
```

---

## 4. Vision AI Prompt Design

### Label mode system prompt
```
You are a nutrition label reader. Given a photo of a food product nutrition label:
1. Extract the product name
2. Extract per-serving nutrition (calories, protein, carbs, fat)
3. Extract serving size in grams
4. Extract servings per container if visible
5. Calculate per-100g values

Return ONLY valid JSON matching this schema:
{name, per_serving: {calories_kcal, protein_g, carbs_g, fat_g}, serving_size_g, servings_per_container, per_100g: {calories_kcal, protein_g, carbs_g, fat_g}, confidence}

Use Australian nutrition panel format. confidence: "high" if all values clearly readable, "medium" if some estimated, "low" if label is unclear.
```

### Recipe mode system prompt
```
You are a recipe ingredient parser. Given a photo of a recipe or ingredient list:
1. Extract each ingredient with its quantity in grams
2. Estimate nutrition for each ingredient
3. Calculate totals

If quantities are in cups/tbsp/etc, convert to grams using Australian standard measures.
Return ONLY valid JSON: {name, ingredients: [{name, grams, calories_kcal, protein_g, carbs_g, fat_g}], totals: {calories_kcal, protein_g, carbs_g, fat_g}, confidence}
```

### Model choice
- Use `claude-haiku-4-5-20251001` (same as existing food parse) — supports vision
- Send image as base64 in message content array: `[{type: "image", source: {type: "base64", ...}}, {type: "text", text: "..."}]`

---

## 5. Frontend Components

### Files

| File | Type | Purpose |
|------|------|---------|
| `src/hooks/useLabelScan.ts` | New | Camera capture, image resize to 1200px, base64 encode, POST to scan endpoint, serving math |
| `src/hooks/useRecipes.ts` | New | CRUD for recipes, portion calculation, recipe selection state |
| `src/components/log/LabelScanSheet.tsx` | New | Bottom sheet: image preview → review → serving input → add |
| `src/components/log/RecipeSheet.tsx` | New | Bottom sheet: create/edit recipe, ingredient list, save |
| `src/components/log/FoodNutritionCard.tsx` | Modified | Add camera button, Recipes tab, wire sheets |

### Image capture helper
```typescript
// Resize to max 1200px, convert to JPEG base64
function resizeAndEncode(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const scale = MAX / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
```

### Serving math
```typescript
// Scale macros by portion
function scaleMacros(
  per100g: Macros,
  grams: number
): Macros {
  const factor = grams / 100;
  return {
    calories_kcal: Math.round(per100g.calories_kcal * factor),
    protein_g: +(per100g.protein_g * factor).toFixed(1),
    carbs_g: +(per100g.carbs_g * factor).toFixed(1),
    fat_g: +(per100g.fat_g * factor).toFixed(1),
  };
}

// For recipes: scale by servings or grams
function recipePortionMacros(
  recipe: Recipe,
  mode: 'servings' | 'grams',
  amount: number
): Macros {
  const factor = mode === 'servings'
    ? amount / recipe.servings
    : amount / recipe.total_weight_g;
  return {
    calories_kcal: Math.round(recipe.calories_kcal * factor),
    protein_g: +(recipe.protein_g * factor).toFixed(1),
    carbs_g: +(recipe.carbs_g * factor).toFixed(1),
    fat_g: +(recipe.fat_g * factor).toFixed(1),
  };
}
```

---

## 6. Bug Register

| # | Bug | Severity | Mitigation |
|---|-----|----------|------------|
| 1 | **Large image upload** — phone photos 3-8MB, slow on mobile | High | Resize to max 1200px JPEG quality 0.85 before base64. ~200-400KB result. |
| 2 | **Camera permission denied** | Medium | Catch `NotAllowedError`, show inline message "Camera access needed". Fall back to file picker. |
| 3 | **Blurry/unreadable label** | Medium | AI returns `confidence` field. Show warning banner + all fields editable + "Retake" button if confidence != high. |
| 4 | **Serving math rounding drift** | Low | Keep full precision during editing. Round only at final log time (Math.round for kcal, toFixed(1) for grams). |
| 5 | **No per-serving on label** (per 100g only) | Medium | AI extracts both when available. Frontend defaults to per_100g if serving_size_g is null. Unit toggle shows "grams" only. |
| 6 | **Sheet z-index vs TabBar** | High | Use `zIndex: 110` (TabBar is 100, per existing pattern). |
| 7 | **Date boundary** — scan at 11:59pm, log at 12:01am | Low | `date` prop passed through from FoodNutritionCard (already handles this). |
| 8 | **Double-tap camera** | Medium | Disable camera button while `scanState !== 'idle'`. Debounce file input onChange. |
| 9 | **iOS Safari capture attribute** | Medium | Use `accept="image/*"` without `capture` as primary (lets user choose camera OR library). Add `capture="environment"` only as enhancement. |
| 10 | **Base64 too large for JSON body** | Medium | After resize, typical payload is 200-400KB. Backend should allow 2MB body limit. FastAPI default is fine (no change needed). |
| 11 | **Recipe ingredient parse misses items** | Medium | Show parsed ingredients as editable list. User can add/remove/edit before saving. Manual "Add ingredient" always available. |
| 12 | **Recipe total macros drift from ingredient sum** | Low | Always recompute totals from ingredients on save (never trust stored totals alone). Frontend recalculates on any ingredient edit. |
| 13 | **Saved meals vs recipes confusion** | Medium | Clear visual distinction: Saved tab = simple items (chip style), Recipes tab = cards with ingredient count + serving info. |
| 14 | **Recipe delete cascade** | Low | Recipes are standalone — no FK to food_logs. Deleting a recipe doesn't affect past logged entries (those are in food_logs with macros copied at log time). |
| 15 | **Memory/canvas leak on repeated scans** | Low | Revoke objectURL after image loads. Nullify canvas reference after encoding. |
| 16 | **EXIF orientation** — photo appears rotated | Medium | Use `createImageBitmap()` with `{imageOrientation: 'flipY'}` or let canvas handle it. Modern browsers auto-apply EXIF since ~2020. Test on iOS Safari. |
| 17 | **Offline/slow network** — scan times out | Medium | 30s timeout on scan request. Show "Taking too long? Try a clearer photo" after 15s. Abort controller on sheet close. |
| 18 | **Recipe with 0 servings or 0 total_weight_g** | Low | Validate on save: servings > 0, total_weight_g > 0. Disable save button if invalid. |

---

## 7. Build Order

### Phase 1: Label Scan (core infra + single product)
1. Backend: `recipes` table DDL in `main.py` lifespan
2. Backend: `parse_label_image()` in `claude_service.py` (vision API)
3. Backend: `POST /api/log/food/scan` endpoint
4. Backend: Recipe CRUD endpoints (`GET/POST/PATCH/DELETE /api/recipes`)
5. Frontend: `useLabelScan` hook
6. Frontend: `LabelScanSheet` component
7. Frontend: Camera button in `FoodNutritionCard`

### Phase 2: Recipes (multi-ingredient, save/recall)
8. Frontend: `useRecipes` hook
9. Frontend: `RecipeSheet` component (create/edit)
10. Frontend: "Recipes" tab in `FoodNutritionCard` quick-add strip
11. Frontend: Recipe portion selection → stage → log

### Phase 3: Polish
12. Manage/edit/delete for both saved meals and recipes
13. Error states, loading skeletons, edge cases from bug register
