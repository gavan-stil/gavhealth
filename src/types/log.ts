export type EffortLevel = 'basic' | 'mid' | 'lets_go';
export type LoadType = 'kg' | 'bw' | 'bw+';
export type WorkoutSplit = 'push' | 'pull' | 'legs' | 'abs';

export type WorkoutSet = { load_type: LoadType; kg: number; reps: number };
export type WorkoutExercise = { name: string; superset: boolean; sets: WorkoutSet[] };

export type ActivityFeedItem = {
  id: number;
  type: string;
  date: string;
  duration_minutes: number;
  avg_bpm: number | null;
  effort: EffortLevel;
  effort_manually_set: boolean;
};
