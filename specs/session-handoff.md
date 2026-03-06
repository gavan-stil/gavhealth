# Session Handoff — GOE Health Frontend

> **Last updated:** 2026-03-06 (Tasks 6–9 complete)
> **Next task:** Task — (see Future Tasks table — backlog items remain)

---

## Architecture Snapshot

```
[Withings API] → [GitHub Actions cron 6am AEST] → [Railway FastAPI] → [PostgreSQL 16]
                                                         ↑
[Vercel SPA] ← React 19/Vite 7/TS 5.9 ← user → POST /api/log/* → ┘
                                              ↓
                                        [Claude Haiku 4.5]
                                        (food/strength parse, readiness narrative)
```

| Layer    | Host    | URL |
|----------|---------|-----|
| Frontend | Vercel  | `gavhealth.vercel.app` |
| Backend  | Railway | `gavhealth-production.up.railway.app` |

---

## Verified API Paths (curl-tested 2026-03-06)

### GET — Data Retrieval

| Endpoint | Status | Used By |
|----------|--------|---------|
| `/api/health` | 200 | — |
| `/api/test` | 200 | — |
| `/api/readiness` | 200 | `useDashboard.ts` |
| `/api/summary/daily` | 200 | `useDashboard.ts` |
| `/api/streaks` | 200 | `useDashboard.ts` |
| `/api/sleep?days=N` | 200 | `useCalendarData.ts`, `useTrendsData.ts` |
| `/api/weight?days=N` | 200 | `useCalendarData.ts` |
| `/api/rhr?days=N` | 200 | `useCalendarData.ts`, `useTrendsData.ts` |
| `/api/activity?days=N` | 200 | `useCalendarData.ts`, `useTrendsData.ts` |
| `/api/sauna?days=N` | 200 | `useCalendarData.ts`, `useTrendsData.ts` |
| `/api/food/weekly` | 200 | `useTrendsData.ts` |
| `/api/summary/weekly` | 200 | — (not yet wired) |
| `/api/exercises` | 200 | — (for strength dropdowns) |
| `/api/dexa` | 200 | — |
| `/api/export/csv` | 200 | — |

> **Important:** Paths do NOT have a `/data/` prefix. `/api/data/sleep` etc. all return 404.

### POST — Logging

| Endpoint | Status | Required Fields |
|----------|--------|-----------------|
| `POST /api/log/food` | 200 | `{ "description": "..." }` → returns parsed macros |
| `POST /api/log/food/confirm` | 201 | Full parse object → returns saved record with `id` |
| `POST /api/log/strength` | 200 | `{ "description": "..." }` → returns parsed sets |
| `POST /api/log/strength/confirm` | 201 | Full parse object → returns saved record with `id` |
| `POST /api/log/strength/save` | 200 | Builder format (grouped exercises + split + time) → returns `{ id, matched_activity_id }` |
| `GET /api/log/strength/last/{split}` | 200 | Returns `{ date, exercises }` for last session of that split |
| `POST /api/log/sauna` | 200 | `{ session_datetime, duration_mins }` required. Optional: `temperature_c`, `did_devotions`, `did_breathing` |
| `POST /api/log/habits` | 200 | `{ habit_date }` required. Optional: `did_breathing`, `did_devotions` |

### POST — Sauna Log Response Shape (curl-verified 2026-03-06)

```json
{
  "id": 66,
  "session_datetime": "2026-03-06T10:00:00Z",
  "session_type": "traditional",
  "duration_mins": 15,
  "temperature_c": null,
  "did_breathing": false,
  "did_devotions": false,
  "notes": null,
  "withings_activity_id": null,
  "source": "manual"
}
```

### POST — Habits Log Response Shape (curl-verified 2026-03-06)

```json
{
  "id": 2,
  "habit_date": "2026-03-06",
  "did_breathing": false,
  "did_devotions": false,
  "notes": null
}
```

### POST — Food Parse Response Shape (curl-verified 2026-03-06)

```json
{
  "description_raw": "2 eggs scrambled with cheese",
  "meal_label": "lunch",
  "log_date": "2026-03-06",
  "protein_g": 19.0,
  "carbs_g": 1.0,
  "fat_g": 19.0,
  "calories_kcal": 260,
  "confidence": "high",
  "items": [
    { "name": "eggs scrambled (2 large)", "protein_g": 12, "carbs_g": 1, "fat_g": 10, "calories_kcal": 140 },
    { "name": "cheese (30g, added during cooking)", "protein_g": 7, "carbs_g": 0, "fat_g": 9, "calories_kcal": 120 }
  ]
}
```

### POST — Food Confirm Response Shape (curl-verified 2026-03-06)

Send the full parse response back to `/api/log/food/confirm`. Returns 201:
```json
{
  "id": 3,
  "log_date": "2026-03-06",
  "meal_time": null,
  "meal_label": "lunch",
  "description_raw": "2 eggs scrambled with cheese",
  "protein_g": 19.0,
  "carbs_g": 1.0,
  "fat_g": 19.0,
  "calories_kcal": 260,
  "confidence": "high",
  "source": "claude",
  "notes": null
}
```

