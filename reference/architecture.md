# Architecture Reference

> Stable document. Update only when the architecture actually changes (not every session).
> Last updated: 2026-03-06

---

## System Diagram

```
[Withings API]
     │
     ▼  (GitHub Actions cron, 6am AEST)
[Railway FastAPI + PostgreSQL 16]
     │                    ▲
     │  GET /api/*        │  POST /api/log/*
     ▼                    │
[Vercel React SPA]  ←── user ─────────────────► [Claude Haiku 4.5]
  gavhealth.vercel.app                          (food/strength NLP parse,
                                                 readiness narrative)
```

| Layer | Host | URL |
|-------|------|-----|
| Frontend | Vercel | `gavhealth.vercel.app` |
| Backend | Railway | `gavhealth-production.up.railway.app` |
| Git | GitHub | `github.com/gavan-stil/gavhealth` |

---

## Frontend Stack

- **React 19** + **Vite 7** + **TypeScript 5.9**
- **react-router-dom v7** — 6 routes, BrowserRouter
- **recharts** — sparklines and overlay charts
- **lucide-react** — icons
- No Redux/Zustand — pure React hooks

---

## App Component Tree

```
main.tsx
└── App.tsx
    ├── ErrorBoundary        ← catches render crashes, shows reload card
    └── AuthGate             ← password gate (VITE_GATE_PASSWORD, sessionStorage)
        └── BrowserRouter
            └── Layout       ← flex shell + sticky TabBar footer
                └── AnimatedRoutes (route-enter fade animation)
                    ├── DashboardPage  /
                    ├── CalendarPage   /calendar
                    ├── LogPage        /log
                    ├── TrendsPage     /trends
                    ├── GoalsPage      /goals
                    ├── ExercisesPage  /exercises
                    └── * → Navigate to /
```

---

## Route → Component Map

### Dashboard `/`
```
DashboardPage (pull-to-refresh)
├── useDashboard hook  →  GET /api/readiness, /api/summary/daily, /api/streaks
├── ReadinessCard      ← score + breakdown + AI narrative
├── VitalsCard         ← weight, sleep hours, deep %, RHR
└── StreaksCard         ← training / sauna / breathing / devotions
    (each card: CardSkeleton | CardError | data | CardEmpty)
```

### Calendar `/calendar`
```
CalendarPage (filter + selected-day state)
├── useCalendarData hook  →  5× GET endpoints, 90-day window
├── MonthHeader            ← prev/next month navigation
├── ToggleBar              ← category filters + meta toggles
├── SubToggleBar           ← visible when 1 category selected
├── MonthGrid              ← 8-col grid (7 days + summary), dots per day
├── DayDetailSheet         ← bottom sheet on day tap
├── StatsSection           ← monthly aggregates
└── PatternsSection        ← pattern analysis (days of week, etc.)
```

### Log `/log`
```
LogPage (two tabs: Log | Activity)
├── LogCards accordion
│   ├── FoodCard       ← input → parse → review → confirm → success
│   │   ├── LabelScanSheet  ← photo → vision AI → review macros → stage
│   │   └── RecipeSheet     ← list/create/edit/use recipes, portion calc
│   ├── StrengthCard   ← Builder mode OR Brain Dump NLP mode
│   ├── SaunaCard      ← direct form (datetime, duration, temp, toggles)
│   └── HabitsCard     ← breathing + devotions checkboxes
└── ActivityFeed       ← recent 14-day activity list
```

### Trends `/trends`
```
TrendsPage
├── useTrendsData hook  →  5× GET endpoints, configurable range
├── TimeRangeSelector   ← 7 / 30 / 90 day pills
├── RecoverySparklines  ← 5 mini charts (sleep, deep%, RHR, sauna, weight)
├── PerformanceOverlay  ← activity intensity vs selected recovery metric
└── CorrelationSummary  ← directional arrows, Pearson correlation (client-side)
```

---

## Key Patterns

### API Calls — always via `apiFetch`
```ts
// src/lib/api.ts
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T>
// Injects X-API-Key header, throws on non-2xx
```
Never use raw `fetch`. Never call backend directly from components — use hooks.

### 3-State Card Model
Every data card renders one of:
```tsx
{loading ? <CardSkeleton /> : error ? <CardError onRetry={fn} /> : data ? <DataCard /> : <CardEmpty />}
```

