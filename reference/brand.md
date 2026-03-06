# GOE Brand System v1.2

> Single source of truth for all visual design tokens. Every task file copies the subset it needs inline.

---

## Palette

### Backgrounds

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-base` | `#0d0d0a` | Page background |
| `bg-card` | `#14130f` | Card surfaces |
| `bg-card-hover` | `#1c1b15` | Card hover/press |
| `bg-elevated` | `#1e1d18` | Modals, bottom sheets |

### Borders

| Token | Hex |
|-------|-----|
| `border-default` | `#222018` |
| `border-subtle` | `#1a1914` |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#f0ece4` | Headings, hero values |
| `text-secondary` | `#b0a890` | Body text |
| `text-tertiary` | `#9a9080` | Supporting labels |
| `text-muted` | `#7a7060` | Disabled, placeholders |

### Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `ochre` | `#d4a04a` | Primary brand, buttons, confirm actions |
| `ochre-light` | `#e8c47a` | Highlights, active states |
| `ochre-dim` | `#a07830` | Muted brand accent |
| `sand` | `#b8a878` | Running, Ride category |
| `clay` | `#c4856a` | Heart/RHR category |
| `rust` | `#b47050` | Strength category |
| `gold` | `#e8c47a` | Weight category |
| `dawn` | `#7FAABC` | Sleep category (exclusive) |
| `blush` | `#d4a890` | Body composition |
| `ember` | `#c45a4a` | Sauna category |

### Signal Colors

> **Decision D005:** Brand guide is authoritative. These are warm ochre tones, NOT traffic-light.

| Token | Hex | Usage |
|-------|-----|-------|
| `signal-good` | `#e8c47a` | Positive states, readiness high |
| `signal-caution` | `#d4a04a` | Warning states, readiness mid |
| `signal-poor` | `#c47a6a` | Negative states, readiness low, errors |

### Category Colors (chart lines, dots, icons)

| Category | Hex | Token |
|----------|-----|-------|
| Weight | `#e8c47a` | `gold` |
| Sleep | `#7FAABC` | `dawn` |
| Heart/RHR | `#c4856a` | `clay` |
| Nutrition | `#e8c47a` | `gold` |
| Running | `#b8a878` | `sand` |
| Ride | `#b8a878` | `sand` |
| Strength | `#b47050` | `rust` |
| Sauna | `#c45a4a` | `ember` |
| Body | `#d4a890` | `blush` |

---

## Typography

| Style | Font | Size | Weight | Letter-spacing |
|-------|------|------|--------|---------------|
| Hero Value | JetBrains Mono | 52px | 800 | -3px |
| Card Value | JetBrains Mono | 40px | 800 | -2px |
| Stat Number | JetBrains Mono | 28px | 800 | -1.5px |
| Small Number | JetBrains Mono | 14px | 600 | -0.5px |
| Page Title | Inter | 24px | 800 | -1px |
| Section Head | Inter | 16px | 700 | -0.5px |
| Body | Inter | 14px | 400 | 0 |
| Label | Inter | 10px | 600 | 1.2px, uppercase |

**Rule:** All numeric values use JetBrains Mono. All text uses Inter.

---

## Motion

| Token | Value | Usage |
|-------|-------|-------|
| `settle` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entry animations, card appears |
| `drift` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Chart transitions, overlays |
| `fast` | `120ms` | Micro-interactions (toggle, press) |
| `normal` | `200ms` | Card transitions, state changes |
| `slow` | `400ms` | Page transitions, chart draws |

---

## Spacing

| Token | Value |
|-------|-------|
| `xs` | 4px |
| `sm` | 8px |
| `md` | 14px |
| `lg` | 20px |
| `xl` | 32px |
| `2xl` | 48px |

## Border Radii

| Token | Value |
|-------|-------|
| `radius-sm` | 8px |
| `radius-md` | 14px |
| `radius-lg` | 20px |
| `radius-pill` | 100px |

---

## Chart Tokens (Recharts)

```typescript
const CHART_GRID = { strokeDasharray: "3 3", stroke: "#2a2a20" };
const CHART_AXIS = { fill: "#8a8070", fontSize: 11 };
const CHART_TOOLTIP = {
  background: "#1a1a14",
  border: "1px solid #2a2a20",
  borderRadius: 8,
  fontSize: 12,
};
```

---

## Mobile-First Rules

- **44px minimum** touch targets on all interactive elements
- No hover-only interactions — everything works via tap
- Bottom tab bar: 4 items (Dashboard, Calendar, Log, Trends)
- Card stack layout (vertical scroll), not grid
- Bottom sheets for detail views (calendar day, etc.)
- Compact information density — phone is primary device

---

## Aesthetic

Dune-inspired. Warm ochre on near-black. Textured, not flat. No emoji anywhere. Dawn blue reserved exclusively for sleep data.
