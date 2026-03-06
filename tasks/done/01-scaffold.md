# Task 01 — Project Scaffold

Purpose: Set up the React/Vite/TypeScript project with routing, shared layout, and bottom tab bar.

---

## Scope Gate

**DOES:**
- Initialize Vite + React + TypeScript project
- Install dependencies: react-router-dom, recharts, lucide-react
- Configure path aliases (`@/`)
- Set up 4 routes: `/`, `/calendar`, `/log`, `/trends`
- Build bottom tab bar (4 icons)
- Create shared layout wrapper
- Set up GOE design tokens as CSS custom properties
- Load fonts (Inter + JetBrains Mono)
- Create API client utility with base URL and API key from env vars
- Create `.env` with Vercel env vars
- Wire Vercel deployment config

**DOES NOT:**
- Build any route content (just placeholder pages)
- Fetch any data from the API
- Build any components beyond the tab bar and layout
- Set up testing framework
- Build the auth gate (password screen)

---

## Pre-flight Checks

- [ ] Verify Node.js available: `node --version`
- [ ] Verify npm available: `npm --version`
- [ ] Verify API is reachable: `curl -s https://gavhealth-production.up.railway.app/api/health`

---

## Design Tokens (inline)

```css
:root {
  /* Backgrounds */
  --bg-base: #0d0d0a;
  --bg-card: #14130f;
  --bg-card-hover: #1c1b15;
  --bg-elevated: #1e1d18;

  /* Borders */
  --border-default: #222018;
  --border-subtle: #1a1914;

  /* Text */
  --text-primary: #f0ece4;
  --text-secondary: #b0a890;
  --text-tertiary: #9a9080;
  --text-muted: #7a7060;

  /* Brand */
  --ochre: #d4a04a;
  --ochre-light: #e8c47a;
  --ochre-dim: #a07830;
  --sand: #b8a878;
  --clay: #c4856a;
  --rust: #b47050;
  --gold: #e8c47a;
  --dawn: #7FAABC;
  --blush: #d4a890;
  --ember: #c45a4a;

  /* Signals */
  --signal-good: #e8c47a;
  --signal-caution: #d4a04a;
  --signal-poor: #c47a6a;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 14px;
  --space-lg: 20px;
  --space-xl: 32px;
  --space-2xl: 48px;

  /* Radii */
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-pill: 100px;

  /* Motion */
  --ease-settle: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-drift: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --duration-fast: 120ms;
  --duration-normal: 200ms;
  --duration-slow: 400ms;
}
```

### Typography Classes

```css
.hero-value   { font-family: 'JetBrains Mono', monospace; font-size: 52px; font-weight: 800; letter-spacing: -3px; }
.card-value   { font-family: 'JetBrains Mono', monospace; font-size: 40px; font-weight: 800; letter-spacing: -2px; }
.stat-number  { font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 800; letter-spacing: -1.5px; }
.small-number { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 600; letter-spacing: -0.5px; }
.page-title   { font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -1px; }
.section-head { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 700; letter-spacing: -0.5px; }
.body-text    { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 400; }
.label-text   { font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; }
```

---

## Env Vars (.env)

```
VITE_API_BASE_URL=https://gavhealth-production.up.railway.app
VITE_API_KEY=gavhealth-prod-api-2026-xK9mP3
VITE_GATE_PASSWORD=goe2026
```

---

## Components to Build

### 1. `src/lib/api.ts` — API Client

```typescript
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
```

### 2. `src/styles/tokens.css` — Design Tokens

The CSS custom properties above, plus:
- `* { box-sizing: border-box; margin: 0; padding: 0; }`
- `body { background: var(--bg-base); color: var(--text-secondary); font-family: 'Inter', sans-serif; }`
- Font imports for Inter (400, 600, 700, 800) and JetBrains Mono (600, 800)

### 3. `src/components/Layout.tsx` — App Shell

- Full-height flex column
- `<main>` with `flex: 1; overflow-y: auto; padding-bottom: 72px;` (space for tab bar)
- `<TabBar />` fixed to bottom

### 4. `src/components/TabBar.tsx` — Bottom Navigation

4 tabs, 44px minimum touch target each:

| Tab | Icon | Route | Label |
|-----|------|-------|-------|
| Dashboard | `LayoutDashboard` | `/` | Dashboard |
| Calendar | `Calendar` | `/calendar` | Calendar |
| Log | `Plus` | `/log` | Log |
| Trends | `TrendingUp` | `/trends` | Trends |

- Background: `var(--bg-elevated)` (`#1e1d18`)
- Active tab: `var(--ochre)` (`#d4a04a`)
- Inactive: `var(--text-muted)` (`#7a7060`)
- Border top: `1px solid var(--border-default)` (`#222018`)
- Icon size: 20px, label: 10px uppercase Inter 600
- Height: 64px + safe-area-inset-bottom

### 5. Route Placeholders

Each route (`/`, `/calendar`, `/log`, `/trends`) gets a minimal page component:
```tsx
export default function DashboardPage() {
  return <div className="page-title" style={{ padding: 'var(--space-lg)' }}>Dashboard</div>;
}
```

### 6. `src/App.tsx` — Router Setup

```tsx
<BrowserRouter>
  <Layout>
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/log" element={<LogPage />} />
      <Route path="/trends" element={<TrendsPage />} />
    </Routes>
  </Layout>
</BrowserRouter>
```

---

## File Structure (expected output)

```
src/
├── App.tsx
├── main.tsx
├── styles/
│   └── tokens.css
├── lib/
│   └── api.ts
├── components/
│   ├── Layout.tsx
│   └── TabBar.tsx
├── pages/
│   ├── DashboardPage.tsx
│   ├── CalendarPage.tsx
│   ├── LogPage.tsx
│   └── TrendsPage.tsx
.env
vite.config.ts
tsconfig.json
package.json
index.html
```

---

## Done-When

- [ ] `npm run dev` starts without errors
- [ ] All 4 routes render placeholder text
- [ ] Tab bar shows at bottom, active tab highlights in ochre
- [ ] Background is `#0d0d0a`, text renders in correct colors
- [ ] JetBrains Mono and Inter fonts load
- [ ] `apiFetch('/api/health')` returns `{ status: "ok" }` from browser console
- [ ] No TypeScript errors (`npm run build` succeeds)
- [ ] Project can deploy to Vercel (build completes)

---

## If Blocked

1. Try 3 different approaches
2. Document what was tried and what failed
3. Stop — do NOT keep looping
4. Report the blocker to Gav with specifics

---

## After Completion

1. Move this file from `tasks/active/` to `tasks/done/`
2. Update `README.md` route status table (Dashboard/Calendar/Log/Trends → "Scaffold only")
3. Add entry to `CHANGELOG.md`
4. Start next task: `tasks/active/02-dashboard-layout.md`
