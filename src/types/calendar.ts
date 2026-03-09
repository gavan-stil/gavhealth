export type CategoryName = "weight" | "sleep" | "heart" | "running" | "strength" | "ride" | "sauna";

export type CategoryDot = {
  category: CategoryName;
  color: string;
  /** Primary duration/value label, e.g. "45m", "7.2h", "78.5" */
  duration?: string;
  /** Sub-metric values keyed by sub-toggle id */
  subMetrics?: Record<string, string>;
  isLetsGo?: boolean;       // effort === 'lets_go' → show ▲
  isInterval?: boolean;     // run name contains interval/tempo/sprint/repeat/fartlek → show ▲
  saunaHasDevotion?: boolean; // did_devotions === true → show ▲
  workoutSplit?: 'push' | 'pull' | 'legs'; // strength session split type
};

/** Key: YYYY-MM-DD, Value: array of category dots present that day */
export type CalendarData = Record<string, CategoryDot[]>;

/** Sub-toggle definitions per category */
export const SUB_TOGGLE_DEFS: Record<CategoryName, { id: string; label: string }[]> = {
  running: [
    { id: "dist", label: "Dist" },
    { id: "pace", label: "Pace" },
    { id: "bpm", label: "BPM" },
  ],
  strength: [
    { id: "sets", label: "Sets" },
    { id: "bpm", label: "BPM" },
  ],
  ride: [
    { id: "dist", label: "Dist" },
    { id: "speed", label: "Speed" },
  ],
  sleep: [
    { id: "deep", label: "Deep%" },
  ],
  heart: [
    { id: "rhr", label: "RHR" },
  ],
  weight: [
    { id: "kg", label: "kg" },
    { id: "delta", label: "Δ" },
  ],
  sauna: [
    { id: "mins", label: "Mins" },
    { id: "temp", label: "Temp" },
  ],
};

export const CATEGORY_COLORS: Record<CategoryName, string> = {
  weight: "#e8c47a",
  sleep: "#7FAABC",
  heart: "#c4856a",
  running: "#b8a878",
  strength: "#b47050",
  ride: "#c4789a",
  sauna: "#c45a4a",
};

export const CATEGORY_ORDER: CategoryName[] = [
  "weight", "sleep", "heart", "running", "strength", "ride", "sauna",
];

export const CATEGORY_LABELS: Record<CategoryName, string> = {
  weight: "Weight",
  sleep: "Sleep",
  heart: "Heart",
  running: "Running",
  strength: "Strength",
  ride: "Ride",
  sauna: "Sauna",
};
