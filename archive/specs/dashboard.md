# Dashboard Spec

**Route:** `/`
**Purpose:** Daily readiness overview. At a glance: how recovered am I, what happened today, what should I pay attention to.

## Core Use Case

Recovery-performance correlation. The dashboard answers: "Based on my sleep, RHR, and recent load — am I in good shape to train hard today, or should I recover?"

## Layout (Mobile-First)

Top-to-bottom card stack. No grid. Single column.

### Card 1: Readiness Score
- Large hero number (0-100) using JetBrains Mono 52px
- Signal color background: Good (#e8c47a) / Caution (#d4a04a) / Poor (#c47a6a)
- AI narrative below (1-2 sentences from Claude Haiku 4.5)
- Breakdown chips: Sleep, RHR, Load, Recovery

### Card 2: Today's Vitals
- Sleep duration + deep % (from last night)
- Resting heart rate (today or most recent)
- Weight (today or most recent)
- Each value: JetBrains Mono 28px, label below in Inter 10px uppercase

### Card 3: Recent Activity
- Last 3 logged activities (run, strength, sauna, etc.)
- Each: type icon, brief description, date
- Tap to expand or navigate to detail

### Card 4: Streaks
- Running streak, strength streak, sauna streak, habits streak
- Compact horizontal layout, flame icon for active streaks

## Data Sources

| Data | Endpoint | Notes |
|------|----------|-------|
| Readiness score + narrative | `GET /api/readiness` | Falls back to deterministic formula if no API key |
| Daily summary | `GET /api/summary/daily` | Weight, sleep, RHR, activity, food totals |
| Streaks | `GET /api/streaks` | Running, strength, sauna, habits |

## Interactions

- Pull-to-refresh triggers re-fetch of all endpoints
- Tap readiness card → expand breakdown detail
- Tap activity → navigate to relevant route (future Phase 2)
- No hover states (mobile-first)

## Phase 1 Scope

**Included:** Readiness score with narrative, today's vitals, recent activity list, streaks
**Excluded:** Historical readiness graph, training recommendations, notification badges
