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

export const FOOD_TARGETS: MacroTotals = {
  kcal: 2358,
  protein_g: 180,
  carbs_g: 260,
  fat_g: 80,
};
