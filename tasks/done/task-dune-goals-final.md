# Task — Dune Goals Visualisation

**Status:** Ready to build  
**Depends on:** `/api/momentum/signals` + `/api/goals` endpoints (both live)  
**Route:** Dashboard — new card, sits below ReadinessCard  
**Reference mockup:** `archive/dune-goals-v2.html` — open in browser before building

---

## Concept

A living desert dune landscape. The crest of the dune runs as an organic asymmetric curve across the upper portion of the canvas — a slow-breathing ridge lit with a hot burning gold-orange edge. Sand particles are born at the crest and fall/stream downward and rightward, cascading down the dune face, warming in colour near the crest and dimming as they fall into shadow.

Crosshair markers (one per signal) are fixed at different vertical positions below the crest. **Vertical position = goal alignment:**

- **Close to the crest (high up, warm)** = on track or exceeding target. Particles stream past them as they fall.
- **Deep in the shadow (low down, dim)** = off track. Sitting in the cool dark below the particle stream.

There are no rings, no axes, no chart elements. The landscape IS the data. Warm and close = good. Dark and far = needs attention.

---

## Scope

**DOES:**
- Build `DuneGoalsCard.tsx` — full card with canvas + summary rows
- Canvas: animated dune landscape, 340×320px
- Summary rows: one per signal, value + gap from target, collapsible
- Pull live data from `/api/momentum/signals?days=7` + `/api/goals`
- Loading skeleton + error state with retry
- Animation pauses when not visible (IntersectionObserver)

**DOES NOT:**
- Replace MomentumCard — sits alongside it on Dashboard
- Add tap-on-crosshair interaction in v1
- Add full-screen expand in v1
- Touch Calendar, Log, or Trends routes

---

## Pre-flight

Curl-verify both endpoints before writing any code. Field names have been wrong before — live response is source of truth.

```bash
curl -H "X-API-Key: gavhealth-prod-api-2026-xK9mP3" \
  "https://gavhealth-production.up.railway.app/api/momentum/signals?days=7"

curl -H "X-API-Key: gavhealth-prod-api-2026-xK9mP3" \
  "https://gavhealth-production.up.railway.app/api/goals"
```

---

## Design Tokens

```css
:root {
  --bg-base: #0d0d0a;
  --bg-card: #14130f;
  --bg-elevated: #1e1d18;
  --border-default: #222018;
  --border-subtle: #1a1914;
  --text-primary: #f0ece4;
  --text-secondary: #b0a890;
  --text-muted: #7a7060;
  --ochre: #d4a04a;
  --ochre-light: #e8c47a;
  --signal-good: #e8c47a;
  --signal-poor: #c47a6a;
  --space-sm: 8px;
  --space-md: 14px;
  --space-lg: 20px;
  --radius-lg: 20px;
  --radius-pill: 100px;
}
```

Fonts: Inter (labels/text), JetBrains Mono (values/numbers). No emoji. No icons except lucide-react.

---

## Canvas Dimensions

- Width: 340px (full card width, no padding on canvas)
- Height: 320px
- Card has `overflow: hidden` — canvas bleeds to edges, footer sits below

---

## Dune Crest Curves

Three ridgelines at different depths. All defined as sum-of-sines for organic feel. Phase argument drives the slow breathing animation.

```typescript
// Foreground dune — dominant, warm, lit
function getCrestY(x: number, phase: number, W: number, H: number): number {
  const t = x / W;
  return H * (
    0.18
    + 0.10 * Math.sin(t * Math.PI * 1.0 + 0.3)
    - 0.06 * Math.sin(t * Math.PI * 2.2 + 0.8)
    + 0.03 * Math.sin(t * Math.PI * 4.0 + 1.2)
    + 0.015 * Math.sin(phase * 0.3 + t * 6.0)
  );
}

// Mid ridge — behind foreground, cooler, less prominent
function getCrestY2(x: number, phase: number, W: number, H: number): number {
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
function getCrestY3(x: number, phase: number, W: number, H: number): number {
  const t = x / W;
  return H * (
    0.02
    + 0.035 * Math.sin(t * Math.PI * 1.2 - 0.8)
    + 0.008 * Math.sin(phase * 0.15 + t * 4.0 + 2.0)
  );
}

// Phase increments by 0.008 per frame
```

---

## Dune Draw Order (back to front)

### 1. Background fill
```typescript
const sky = ctx.createLinearGradient(0, 0, 0, H);
sky.addColorStop(0,   '#100a05');
sky.addColorStop(0.2, '#1c1008');
sky.addColorStop(1,   '#0a0604');
ctx.fillStyle = sky;
ctx.fillRect(0, 0, W, H);
```

