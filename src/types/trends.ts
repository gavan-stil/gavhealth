/* Strength trends types — matches A3/A4 backend response contracts */

export interface StrengthSession {
  id: number;
  date: string | null;          // T15-2b: non-null after backend fix
  session_date: string;         // kept for backward compat
  activity_log_id: number | null;
  duration_mins: number | null;
  avg_hr: number | null;
  calories: number | null;
  total_sets: number;
  total_reps: number;
  total_load_kg: number;
  avg_load_per_set_kg: number;
  exercises: string[];
  category: string;             // T15-2b: push | pull | legs | abs | mixed
}

export interface ExerciseSession {
  session_date: string;
  sets: number;
  total_reps: number;
  max_reps_in_set: number;
  top_weight_kg: number;
  session_volume_kg: number;
  estimated_1rm: number;
}

export interface ExerciseMuscle {
  muscle_group: string;
  macro_group: string;  // push | pull | legs | abs | other
  is_primary: boolean;
}

export interface Exercise {
  id: number;
  name: string;
  category: string;          // primary macro group, backwards compat
  muscles: ExerciseMuscle[];
}

export interface MuscleGroupDef {
  id: number;
  name: string;
  macro_group: string;
}
