export type DuneSignalConfig = {
  key: string;
  label: string;
  unit: string;
  goalKey: string;
  x: number; // 0..1 fraction of canvas width — spread to avoid label collisions
};

export const DUNE_SIGNALS: DuneSignalConfig[] = [
  { key: 'protein_g',   label: 'Protein',  unit: 'g',   goalKey: 'protein_g',   x: 0.20 },
  { key: 'calories_in', label: 'Calories', unit: 'cal', goalKey: 'calories_in', x: 0.42 },
  { key: 'sleep_hrs',   label: 'Sleep',    unit: 'hr',  goalKey: 'sleep_hrs',   x: 0.63 },
  { key: 'water_ml',    label: 'Water',    unit: 'L',   goalKey: 'water_ml',    x: 0.82 },
];

// Continuous yFactor from gap percentage.
// gapPct = (today - targetMid) / targetMid
// +0.25 (exceeding) → 0.02 (near crest, warm)
// -0.50 (far off)   → 0.85 (deep in shadow)
const GAP_MAX = 0.25;
const GAP_MIN = -0.50;
const Y_MIN = 0.02;
const Y_MAX = 0.85;

export function gapToYFactor(gapPct: number): number {
  const clamped = Math.max(GAP_MIN, Math.min(GAP_MAX, gapPct));
  const t = (clamped - GAP_MAX) / (GAP_MIN - GAP_MAX); // 0=exceeding, 1=far off
  return Y_MIN + t * (Y_MAX - Y_MIN);
}