### 2. Back ridge (getCrestY3)
- Fill above the ridge line: `rgba(55,22,8,0.4)`
- Crest stroke: `rgba(150,65,18,0.18)`, lineWidth 0.8

### 3. Mid ridge (getCrestY2)
- Fill below ridge line to canvas bottom — gradient:
  - 0%: `rgba(120,48,12,0.0)`
  - 30%: `rgba(110,42,10,0.55)`
  - 100%: `rgba(38,13,3,0.90)`
- Crest stroke: `rgba(195,85,25,0.32)`, lineWidth 1.2

### 4. Foreground dune (getCrestY) — main fill
Fill from crest down to canvas bottom:
```typescript
const gFace = ctx.createLinearGradient(0, H * 0.1, 0, H);
gFace.addColorStop(0.00, '#c85e18');  // lit just below crest
gFace.addColorStop(0.12, '#a84010');
gFace.addColorStop(0.30, '#7a2a08');
gFace.addColorStop(0.55, '#4a1404');
gFace.addColorStop(0.80, '#2c0c02');
gFace.addColorStop(1.00, '#180602');
```

### 5. Crest glow — 3 passes on getCrestY
- Outer halo: `rgba(255,155,45,0.12)`, lineWidth 10
- Mid glow: `rgba(255,135,38,0.32)`, lineWidth 3.5
- Hot edge: `rgba(255,205,95,0.68)`, lineWidth 1.2

### 6. Wind striations
16 fine lines across the dune face — subtle erosion texture:
```typescript
for (let i = 0; i < 16; i++) {
  const yFrac = 0.10 + i * 0.055;
  // Each striation: y = crestY + yFrac * (H - crestY) + sin wobble
  // strokeStyle: rgba(60,22,6, 0.03 + (i/16)*0.05)
  // lineWidth: 0.5
}
```

---

## Particles

Born at the dune crest. Fall **downward** and drift **rightward**. Warm near the crest, cool as they fall. This is the key motion — sand streaming off the crest and cascading down the face.

```typescript
type Particle = {
  x: number;
  yOffset: number;    // distance below crest. 0 = at crest, increases downward
  vy: number;         // downward velocity (positive = down)
  vx: number;         // rightward drift
  size: number;
  alpha: number;
  life: number;       // 0..1
  lifeSpeed: number;
};

// Spawn values:
// x: random 0..W
// yOffset: 0..6px (born right at crest)
// vy: 0.5 + random * 1.8   (falls at varying speeds)
// vx: 0.1 + random * 0.6   (drifts rightward)
// size: 0.4 + random * 1.5
// alpha: 0.15 + random * 0.70
// life: 0
// lifeSpeed: 0.003 + random * 0.007

// Per frame update:
p.yOffset += p.vy;   // fall down
p.x += p.vx;         // drift right
p.life += p.lifeSpeed;

// Respawn condition: life > 1 OR yOffset > H*0.85 OR x > W+10

// Draw:
const crestY = getCrestY(p.x, phase, W, H);
const py = crestY + p.yOffset;

// Alpha: sin fade on life cycle × distance fade
const lifeFade = Math.sin(Math.min(p.life, 1) * Math.PI);
const distFade = Math.max(0, 1 - p.yOffset / (H * 0.55));
const alpha = p.alpha * lifeFade * (0.3 + distFade * 0.7);

// Colour: warm near crest, dims as falls
const warmth = distFade;
const r = Math.round(160 + warmth * 90);
const g = Math.round(65 + warmth * 75);
const b = Math.round(15 + warmth * 25);
```

Particle count: 280. Initialise scattered (random yOffset across full face) so canvas isn't empty on load.

---

## Signal Crosshairs

### Positioning

Each signal has an `x` (horizontal position, 0..1 fraction of W) and `yFactor` (vertical depth below crest, 0..1).

```typescript
type DuneSignal = {
  key: string;        // matches /api/momentum/signals field
  label: string;
  unit: string;
  goalKey: string;    // matches /api/goals signal field
  x: number;         // 0..1 fraction of canvas width
  yFactor: number;   // 0 = right at crest, 1 = deep in shadow
};

// yFactor is computed from gap-from-target at render time:
// gap >= +15%  → yFactor 0.08  (exceeding — very close to crest)
// gap >= -8%   → yFactor 0.25  (on target)
// gap >= -35%  → yFactor 0.54  (off track)
// gap <  -35%  → yFactor 0.75  (well off track)

// Pixel position:
const px = sig.x * W;
const crestY = getCrestY(px, phase, W, H);
const availableH = H - crestY - 24;
const py = crestY + 20 + sig.yFactor * availableH * 0.82;
```

