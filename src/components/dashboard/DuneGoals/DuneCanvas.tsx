import { useRef, useEffect } from 'react';
import type { DuneSignalData } from '@/hooks/useDuneData';
import { DUNE_SIGNALS, gapToYFactor } from './signals';
import { getCrestY, getCrestY2, getCrestY3 } from './duneUtils';
import { makeParticle, updateParticle } from './particleSystem';
import type { Particle } from './particleSystem';

const W = 340;
const H = 320;
const PARTICLE_COUNT = 280;

interface Props {
  signals: DuneSignalData[];
}

type RenderSignal = {
  key: string;
  label: string;
  x: number;
  yFactor: number;
  data: DuneSignalData | undefined;
};

function signalColour(yFactor: number): [number, number, number] {
  const warmth = Math.max(0, 1 - yFactor * 1.1);
  return [
    Math.round(85  + warmth * 165),
    Math.round(38  + warmth * 100),
    Math.round(10  + warmth * 28),
  ];
}

function formatValue(val: number, key: string): string {
  if (key === 'water_ml')    return (val / 1000).toFixed(2) + 'L';
  if (key === 'sleep_hrs')   return val.toFixed(1) + 'hr';
  if (key === 'protein_g')   return Math.round(val) + 'g';
  if (key === 'calories_in') return Math.round(val) + ' cal';
  return String(val);
}

function formatGap(gap: number, key: string): string {
  const abs = Math.abs(gap);
  let str: string;
  if (key === 'water_ml')         str = (abs / 1000).toFixed(2) + 'L';
  else if (key === 'sleep_hrs')   str = abs.toFixed(1) + 'hr';
  else if (key === 'protein_g')   str = Math.round(abs) + 'g';
  else if (key === 'calories_in') str = Math.round(abs) + ' cal';
  else str = String(abs);
  return (gap >= 0 ? '+' : '\u2212') + str;
}

