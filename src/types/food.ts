export type SavedMeal = {
  id: number;
  name: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type FoodLogEntry = {
  id: number;
  name: string;          // maps to description_raw in food_logs
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  log_date: string;
};

// Shape returned by POST /api/log/food (AI parse — no DB write)
export type ParsedItem = {
  name: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type MacroTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

// ── Label scan types ──────────────────────────────────────────────────────
export type Macros = {
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type LabelScanResult = {
  name: string;
  per_serving: Macros;
  serving_size_g: number | null;
  servings_per_container: number | null;
  per_100g: Macros | null;
  confidence: 'high' | 'medium' | 'low';
};

export type RecipeScanResult = {
  name: string;
  ingredients: RecipeIngredient[];
  totals: Macros;
  confidence: 'high' | 'medium' | 'low';
};

// ── Recipe types ──────────────────────────────────────────────────────────
export type RecipeIngredient = {
  name: string;
  grams: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type Recipe = {
  id: number;
  name: string;
  total_weight_g: number | null;
  servings: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: RecipeIngredient[];
  created_at: string;
  updated_at: string;
};

export const FOOD_TARGETS: MacroTotals = {
  kcal: 2358,
  protein_g: 180,
  carbs_g: 260,
  fat_g: 80,
};