X positions for 4 signals (spread them so labels don't collide):
```typescript
// Protein:  x = 0.22
// Sleep:    x = 0.55
// Water:    x = 0.72
// Calories: x = 0.38
```

### Crosshair style

Crosshair brightness and colour is driven by `proximity = 1 - yFactor` (1 = at crest, 0 = deep shadow).

```typescript
const warmth = proximity;  // 0..1
const r = Math.round(85 + warmth * 165);
const g = Math.round(38 + warmth * 100);
const b = Math.round(10 + warmth * 28);
const baseAlpha = 0.55 + warmth * 0.45;

// Glow: radialGradient 0→(16 + warmth*12)px, col at 28%*warmth → transparent
// Outer ring: 9px radius, stroke col at baseAlpha, lineWidth 1.2
// Inner ring: 5.5px radius, stroke lighter col at baseAlpha, lineWidth 0.75
// Pinpoint: 1.8px radius, fill rgba(255,245,210, 0.65+warmth*0.35)
```

### Labels

Float above and below each crosshair. Fade with proximity.

```typescript
const labelAlpha = 0.45 + warmth * 0.45;

// Signal name — above crosshair (textBaseline: bottom, y = py - 13)
// Font: Inter 600 8px, uppercase, colour rgba(r+40, g+30, b+10, labelAlpha)

// Value — below crosshair (textBaseline: top, y = py + 13)
// Font: JetBrains Mono 600 11px, rgba(255,235,180, labelAlpha)
// Format: value + unit e.g. "192g", "6.4hr", "1.25L"

// Gap — below value (y = py + 25)
// Font: JetBrains Mono 400 9px
// Positive gap: rgba(232,196,122, labelAlpha)  — ochre
// Negative gap: rgba(180,100,60, labelAlpha)   — rust
// Format: gap + unit e.g. "+12g", "−0.6hr"
```

---

## Data Hook

```typescript
// src/hooks/useDuneData.ts

type DuneSignalData = {
  key: string;
  label: string;
  unit: string;
  value: number | null;       // today's value
  targetMin: number;
  targetMax: number;
  gap: number;                // today - targetMid
  gapPct: number;             // gap / targetMid — drives yFactor
};

type DuneData = {
  signals: DuneSignalData[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

function useDuneData(): DuneData
// Fetches /api/momentum/signals?days=7 + /api/goals in parallel
// today = days[days.length - 1]
// targetMid = (target_min + target_max) / 2
// gapPct = (value - targetMid) / targetMid
// On partial failure: return available signals + error message
```

---

## Signal Configuration

```typescript
// src/components/dashboard/DuneGoals/signals.ts

export const DUNE_SIGNALS = [
  { key: 'protein_g',   label: 'Protein',  unit: 'g',   goalKey: 'protein_g',   x: 0.22 },
  { key: 'sleep_hrs',   label: 'Sleep',    unit: 'hr',  goalKey: 'sleep_hrs',   x: 0.55 },
  { key: 'water_ml',    label: 'Water',    unit: 'ml',  goalKey: 'water_ml',    x: 0.72 },
  { key: 'calories_in', label: 'Calories', unit: 'cal', goalKey: 'calories_in', x: 0.38 },
];

// yFactor computed from gapPct at render time — not stored in config
function gapToYFactor(gapPct: number): number {
  if (gapPct >= 0.15)  return 0.08;
  if (gapPct >= -0.08) return 0.25;
  if (gapPct >= -0.35) return 0.54;
  return 0.75;
}
```

---

## Component Structure

```
src/components/dashboard/DuneGoals/
├── index.ts                  — re-exports DuneGoalsCard
├── signals.ts                — DUNE_SIGNALS config, gapToYFactor()
├── duneUtils.ts              — getCrestY, getCrestY2, getCrestY3
├── particleSystem.ts         — Particle type, makeParticle, updateParticle
├── useDuneData.ts            — data fetching hook
├── DuneCanvas.tsx            — canvas + useEffect animation loop
├── DuneSummaryRows.tsx       — collapsible signal rows below canvas
└── DuneGoalsCard.tsx         — card shell
```

### DuneGoalsCard layout

```tsx
<div style={{
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
}}>
  {/* Canvas — full width, no padding */}
  {loading ? <CardSkeleton height={320} /> :
   error   ? <CardError onRetry={refetch} /> :
   <DuneCanvas data={duneData} width={340} height={320} />}

  {/* Footer */}
  <div style={{
    padding: '12px var(--space-lg)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid var(--border-subtle)',
  }}>
    <span className="label-text">Goals</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
      <span className="label-text" style={{ color: 'var(--ochre)' }}>
        {onTrackCount} of {total} on track
      </span>
      <ChevronDown size={12} color="var(--text-muted)" />
    </div>
  </div>

  {/* Summary rows — collapsed by default, tap footer to expand */}
  {expanded && <DuneSummaryRows signals={duneData.signals} />}
</div>
```

---

## Summary Rows

Collapsed by default. Tap footer chevron to expand.

One row per signal:
```
┌──────────────────────────────────────────────┐
│  [●] PROTEIN    192g    +12g ↑   [In Band]   │
│  [●] SLEEP      6.4hr   −0.6hr ↓ [Improving] │
│  [●] WATER      1.25L   −1.75L ↓ [Drifting]  │
│  [●] CALORIES   1.8k    −0.7k ↓  [Drifting]  │
└──────────────────────────────────────────────┘
```

Row styling:
- Container: `padding: var(--space-sm) var(--space-lg)`, `border-top: 1px solid var(--border-subtle)`
- Colour dot: 6px, colour matches signal warmth at its yFactor
- Label: Inter 600 10px uppercase, `var(--text-muted)`
- Value: JetBrains Mono 600 14px, `var(--text-primary)`
- Gap: JetBrains Mono 400 11px — positive: `var(--signal-good)`, negative: `var(--signal-poor)`
- Status pill: same pattern as MomentumCard — "In Band" / "Improving" / "Drifting"
- Trend arrow: Inter 600 11px, same colour as gap

Gap calculation:
```typescript
const targetMid = (goal.target_min + goal.target_max) / 2;
const gap = todayValue - targetMid;
const gapLabel = gap >= 0
  ? `+${formatValue(gap)}${unit}`
  : `−${formatValue(Math.abs(gap))}${unit}`;
```

---

## Dashboard Integration

```tsx
// DashboardPage.tsx
import DuneGoalsCard from '../components/dashboard/DuneGoals';

// Add below ReadinessCard
<DuneGoalsCard />
```

No props — card manages its own data fetching.

---

## Animation

```typescript
// useEffect cleanup pattern:
useEffect(() => {
  let animId: number;
  let phase = 0;

  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) startLoop();
    else cancelAnimationFrame(animId);
  });
  observer.observe(canvasRef.current!);

  function startLoop() {
    function frame() {
      phase += 0.008;
      // draw...
      animId = requestAnimationFrame(frame);
    }
    animId = requestAnimationFrame(frame);
  }

  return () => {
    cancelAnimationFrame(animId);
    observer.disconnect();
  };
}, [data]);
```

---

## API Reference

**Base URL:** `https://gavhealth-production.up.railway.app`
**Auth:** `X-API-Key: gavhealth-prod-api-2026-xK9mP3`

```
GET /api/momentum/signals?days=7
GET /api/goals
```

Curl-verify before building. Do not trust field names in this doc over live responses.

---

## Done-When

- [ ] Dune crest renders as organic asymmetric curve across upper canvas
- [ ] Three ridgelines visible at different depths — foreground warm, background cool
- [ ] Crest has hot burning gold-orange glow edge
- [ ] Particles born at crest, fall downward and drift rightward, warm near crest dim below
- [ ] 4 crosshair markers at correct vertical positions from live data
- [ ] Crosshairs close to crest = warm/bright, deep in shadow = dim/cool
- [ ] Labels (signal name, value, gap) float above/below each crosshair
- [ ] Gap label: ochre if positive, rust if negative
- [ ] Footer shows "N of 4 on track" from live data
- [ ] Tapping footer expands summary rows
- [ ] Summary rows show value, gap, status pill, trend arrow per signal
- [ ] Loading skeleton while data fetches
- [ ] Error state with retry
- [ ] Animation pauses when card not visible
- [ ] No TypeScript errors (`npm run build` succeeds)

---

## If Blocked

1. Curl-verify endpoints first — shape mismatches are the most common blocker
2. Check `reference/api.md` for latest verified endpoint shapes
3. Try 3 approaches before stopping
4. Do NOT loop — report blocker with specifics

---

## After Completion

1. Move this file to `tasks/done/`
2. Update `README.md`: Dashboard → "DuneGoalsCard added"
3. Add entry to `CHANGELOG.md`
