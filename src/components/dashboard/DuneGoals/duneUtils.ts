// Foreground dune — dominant, warm, lit crest
export function getCrestY(x: number, phase: number, W: number, H: number): number {
  const t = x / W;
  return H * (
    0.18
    + 0.10 * Math.sin(t * Math.PI * 1.0 + 0.3)
    - 0.06 * Math.sin(t * Math.PI * 2.2 + 0.8)
    + 0.03 * Math.sin(t * Math.PI * 4.0 + 1.2)
    + 0.015 * Math.sin(phase * 0.3 + t * 6.0)
  );
}

// Mid ridge — behind foreground, cooler
export function getCrestY2(x: number, phase: number, W: number, H: number): number {
  const t = x / W;
  return H * (
    0.06
    + 0.07 * Math.sin(t * Math.PI * 1.0 - 0.4)
    - 0.04 * Math.sin(t * Math.PI * 2.0 + 1.2)
    + 0.02 * Math.sin(t * Math.PI * 3.5 + 0.5)
    + 0.010 * Math.sin(phase * 0.2 + t * 5.0 + 1.0)
  );
}

// Back ridge — barely visible, near top edge
export function getCrestY3(x: number, phase: number, W: number, H: number): number {
  const t = x / W;
  return H * (
    0.02
    + 0.035 * Math.sin(t * Math.PI * 1.2 - 0.8)
    + 0.008 * Math.sin(phase * 0.15 + t * 4.0 + 2.0)
  );
}
