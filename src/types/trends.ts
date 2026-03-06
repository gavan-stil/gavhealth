/* Strength trends types — matches A3/A4 backend response contracts */

export interface StrengthSession {
  id: number;
  session_date: string;
  activity_log_id: number | null;
  duration_mins: number | null;
  avg_hr: number | null;
  calories: number | null;
  total_sets: number;
  total_reps: number;
  total_load_kg: number;
  avg_load_per_set_kg: number;
  exercises: string[];
}

export interface ExerciseSession {
  session_date: string;
  sets: number;
  total_reps: number;
  top_weight_kg: number;
  session_volume_kg: number;
  estimated_1rm: number;
}

export interface Exercise {
  id: number;
  name: string;
  category: string;
}
