# GOE Health — Plan Log

Track task completion across sessions. Read this first at the start of every session.

## Active Plan: MVP v1
**Plan file:** `specs/mvp-plan.md`
**Created:** 2026-03-06

| # | Task | Status | Started | Done | Notes |
|---|------|--------|---------|------|-------|
| 1 | Security Hardening + API Verification | done | 2026-03-06 | 2026-03-06 | Secrets scrubbed from 6 files. 2 dashboard API paths fixed. All endpoints curl-verified. session-handoff.md created. Build passes. |
| 2 | Food NLP Logging Flow | done | 2026-03-06 | 2026-03-06 | FoodCard existed but had wrong API contract. Curl-verified both endpoints. Fixed: request body (text→description), response types (real shape from API), confirm body (sends full parse object). Added meal_label, P/C/F macro row, confirming state. Build passes. |
| 3 | Strength NLP Logging Flow | done | 2026-03-06 | 2026-03-06 | StrengthCard already existed with Builder + Brain Dump modes. Curl-verified 4 endpoints (parse, save, confirm, last/split). Fixed: parse response type (added StrengthParseResponse), store + display session_label from AI parse, added saving overlay (opacity+pointer-events) to Brain Dump review. Build passes. |
| 4 | Sauna + Habits Logging | done | 2026-03-06 | 2026-03-06 | Both components already existed. Curl-verified both endpoints. Sauna: already correct, added did_breathing toggle. Habits: rewrote entirely — was sending wrong shape (stretching/meditation/etc), real API uses habit_date + did_breathing + did_devotions. Build passes. |
| 5 | Quick Fixes + Session Handoff Update | done | 2026-03-06 | 2026-03-06 | Favicon, 404 redirect, CardEmpty, chart scroll wrappers, full handoff doc update. Build passes. |
| 6 | Calendar defaults to Workout + time on activity feed | done | 2026-03-06 | 2026-03-06 | Calendar defaults to strength only. start_time added to FeedItem (displays when API returns it — backend migration still needed to populate column). Build passes. |
| 7 | Strength → Workout linking + unmatched session fix | done | 2026-03-06 | 2026-03-06 | "Log strength session" button on Workout items in ActivityFeed expanded panel. Opens StrengthCard bottom sheet pre-linked to that activity. After save calls PATCH /api/log/strength/{id}/relink. StrengthCard accepts activityId + onConfirmed props. Build passes. |
| 8 | Habits history view | done | 2026-03-06 | 2026-03-06 | HabitsCard extended with HabitsHistory component. Fetches GET /api/habits?days=14 — silently skips if endpoint not yet deployed. Backend endpoint added to new_endpoints.py — deploy to Railway to activate. Build passes. |
| 9 | Manual Withings sync button | done | 2026-03-06 | 2026-03-06 | SyncButton component added to Calendar + Dashboard. Calls POST /api/withings/sync. Success: triggers refetch. Failure: 4s inline error. useCalendarData + useDashboard both expose refetch. Build passes. |
| — | Sleep dashboard deep-dive | backlog | — | — | Not yet detailed |
| — | Goal rings / daily hero visualization | backlog | — | — | Not yet detailed |
| — | Visual polish pass | backlog | — | — | Not yet detailed |

**Status values:** `pending` → `in-progress` → `done` | `future` = not yet planned in detail

## How to use this log
1. At session start: read this file, find the first `pending` or `in-progress` task
2. Read the full task details from `specs/mvp-plan.md`
3. Mark task `in-progress` with today's date when you start
4. Mark task `done` with today's date when done-when checks pass
5. Add any notes (blockers, partial progress, decisions made)

## Completed Plans Archive
_(none yet)_
