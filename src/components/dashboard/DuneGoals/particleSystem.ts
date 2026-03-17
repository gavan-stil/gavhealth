export type Particle = {
  x: number;
  yOffset: number;  // distance below crest — 0=at crest, increases downward
  vy: number;       // downward velocity (positive)
  vx: number;       // rightward drift
  size: number;
  alpha: number;
  life: number;     // 0..1
  lifeSpeed: number;
};

export function makeParticle(W: number, H: number, scattered: boolean): Particle {
  return {
    x:         Math.random() * W,
    yOffset:   scattered ? Math.random() * H * 0.6 : Math.random() * 6,
    vy:        0.5 + Math.random() * 1.8,
    vx:        0.1 + Math.random() * 0.6,
    size:      0.4 + Math.random() * 1.5,
    alpha:     0.15 + Math.random() * 0.70,
    life:      scattered ? Math.random() : 0,
    lifeSpeed: 0.003 + Math.random() * 0.007,
  };
}

export function updateParticle(p: Particle, W: number, H: number): void {
  p.yOffset += p.vy;
  p.x       += p.vx;
  p.life    += p.lifeSpeed;

  if (p.life > 1 || p.yOffset > H * 0.85 || p.x > W + 10) {
    p.x        = Math.random() * W;
    p.yOffset  = Math.random() * 6;
    p.vy       = 0.5 + Math.random() * 1.8;
    p.vx       = 0.1 + Math.random() * 0.6;
    p.size     = 0.4 + Math.random() * 1.5;
    p.alpha    = 0.15 + Math.random() * 0.70;
    p.life     = 0;
    p.lifeSpeed = 0.003 + Math.random() * 0.007;
  }
}
