export const MOCK_PARSED_FOOD = {
  items: [
    { name: "Chicken breast", calories: 280, protein_g: 52 },
    { name: "Brown rice", calories: 220, protein_g: 5 },
    { name: "Broccoli", calories: 40, protein_g: 3 },
  ],
  total_calories: 540,
};

export const MOCK_LAST_PUSH_SESSION = {
  date: "2026-03-01",
  exercises: [
    {
      name: "Bench Press",
      superset: false,
      sets: [
        { load_type: "kg" as const, kg: 80, reps: 8 },
        { load_type: "kg" as const, kg: 85, reps: 6 },
        { load_type: "kg" as const, kg: 85, reps: 5 },
      ],
    },
    {
      name: "Incline DB Press",
      superset: false,
      sets: [
        { load_type: "kg" as const, kg: 30, reps: 10 },
        { load_type: "kg" as const, kg: 32, reps: 8 },
      ],
    },
    {
      name: "OHP",
      superset: false,
      sets: [
        { load_type: "kg" as const, kg: 60, reps: 8 },
        { load_type: "kg" as const, kg: 60, reps: 7 },
      ],
    },
  ],
};

export const MOCK_ACTIVITY_FEED = [
  {
    id: 1,
    type: "run" as const,
    name: "Morning Run",
    date: "2026-03-04",
    duration_minutes: 42,
    avg_bpm: 158,
    distance_km: 7.2,
    pace_min_km: "5:49",
    effort: "mid" as const,
    effort_is_default: true,
  },
  {
    id: 2,
    type: "strength" as const,
    name: "Strength Training",
    date: "2026-03-03",
    duration_minutes: 58,
    avg_bpm: 134,
    total_sets: 18,
    workout_split: "push",
    effort: "lets_go" as const,
    effort_is_default: false,
  },
  {
    id: 3,
    type: "sauna" as const,
    name: "Sauna Session",
    date: "2026-03-03",
    duration_minutes: 25,
    avg_bpm: 112,
    meditation_minutes: 10,
    devotions: true,
    effort: "mid" as const,
    effort_is_default: true,
  },
  {
    id: 4,
    type: "ride" as const,
    name: "Afternoon Ride",
    date: "2026-03-02",
    duration_minutes: 65,
    avg_bpm: 145,
    distance_km: 28.4,
    avg_speed_kmh: 26.2,
    effort: "basic" as const,
    effort_is_default: false,
  },
];
