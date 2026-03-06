# Goe Health

Personal health dashboard. Recovery-performance correlation is the core use case — how sleep, RHR, sauna, and nutrition overlap with intense runs and weightlifting frequency.

## Status

| Route     | Status      | Task        |
|-----------|-------------|-------------|
| Dashboard | ✅ Live data with loading/error states, pull-to-refresh | 02, 03      |
| Calendar  | ✅ Month grid with dots + day detail sheet | 04, 05      |
| Log       | ✅ NLP-powered entry cards with confirm flow | 06, 07      |
| Trends    | ✅ Recovery vs performance correlation charts | 08          |
| Scaffold  | ✅ Done      | 01          |
| Integration | ✅ Auth gate, error boundary, route transitions, deployed | 09 |

**Current phase:** Phase 1 (MVP) — **COMPLETE** 🎉
**Live at:** [gavhealth.vercel.app](https://gavhealth.vercel.app)
**Password:** `<see .env VITE_GATE_PASSWORD>`

## Architecture

- **Backend:** Railway (FastAPI + PostgreSQL, 12 tables, 26+ endpoints) — EXISTS, do not rebuild
- **Frontend:** React/Vite/TypeScript on Vercel — REBUILDING from scratch
- **APIs:** Withings (OAuth + daily sync), Anthropic Claude Haiku 4.5 (food/strength NLP + readiness narrative)
- **Mobile-first:** Phone is primary device. Card stack layout, bottom tab bar, 44px touch targets.

## Routes (Phase 1)

1. **Dashboard** — Daily readiness score, recovery signals, today's key metrics
2. **Calendar** — Multi-layer dot matrix, pattern visibility across all categories over time
3. **Log** — Unified entry point for food, weight, strength, sauna, notes
4. **Trends** — Recovery vs performance overlays, correlation analysis

## How This Folder Works

This documentation structure is designed to be operated by AI (Cowork sessions). The user gives instructions in plain language. The AI reads the relevant files, executes tasks, and updates documentation.

**For any Cowork session:**
1. Read THIS file first — get project status
2. Read `tasks/README.md` — understand task conventions and change management
3. Read the specific task file in `tasks/active/` — get everything needed to execute

**Key rules:**
- Every task file is SELF-CONTAINED. All context needed is inline. No cross-file lookups during execution.
- If a session compacts, re-reading the task file restores full context.
- Specs in `specs/` are the source of truth for features. Task files duplicate relevant portions.
- The user does NOT edit files. The AI handles all file updates based on user instructions.

## File Map

```
goe-health/
├── README.md              ← You are here. Status hub.
├── CHANGELOG.md           ← Dated feature/spec changes
├── DECISIONS.md           ← Architectural decisions with rationale
├── specs/
│   ├── dashboard.md       ← Dashboard feature spec
│   ├── calendar.md        ← Calendar feature spec
│   ├── log.md             ← Log feature spec
│   └── trends.md          ← Trends feature spec
├── reference/
│   ├── brand.md           ← GOE brand system (design tokens, colors, typography)
│   ├── api.md             ← Backend API reference (endpoints, auth)
│   └── stack.md           ← Tech stack, credentials, deployment
├── tasks/
│   ├── README.md          ← Task conventions, template, change management protocol
│   ├── active/            ← Current Phase 1 tasks (01-09)
│   └── done/              ← Completed task files (moved here after completion)
└── archive/
    └── previous-project.md ← Key learnings from GavHealth v1
```