### 2-Step NLP Logging (Food + Strength)
```
1. Input      → user types description
2. Parse      → POST /api/log/{type}            → parsed result
3. Review     → display result, Confirm / Edit
4. Confirm    → POST /api/log/{type}/confirm    → 201 saved
5. Success    → toast + auto-reset after 2s
```

### Hook Pattern
```ts
function useCardFetch<TRaw, TOut>(path, transform): CardState<TOut>
// useState for data/loading/error + refetch callback
// Pull-to-refresh in DashboardPage calls refetch() on all 3 cards
```

---

## Hooks Inventory

| Hook | File | Endpoints called |
|------|------|-----------------|
| useDashboard | `src/hooks/useDashboard.ts` | `/api/readiness`, `/api/summary/daily`, `/api/streaks` |
| useCalendarData | `src/hooks/useCalendarData.ts` | `/api/activity`, `/api/sleep`, `/api/weight`, `/api/rhr`, `/api/sauna` — 90 days |
| useTrendsData | `src/hooks/useTrendsData.ts` | Same 5 endpoints — configurable range (7/30/90) |
| useActivityFeed | `src/hooks/useActivityFeed.ts` | `/api/activity` — 14 days |
| useStrengthTrends *(T11 — planned)* | `src/hooks/useStrengthTrends.ts` | `/api/strength/sessions?days=N` |
| useExerciseHistory *(T11 — planned)* | `src/hooks/useExerciseHistory.ts` | `/api/strength/exercise/:id/history?days=N` |
| useLabelScan | `src/hooks/useLabelScan.ts` | `POST /api/log/food/scan` (vision AI) |
| useRecipes | `src/hooks/useRecipes.ts` | `GET/POST/PATCH/DELETE /api/recipes` |

---

## Design System

| Resource | Location |
|----------|----------|
| CSS tokens (colors, spacing, radii, motion) | `src/styles/tokens.css` |
| Full brand guide | `reference/brand.md` |

Key tokens: `--ochre` (#d4a04a), `--bg-base` (#0d0d0a), `--bg-card` (#14130f), `--space-md` (14px), `--radius-md` (14px)

Fonts: **Inter** (body), **JetBrains Mono** (numbers/stats)

---

## Build & Deploy

```bash
npm run build      # tsc -b && vite build → dist/
# Current output: 672.95 kB JS (⚠ Vite warns > 500KB — recharts is heavy)
```

**Deploy process:**
1. `git push origin main`
2. Vercel auto-deploys from GitHub (connected to `gavhealth.vercel.app`)

**Environment variables** (set in Vercel dashboard + local `.env`):
- `VITE_API_BASE_URL` — Railway backend URL
- `VITE_API_KEY` — X-API-Key for backend
- `VITE_GATE_PASSWORD` — AuthGate password

---

## Verified API Endpoints

All curl-tested against production on 2026-03-06. See `reference/api.md` for full request/response shapes.

> **Important:** Paths do NOT have a `/data/` prefix. `/api/data/*` returns 404.

### GET
| Endpoint | Used by |
|----------|---------|
| `/api/readiness` | useDashboard |
| `/api/summary/daily` | useDashboard |
| `/api/streaks` | useDashboard |
| `/api/sleep?days=N` | useCalendarData, useTrendsData |
| `/api/weight?days=N` | useCalendarData |
| `/api/rhr?days=N` | useCalendarData, useTrendsData |
| `/api/activity?days=N` | useCalendarData, useTrendsData, useActivityFeed |
| `/api/sauna?days=N` | useCalendarData, useTrendsData |
| `/api/food/weekly` | useTrendsData |
| `/api/exercises` | StrengthCard Builder mode |
| `/api/log/strength/last/{split}` | StrengthCard |

### POST (Logging)
| Endpoint | Purpose |
|----------|---------|
| `POST /api/log/food` | Parse food description via NLP |
| `POST /api/log/food/confirm` | Save parsed food entry |
| `POST /api/log/strength` | Parse strength description via NLP |
| `POST /api/log/strength/confirm` | Save parsed strength session |
| `POST /api/log/strength/save` | Save Builder-mode strength session |
| `POST /api/log/sauna` | Log sauna session |
| `POST /api/log/habits` | Log habits (breathing + devotions) |