export default function DuneCanvas({ signals }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Non-null assertion safe: canvas element is mounted
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    const particles: Particle[] = Array.from(
      { length: PARTICLE_COUNT },
      () => makeParticle(W, H, true),
    );

    const renderSignals: RenderSignal[] = DUNE_SIGNALS.map(def => {
      const data   = signals.find(s => s.key === def.key);
      const gapPct = data?.value != null ? data.gapPct : 0;
      return { key: def.key, label: def.label, x: def.x, yFactor: gapToYFactor(gapPct), data };
    });

    let animId: number;
    let phase   = 0;
    let running = false;

    // ── Background ───────────────────────────────────────────────────
    function drawBG() {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0,   '#100a05');
      sky.addColorStop(0.2, '#1c1008');
      sky.addColorStop(1,   '#0a0604');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Back ridge ───────────────────────────────────────────────────
    function drawRidge3() {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const y = getCrestY3(x, phase, W, H);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath();
      ctx.fillStyle = 'rgba(55,22,8,0.4)'; ctx.fill();

      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const y = getCrestY3(x, phase, W, H);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(150,65,18,0.18)'; ctx.lineWidth = 0.8; ctx.stroke();
    }

    // ── Mid ridge ────────────────────────────────────────────────────
    function drawRidge2() {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const y = getCrestY2(x, phase, W, H);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
      const g2 = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      g2.addColorStop(0,   'rgba(120,48,12,0.0)');
      g2.addColorStop(0.3, 'rgba(110,42,10,0.55)');
      g2.addColorStop(1,   'rgba(38,13,3,0.90)');
      ctx.fillStyle = g2; ctx.fill();

      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const y = getCrestY2(x, phase, W, H);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(195,85,25,0.32)'; ctx.lineWidth = 1.2; ctx.stroke();
    }

    // ── Main dune face + crest glow + striations ─────────────────────
    function drawMainDune() {
      ctx.beginPath();
      for (let x = 0; x <= W; x++) {
        const y = getCrestY(x, phase, W, H);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
      const gFace = ctx.createLinearGradient(0, H * 0.1, 0, H);
      gFace.addColorStop(0.00, '#c85e18');
      gFace.addColorStop(0.12, '#a84010');
      gFace.addColorStop(0.30, '#7a2a08');
      gFace.addColorStop(0.55, '#4a1404');
      gFace.addColorStop(0.80, '#2c0c02');
      gFace.addColorStop(1.00, '#180602');
      ctx.fillStyle = gFace; ctx.fill();

      // Crest glow — 3 passes
      const glowPasses: [string, number][] = [
        ['rgba(255,155,45,0.12)', 10],
        ['rgba(255,135,38,0.32)', 3.5],
        ['rgba(255,205,95,0.68)', 1.2],
      ];
      for (const [col, lw] of glowPasses) {
        ctx.beginPath();
        for (let x = 0; x <= W; x++) {
          const y = getCrestY(x, phase, W, H);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
      }

      // Wind striations
      for (let i = 0; i < 16; i++) {
        const yFrac = 0.10 + i * 0.055;
        ctx.beginPath();
        let started = false;
        for (let x = 0; x <= W; x += 3) {
          const cY = getCrestY(x, phase, W, H);
          const y  = cY + yFrac * (H - cY) + Math.sin(x * 0.07 + i * 1.4) * 2.5;
          if (y < H - 5) {
            if (!started) { ctx.moveTo(x, y); started = true; }
            else ctx.lineTo(x, y);
          } else started = false;
        }
        const a = 0.03 + (i / 16) * 0.05;
        ctx.strokeStyle = `rgba(60,22,6,${a})`; ctx.lineWidth = 0.5; ctx.stroke();
      }
    }

    // ── Particles (born at crest, fall downward) ─────────────────────
    function drawParticles() {
      particles.forEach(p => {
        updateParticle(p, W, H);
        const crestY = getCrestY(p.x, phase, W, H);
        const py = crestY + p.yOffset;
        if (py > H || py < crestY || p.x < 0 || p.x > W) return;

        const distFade = Math.max(0, 1 - p.yOffset / (H * 0.55));
        const lifeFade = Math.sin(Math.min(p.life, 1) * Math.PI);
        const alpha    = p.alpha * lifeFade * (0.3 + distFade * 0.7);
        const warmth   = distFade;
        const r = Math.round(160 + warmth * 90);
        const g = Math.round(65  + warmth * 75);
        const b = Math.round(15  + warmth * 25);

        ctx.beginPath();
        ctx.arc(p.x, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
      });
    }

    // ── Crosshair dot ────────────────────────────────────────────────
    function drawCrosshair(px: number, py: number, yFactor: number) {
      const [r, g, b] = signalColour(yFactor);
      const warmth    = Math.max(0, 1 - yFactor * 1.1);
      const baseAlpha = 0.55 + warmth * 0.45;
      const lr = Math.min(255, r + 55);
      const lg = Math.min(255, g + 48);
      const lb = Math.min(255, b + 18);

      const glowR = 16 + warmth * 12;
      const glow  = ctx.createRadialGradient(px, py, 0, px, py, glowR);
      glow.addColorStop(0, `rgba(${r},${g},${b},${0.28 * warmth})`);
      glow.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(px, py, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow; ctx.fill();

      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r},${g},${b},${baseAlpha})`;
      ctx.lineWidth = 1.2; ctx.stroke();

      ctx.beginPath(); ctx.arc(px, py, 5.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${lr},${lg},${lb},${baseAlpha})`;
      ctx.lineWidth = 0.75; ctx.stroke();

      ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,245,210,${0.65 + warmth * 0.35})`;
      ctx.fill();
    }

    // ── Label (beside crosshair, left or right based on x) ───────────
    function drawLabel(px: number, py: number, sig: RenderSignal) {
      const [r, g, b] = signalColour(sig.yFactor);
      const warmth     = Math.max(0, 1 - sig.yFactor * 1.1);
      const labelAlpha = 0.45 + warmth * 0.45;
      const goLeft     = sig.x > 0.58;
      const lx         = goLeft ? px - 14 : px + 14;
      ctx.textAlign    = goLeft ? 'right' : 'left';

      ctx.font      = "600 8px 'Inter', sans-serif";
      ctx.fillStyle = `rgba(${Math.min(255, r + 40)},${Math.min(255, g + 30)},${Math.min(255, b + 10)},${labelAlpha * 0.80})`;
      ctx.textBaseline = 'bottom';
      ctx.fillText(sig.label.toUpperCase(), lx, py - 1);

      if (sig.data?.value != null) {
        ctx.font      = "600 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = `rgba(255,232,175,${labelAlpha})`;
        ctx.textBaseline = 'top';
        ctx.fillText(formatValue(sig.data.value, sig.key), lx, py + 2);

        ctx.font      = "400 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = sig.data.gap >= 0
          ? `rgba(232,196,122,${labelAlpha * 0.85})`
          : `rgba(180,100,60,${labelAlpha * 0.85})`;
        ctx.textBaseline = 'top';
        ctx.fillText(formatGap(sig.data.gap, sig.key), lx, py + 14);
      }
    }

    // ── Main render ──────────────────────────────────────────────────
    function drawFrame() {
      ctx.clearRect(0, 0, W, H);
      drawBG();
      drawRidge3();
      drawRidge2();
      drawMainDune();
      drawParticles();

      const positions: { px: number; py: number; sig: RenderSignal }[] = [];
      renderSignals.forEach(sig => {
        const px     = sig.x * W;
        const crestY = getCrestY(px, phase, W, H);
        const availH = H - crestY - 24;
        const py     = crestY + 20 + sig.yFactor * availH * 0.82;
        positions.push({ px, py, sig });
        drawCrosshair(px, py, sig.yFactor);
      });
      positions.forEach(({ px, py, sig }) => drawLabel(px, py, sig));
    }

    // ── Animation loop ───────────────────────────────────────────────
    function startLoop() {
      if (running) return;
      running = true;
      function frame() {
        phase += 0.008;
        drawFrame();
        animId = requestAnimationFrame(frame);
      }
      animId = requestAnimationFrame(frame);
    }

    function stopLoop() {
      cancelAnimationFrame(animId);
      running = false;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) startLoop();
      else stopLoop();
    }, { threshold: 0.1 });
    observer.observe(canvas);
    startLoop();

    return () => {
      stopLoop();
      observer.disconnect();
    };
  }, [signals]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    />
  );
}