### POST — Strength Parse Response Shape (curl-verified 2026-03-06)

```json
{
  "session_label": null,
  "session_datetime": "2026-03-06T03:44:01.186370",
  "sets": [
    { "exercise_name": "Squat", "set_number": 1, "reps": 5, "weight_kg": 100.0, "is_bodyweight": false, "rpe": null },
    { "exercise_name": "Squat", "set_number": 2, "reps": 5, "weight_kg": 100.0, "is_bodyweight": false, "rpe": null },
    { "exercise_name": "Squat", "set_number": 3, "reps": 5, "weight_kg": 100.0, "is_bodyweight": false, "rpe": null }
  ]
}
```

### POST — Strength Confirm Response Shape (curl-verified 2026-03-06)

Send the full parse response back to `/api/log/strength/confirm`. Returns 201:
```json
{
  "id": 2,
  "session_datetime": "2026-03-06T12:00:00Z",
  "session_label": "Lower body",
  "notes": null,
  "source": "claude",
  "sets": [
    { "exercise_name": "Squat", "set_number": 1, "reps": 5, "weight_kg": 100.0, "is_bodyweight": false, "rpe": null }
  ]
}
```

### POST — Strength Save Response Shape (curl-verified 2026-03-06)

Builder format to `/api/log/strength/save`. Returns 200:
```json
{
  "id": 6,
  "matched_activity_id": null,
  "match_confirmed": false
}
```

---

## Component Inventory

### Pages
| Component | File | Route |
|-----------|------|-------|
| DashboardPage | `src/pages/DashboardPage.tsx` | `/` |
| CalendarPage | `src/pages/CalendarPage.tsx` | `/calendar` |
| LogPage | `src/pages/LogPage.tsx` | `/log` |
| TrendsPage | `src/pages/TrendsPage.tsx` | `/trends` |

### Hooks
| Hook | File | Endpoints |
|------|------|-----------|
| useDashboard | `src/hooks/useDashboard.ts` | `/api/readiness`, `/api/summary/daily`, `/api/streaks` |
| useCalendarData | `src/hooks/useCalendarData.ts` | 5 data endpoints × 90 days |
| useTrendsData | `src/hooks/useTrendsData.ts` | 5 data endpoints × configurable range |

### Dashboard
| Component | File | Purpose |
|-----------|------|---------|
| ReadinessCard | `src/components/dashboard/ReadinessCard.tsx` | AI readiness score + breakdown |
| VitalsCard | `src/components/dashboard/VitalsCard.tsx` | Daily vitals summary |
| StreaksCard | `src/components/dashboard/StreaksCard.tsx` | Training/sauna/habits streaks |
| CardSkeleton | `src/components/dashboard/CardSkeleton.tsx` | Loading skeleton for cards |
| CardError | `src/components/dashboard/CardError.tsx` | Error state with retry |
| CardEmpty | `src/components/dashboard/CardEmpty.tsx` | Empty data state (Task 5) |

### Log
| Component | File | Purpose |
|-----------|------|---------|
| FoodCard | `src/components/log/FoodCard.tsx` | Food NLP parse → review → confirm |
| StrengthCard | `src/components/log/StrengthCard.tsx` | Builder + Brain Dump strength logging |
| SaunaCard | `src/components/log/SaunaCard.tsx` | Sauna session logging |
| HabitsCard | `src/components/log/HabitsCard.tsx` | Breathing + devotions toggles |

### Trends
| Component | File | Purpose |
|-----------|------|---------|
| RecoverySparklines | `src/components/trends/RecoverySparklines.tsx` | 5 mini sparkline charts |
| PerformanceOverlay | `src/components/trends/PerformanceOverlay.tsx` | Recovery vs performance composite chart |
| CorrelationSummary | `src/components/trends/CorrelationSummary.tsx` | Correlation insights |
| TimeRangeSelector | `src/components/trends/TimeRangeSelector.tsx` | 7/30/90 day toggle |

### Shared
| Component | File | Purpose |
|-----------|------|---------|
| apiFetch | `src/lib/api.ts` | API wrapper with `X-API-Key` header |
| AuthGate | `src/components/AuthGate.tsx` | Password gate (env var) |
| Layout | `src/components/Layout.tsx` | Bottom tab bar + page shell |
| TabBar | `src/components/TabBar.tsx` | 4-icon bottom nav |

### Design Tokens
- `src/styles/tokens.css` — CSS custom properties for colors, spacing, typography
- Brand colors: ochre `#d4a04a`, background `#0d0d0a`, card `#14130f`
- Fonts: Inter (body), JetBrains Mono (numbers)

---

## Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| ~~No 404 route~~ | ~~Low~~ | Fixed Task 5: catch-all `<Navigate to="/" />` |
| ~~Default Vite favicon~~ | ~~Low~~ | Fixed Task 5: GOE-branded ochre "G" SVG |
| ~~No empty states~~ | ~~Medium~~ | Fixed Task 5: CardEmpty component for null data |
| ~~Trends sparklines overflow~~ | ~~Low~~ | Fixed Task 5: overflow-x scroll on charts |
| No PWA manifest | Low | Can't install as home screen app |
| Build chunk size warning | Info | 673KB JS bundle (Vite warns > 500KB) |
| Withings OAuth not completed | Medium | Daily sync pulls no new data until Gav completes OAuth |
| CORS set to `*` | Low | Tighten to Vercel domain after frontend stable |
| ~~Calendar defaults to all categories~~ | ~~Low~~ | Fixed Task 6: defaults to `strength` only |
| No time on activity feed entries | Low | `activity_logs` table has no `start_time` column from Withings sync — DB migration + sync update needed to populate |
| ~~No manual link: strength → Workout activity~~ | ~~Medium~~ | Fixed Task 7: "Log strength session" button on Workout items in ActivityFeed |
| Unmatched strength sessions invisible | Medium | Sessions save to `manual_strength_logs` only; still not shown in ActivityFeed independently. Use "Log strength session" on a Workout item to link. |
| ~~No habits history view~~ | ~~Low~~ | Fixed Task 8: HabitsCard shows history when `GET /api/habits` deployed |
| GET /api/habits not yet deployed | Low | new_endpoints.py has the endpoint — deploy to Railway to activate habits history |

---

## Build Log

```
2026-03-06 — npm run build (after Task 5)
✓ 2427 modules transformed
dist/index.html               0.75 kB │ gzip:  0.41 kB
dist/assets/index-xxxxx.css   2.22 kB │ gzip:  0.86 kB
dist/assets/index-xxxxx.js  672.95 kB │ gzip: 198.98 kB
⚠ chunk size warning (> 500 kB)
✓ built in 1.79s
```

---

## Session History

| Session | Task | Summary |
|---------|------|---------|
| 2026-03-06 | Task 1: Security + API Verify | Scrubbed secrets from 6 files, verified all API endpoints via curl, fixed 2 broken dashboard paths (`/api/readiness/today` → `/api/readiness`, `/api/daily-summary/today` → `/api/summary/daily`), created `.env.example`, confirmed build passes |
| 2026-03-06 | Task 2: Food NLP Logging Flow | FoodCard.tsx existed but had wrong API contract. Curl-verified both food endpoints. Fixed: parse body (`text`→`description`), response types to match real API (items have `protein_g`/`carbs_g`/`fat_g`/`calories_kcal`, no `qty`/`unit`), confirm sends full parse object (returns 201). Added: meal_label display, P/C/F macro row, separate `confirming` state with disabled UI. Build passes. |
| 2026-03-06 | Task 3: Strength NLP Logging Flow | StrengthCard already had Builder + Brain Dump modes. Curl-verified 4 endpoints (parse, save, confirm, last/split). Fixed: parse response type (added `StrengthParseResponse` with `session_label`, `session_datetime`, `rpe`), store + display `session_label` from AI parse in Brain Dump review, added saving overlay (opacity+pointer-events). Build passes. |
| 2026-03-06 | Task 4: Sauna + Habits Logging | Both components already existed with full UI. Curl-verified both endpoints. Sauna: was already sending correct fields, added `did_breathing` toggle + only sends `temperature_c` when filled. Habits: completely rewrote — old code sent fake habits (stretching/meditation/cold_shower/supplements) with wrong field name (`date`). Real API uses `habit_date` + `did_breathing` + `did_devotions`. Build passes. |
| 2026-03-06 | Task 5: Quick Fixes + Handoff | Replaced Vite favicon with GOE-branded ochre "G" SVG. Added catch-all route (`*` → redirect to `/`). Created `CardEmpty` component for dashboard null-data states. Added horizontal scroll wrappers to trends charts (RecoverySparklines + PerformanceOverlay min-width). Updated component inventory, known issues, build log. Build passes. |

---

## Next Session Checklist

1. Read THIS file first
2. Check `specs/plan-log.md` for task status
3. Read the relevant task section in `specs/mvp-plan.md`
4. Use `apiFetch` from `src/lib/api.ts` for all API calls
5. Follow patterns in `src/styles/tokens.css`
6. Mobile-first (375px), horizontal scroll for overflow
7. `npm run build` must pass before task is done

## Future Tasks

| Task | Title | Status |
|------|-------|--------|
| 6 | Calendar defaults to Workout + time on activity feed | done |
| 7 | Strength → Workout linking + unmatched session fix | done |
| 8 | Habits history view | done |
| 9 | Manual Withings sync button (Calendar + Dashboard) | done |
| — | Sleep dashboard deep-dive | backlog |
| — | Goal rings / daily hero visualization | backlog |
| — | Visual polish pass (card textures, micro-animations) | backlog |
