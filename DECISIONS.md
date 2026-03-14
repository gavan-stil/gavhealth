# Architectural Decisions

Record of significant decisions with rationale. AI appends here when decisions are made.

---

## D001 — Keep backend, rebuild frontend (2026-03-04)

**Decision:** Keep the existing Railway backend (FastAPI + PostgreSQL) untouched. Rebuild only the frontend in React/Vite/TypeScript.

**Rationale:** Backend is solid — 12 tables, 26+ endpoints, all tested, all deployed. The frontend was the pain point (10 routes, monolithic, hard to maintain). A clean frontend rebuild against the existing API is lower risk and faster.

**Alternatives considered:** Fork and clean up existing repo. Rejected because the frontend accumulated too much cruft over 31 sessions.

---

## D002 — Mobile-first, 4 routes (2026-03-04)

**Decision:** Phone is the primary device. 4 routes: Dashboard, Calendar, Log, Trends. Desktop is secondary.

**Rationale:** User accesses the app primarily on phone. Mobile-first means card stack (not grid), 44px touch targets, no hover-dependent interactions, bottom tab bar (4 items), compact calendar dot matrix, bottom sheet/modal for logging.

**Alternatives considered:** 10 routes from v1. Rejected — most were redundant or low-value. Recovery-performance correlation drives everything; 4 routes cover the core use case.

---

## D003 — Self-contained task files (2026-03-04)

**Decision:** Every task file contains ALL context needed for execution inline — design tokens, API endpoints, mock data, component specs. Duplication across task files is intentional.

**Rationale:** Cowork sessions compact context. If a task references other files, compaction loses that context and tasks fail midway. Self-contained files mean re-reading the single task file restores everything. This is THE core requirement of the project structure.

**Alternatives considered:** Cascading README hierarchy where tasks reference shared docs. Rejected — good for humans, bad for AI execution under compaction.

---

## D004 — AI-driven change management (2026-03-04)

**Decision:** The user does not edit files. All documentation updates (specs, changelog, task files) are performed by the AI based on user instructions in plain language.

**Rationale:** User is not a developer and will not manually edit markdown files. The folder structure and conventions in `tasks/README.md` tell the AI how to handle changes without breaking the project.

**Alternatives considered:** User edits specs directly. Rejected — user explicitly stated they will give instructions to Cowork and expect the AI to figure out updates.

---

## D005 — Brand guide is authoritative for signal colors (2026-03-04)

**Decision:** Signal colors use warm ochre tones from the brand guide (Good=#e8c47a, Caution=#d4a04a, Poor=#c47a6a), NOT the traffic-light colors from PAUL.md.

**Rationale:** The brand guide (v1.2) is the most recent and comprehensive design document. Traffic-light colors in PAUL.md were from an earlier iteration. User confirmed "the brand system is great and needs to inform everything."

---

## D007 — Withings GPS late-delivery: 48h guaranteed re-fetch strategy (2026-03-13)

**Problem (recurring — multiple sessions failed to fully fix this):**
Withings processes GPS data asynchronously, 30–60+ minutes after a workout is uploaded. The first sync captures the workout with missing or watch-estimated distance. Subsequent syncs don't always correct it. This has caused workout distance to be wrong or null in the DB even when the correct value is visible in the Withings app.

**Root causes identified:**

1. **GPS processed after first sync** — Withings upload and GPS processing are decoupled. A run uploaded at 7:00am may have GPS attached at 7:30am. The 5:30am and 8:00am scheduled syncs can straddle this window. The first sync captures null or watch-estimated distance; the 8:00am sync should catch the GPS value — but only if the workout is re-fetched.

2. **`backfill_incomplete_workouts` only catches NULL** — The backfill extends the sync window to 60 days when any row has a NULL critical field. But if Withings sends a non-null watch-estimated value first (e.g. 1.23 km before GPS sync), `distance_km IS NULL` is false, so the backfill never fires. The COALESCE upsert logic (`COALESCE(EXCLUDED.distance_km, activity_logs.distance_km)`) IS correct and would update 1.23 → 5.58 when Withings returns the GPS value — but only if the workout is actually re-fetched.

3. **`'ride'` missing from backfill condition** — The backfill checked `activity_type IN ('run','walk')` for distance. Ride activities were excluded from the GPS-null check.

4. **No per-workout logging** — `sync_workouts` had no log lines showing what Withings returned per workout. This made production debugging impossible.

**Fix applied (2026-03-13):**

- Added `logger.info` per workout in `sync_workouts` showing `w_id`, `activity_type`, `activity_date`, `distance_m` (raw from Withings), `distance_km`, `avg_hr`, `steps`. Visible in Railway logs.
- Added `'ride'` to the `activity_type IN (...)` check in `backfill_incomplete_workouts`.
- Added a **guaranteed 48h re-fetch** step in `run_full_sync` (after the existing backfill). On every sync, all workouts from the last 48 hours are unconditionally re-fetched via `sync_workouts` with `since_ts = now - 48h`. The COALESCE upsert correctly updates any wrong non-null value when Withings returns the real GPS value.
- Added `POST /api/withings/refresh-workout/{external_id}` endpoint for one-off manual corrections (e.g. `withings_workout_12345`). Triggers a 60-day `sync_workouts` call.

**Why 48 hours?** GPS processing at worst takes a few hours. 48h gives a 2-day buffer covering any edge cases (overnight workouts, slow Withings servers). Running the re-fetch on every sync has negligible cost — Withings returns a compact JSON list; the upsert is a no-op for unchanged rows.

**COALESCE logic (correct, do not change):**
```sql
COALESCE(EXCLUDED.distance_km, activity_logs.distance_km)
```
This always prefers an incoming non-null value (so GPS-corrected data overwrites watch-estimate), and falls back to stored if incoming is null (so a bad sync never wipes good data). This is correct for ALL columns in `sync_workouts`.

---

## D008 — Momentum replaces ReadinessCard (2026-03-14)

**Decision:** Replace `ReadinessCard` with a new `MomentumCard` component backed by a `health_goals` table and new `/api/momentum` endpoints. Readiness (acute, daily) is subsumed into the broader Momentum model.

**Rationale:** The existing ReadinessCard used hardcoded population-average targets (7.6hr sleep, 43% deep sleep) rather than personal baselines, making the score feel arbitrary and untrustworthy. The new model uses three layers per signal: user-set target range → 28-day personal baseline → 7-day trend. This answers the user's actual question: *"Am I trending toward or away from my goals?"*

**Key design choices:**
- **Append-only `health_goals`** — targets are never overwritten; history is always preserved with timestamps and optional notes
- **Target as range, not point** — reduces anxiety about hitting an exact number; matches the Garmin/Oura "optimal zone" pattern
- **Separate `/goals` route** — target editing lives outside the Dashboard to keep the card focused; reachable via `Edit Goals →` link
- **Protein/water targets move here** — hardcoded 180g and 3L values in Trends components are replaced by `health_goals` rows
- **6 signals** — sleep, RHR, weight, calories in, protein, water; all have editable targets and historical entries

**Alternatives considered:** Keep ReadinessCard and add a separate Progress card. Rejected — two cards answering overlapping questions creates confusion. Momentum is the primary health-state signal; one card, one question.

**Full spec:** `specs/momentum.md`
**Task file:** `tasks/T22-momentum.md`

---

## D006 — Calendar is Phase 1 core (2026-03-04)

**Decision:** Calendar overview is a core Phase 1 feature, not deferred to Phase 2.

**Rationale:** User explicitly stated: "I really love the calendar overview... That's super important." The multi-layer dot matrix showing patterns across categories over time is central to the recovery-performance correlation use case.
