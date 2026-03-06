export const MOCK_READINESS = {
  score: 78,
  breakdown: {
    sleep_score: 82,
    rhr_score: 75,
    activity_balance: 70,
    recovery_score: 85,
  },
  narrative:
    "Solid recovery overnight. Deep sleep was above your 30-day average and resting heart rate has been trending down. You're well-positioned for a harder session today.",
};

export const MOCK_DAILY_SUMMARY = {
  date: "2026-03-04",
  weight_kg: 78.2,
  sleep: { duration_hrs: 7.4, deep_pct: 22 },
  rhr_bpm: 52,
  activities: [
    { type: "run", name: "Easy 5k", distance_km: 5.1, date: "2026-03-04" },
    { type: "strength", name: "Upper Body", sets: 18, date: "2026-03-03" },
    { type: "run", name: "Tempo 8k", distance_km: 8.2, date: "2026-03-02" },
  ],
};

export const MOCK_STREAKS = {
  running_streak: 3,
  strength_streak: 5,
  sauna_streak: 2,
  habits_streak: 12,
};
