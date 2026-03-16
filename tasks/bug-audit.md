# Bug Audit — Session/Workout/Linking + Broad Scan
Started: 2026-03-16

## Protocol (per bug)
1. FIND — read code, trace data flow, curl-verify endpoint
2. DOCUMENT — write here immediately
3. FIX — one bug, one edit, npm run build passes
4. SPEC CHECK — update reference/api.md, architecture.md, or MEMORY if not covered
5. MARK — tick off, move on

## Bug Severity Scale
- **Critical** — data corruption, silent wrong values persisted to DB
- **High** — feature broken, data silently dropped, crash
- **Medium** — wrong value displayed, edge case silent failure
- **Low** — visual glitch, minor UX issue, inefficiency

---

## Bugs Found

---

### BUG-001 [High] — `save_strength_log` auto-link can claim already-linked activities
- **File:** `backend/app/routers/new_endpoints.py:316–333`
- **Layer:** Backend — session linking
- **Description:** When saving a manual strength log via `/api/log/strength/save`, the auto-link query matches any `workout` activity on the same date without checking if that activity is already linked to another session. This allows two sessions to claim the same `activity_log_id`.
- **Compare:** `confirm_strength_entry` (logging.py:162–177) correctly has `AND id NOT IN (SELECT activity_log_id FROM strength_sessions WHERE activity_log_id IS NOT NULL)`.
- **Repro:** Log two strength sessions on the same date back-to-back via the manual save flow. Both will claim the same workout activity.
- **Risk:** Duplicate session–workout links. The `link_strength_session` endpoint guards against this (409), but `save_strength_log` bypasses the guard entirely.

---

### BUG-002 [High] — `PATCH /api/log/strength/{id}/relink` doesn't update the bridged strength_session
- **File:** `backend/app/routers/new_endpoints.py:595–610`
- **Layer:** Backend — session linking
- **Description:** The relink endpoint only updates `manual_strength_logs.matched_activity_id`. It does NOT update `strength_sessions.activity_log_id` for the bridged session. The feed and trends query `strength_sessions.activity_log_id` — so the visual link shown in the feed is unaffected by a relink call.
- **Compare:** The `unlink` endpoint at line 644–665 correctly updates BOTH tables. Relink only updates one.
- **Repro:** Tap "Relink" on a strength log → assign a different activity → feed still shows old link (or no link).
- **Risk:** Relinking a manual strength log appears to do nothing in the UI.

---

### BUG-003 [High] — `DELETE /api/activity-logs/{id}` leaves dangling `strength_sessions.activity_log_id`
- **File:** `backend/app/routers/new_endpoints.py:1470–1479`
- **Layer:** Backend — data integrity
- **Description:** Deleting an activity_log does not NULL out `strength_sessions.activity_log_id` for any sessions pointing to it. No FK constraint exists on this column (model is `Integer, nullable=True` without ForeignKey). After deletion, the session has a stale `activity_log_id` pointing to a non-existent row.
- **Effect:** `GET /api/strength/sessions` LEFT JOINs activity_logs — for deleted activities the join returns NULL columns but the session still shows `activity_log_id != null`, so it doesn't appear as orphaned in the feed.
- **Repro:** Delete a workout in the feed → the linked strength session now shows as "linked" with no matching activity.
- **Risk:** Ghost links that can't be resolved without manual DB cleanup.

---

### BUG-004 [Medium] — Workout split edit doesn't update linked strength session label
- **File:** `src/components/ActivityEditSheet.tsx:373–384` + `backend/app/routers/new_endpoints.py:1440–1467`
- **Layer:** Frontend + Backend — workout edit
- **Description:** When editing a "workout" type activity in ActivityEditSheet, saving `workout_split` writes to `activity_logs.workout_split` column. But `GET /api/activities/feed` doesn't return this column, and the feed's split label display reads `strength_sessions.session_label` (from `linkedByActivityId[item.id].session_label`). Editing the split via ActivityEditSheet is effectively a no-op — the display doesn't change.
- **Also:** `GET /api/activity` (data.py:246) derives `workout_split` from `ss.session_label AS workout_split` via JOIN, not from `activity_logs.workout_split`. So the stored column is never surfaced.
- **Repro:** Edit a workout → change split from "push" to "pull" → save → feed still shows "push".
- **Risk:** Confusing UX — save appears to work (no error) but nothing changes.

---

### BUG-005 [Medium] — `update_strength_session` duration update silently fails for NLP-confirmed sessions
- **File:** `backend/app/routers/new_endpoints.py:1003–1007`
- **Layer:** Backend — session update
- **Description:** `PATCH /api/strength/sessions/{id}` updates duration via `UPDATE manual_strength_logs SET duration_minutes = :dur WHERE bridged_session_id = :id`. Sessions created via the NLP confirm flow (`/api/log/strength/confirm`) have no `manual_strength_logs` row — the UPDATE affects 0 rows silently and returns `{"ok": True}`.
- **Repro:** Create a session via NLP confirm → open edit sheet → change duration → save → duration unchanged.
- **Risk:** Silent failure on a user action that appears to succeed.

---

### BUG-006 [Medium] — `list_strength_sessions` and `last_strength_log` show wrong date (logged date, not workout date)
- **File:** `backend/app/routers/new_endpoints.py:675, 413`
- **Layer:** Backend — data display
- **Description:** Both endpoints use `created_at::date` as the session date. If you log a session for yesterday's workout today, the date shown is today. Should use `COALESCE(start_time AT TIME ZONE 'Australia/Brisbane'::date, created_at AT TIME ZONE 'Australia/Brisbane'::date)`.
- **Repro:** Log a workout with `start_time` set to yesterday → date in feed shows today.
- **Risk:** Session history dates are off when logging is done retroactively.

---

### BUG-007 [Low] — `OrphanCard` passes unsupported query params to `/api/strength/sessions`
- **File:** `src/components/log/ActivityFeed.tsx:589`
- **Layer:** Frontend — orphan detail fetch
- **Description:** Fetches `/api/strength/sessions?start_date=X&end_date=Y&limit=20`. The endpoint only supports `?days=N` — unknown params are silently ignored. Returns all sessions in the default 90-day window instead of filtered results. Works via ID fallback (`withEx.find(s => s.id === session.id)`), but fetches unnecessary data and will miss sessions older than 90 days.
- **Risk:** Low — works but wasteful; edge case miss for old sessions.

---

### BUG-008 [Low] — `EffortBadge` ignores `isUnreviewed` prop
- **File:** `src/components/log/ActivityFeed.tsx:816`
- **Layer:** Frontend — UI
- **Description:** Component signature declares `isUnreviewed: boolean` but the prop is not destructured or used in the render. Unreviewed activities show the same icon as manually reviewed ones — no visual differentiation.
- **Risk:** Low — UX polish only. The prop is passed at line 408 but does nothing.

---

### BUG-009 [Low] — `useIntradayHR` timezone workaround is fragile
- **File:** `src/hooks/useIntradayHR.ts:27–30`
- **Layer:** Frontend — hook
- **Description:** Uses `now.setTime(now.getTime() + 10 * 3600 * 1000); now.toISOString().split("T")[0]` to get Brisbane date. This is technically correct but is the exact fragile pattern flagged in MEMORY — if this were copy-pasted it would fail. The approved pattern is `new Date().toLocaleDateString('en-CA')` (using device locale). However since device is in Brisbane this still gives the right result, so impact is nil.
- **Risk:** Nil currently — purely a code quality issue.

---

### LOG-001 [High] — ActivityDetailSheet uses wrong edit type for workout items
- **File:** `src/components/log/ActivityDetailSheet.tsx:754`
- **Layer:** Frontend — activity feed edit
- **Description:** The edit sheet always opens with `type={'activity'}`, which renders the run/ride form (distance, pace, HR fields) for all item types. Workout and strength items should open `type='workout'` to get the split picker, date/time, and duration fields. Currently editing a workout from the feed shows distance/pace inputs instead of the split picker, and saves to the wrong columns.
- **Repro:** Activity feed → tap a Workout card → tap pencil icon → see Distance/Pace fields instead of Split/Date fields.
- **Risk:** High — workout edits from the feed are silently no-ops (wrong fields saved).

---

### LOG-002 [Medium] — ActivityDetailSheet uses `deriveSplit()` instead of `session_label`
- **File:** `src/components/log/ActivityDetailSheet.tsx:268`
- **Layer:** Frontend — feed session detail
- **Description:** Split label in the linked session panel uses `deriveSplit(raw.exercises)` — ignores `linkedSession.session_label`. Same pattern as CAL-001 (fixed in DayDetailSheet). Abs sessions show "Session". Sessions with no exercise category strings show wrong splits.
- **Compare:** `DayDetailSheet.tsx` was fixed (CAL-001) to prefer `session_label`. `ActivityDetailSheet` was missed.
- **Risk:** Medium — wrong split display in the activity feed detail sheet.

---

## Fix Plan

Ordered by severity and dependency:

| # | Bug | Severity | Fix effort | Notes |
|---|-----|----------|------------|-------|
| 1 | BUG-003: Delete activity → dangling session link | High | Small (backend) | Fix first — foundation for accurate link state |
| 2 | BUG-001: save_strength_log duplicate auto-link | High | Small (backend) | Add NOT IN check, mirrors existing fix in confirm |
| 3 | BUG-002: relink doesn't update strength_session | High | Small (backend) | Add UPDATE strength_sessions in relink handler |
| 4 | BUG-004: workout split edit is a no-op | Medium | Medium (frontend + backend) | Either write to session_label OR read from activity_logs.workout_split consistently |
| 5 | BUG-005: duration update silent fail | Medium | Small (backend) | Also update strength_sessions directly |
| 6 | BUG-006: wrong date in session list | Medium | Small (backend) | Use start_time with fallback |
| 7 | LOG-001: Wrong edit type for workouts in ActivityDetailSheet | High | Small (frontend) | Detect isWorkout, pass type='workout' + WorkoutInit |
| 8 | LOG-002: deriveSplit vs session_label in ActivityDetailSheet | Medium | Trivial (frontend) | Prefer session_label, fall back to deriveSplit |
| 9 | BUG-007: unsupported params to sessions endpoint | Low | Small (frontend) | Change to `?days=7` |
| 10 | BUG-008: EffortBadge ignores isUnreviewed | Low | Small (frontend) | Apply dim/faded style when unreviewed |
| 11 | BUG-009: fragile timezone pattern | Low | Trivial (frontend) | Replace with toLocaleDateString('en-CA') |

---

---

### FOOD-001 [Medium] — Parse state persists across date changes
- **File:** `src/hooks/useFoodNutrition.ts:73–78`
- **Layer:** Frontend — hook state
- **Description:** The date-change `useEffect` resets `todayLog` but not `parsedItems`, `parseInput`, or `parseState`. Navigating to a different date leaves the previous parse results visible as if they belong to the new date. Pressing "+ Add" on a stale parsed item logs it against the new date.
- **Repro:** Parse some food on today → navigate to yesterday → parsed items still shown.
- **Risk:** Medium — stale UI, accidental logging to wrong date.

---

### FOOD-002 [Low] — Food and water targets are hardcoded constants
- **Files:** `src/types/food.ts:36–41`, `src/components/log/WaterCard.tsx:11`
- **Layer:** Frontend — targets
- **Description:** `FOOD_TARGETS` (kcal 2358, protein 180g, carbs 260g, fat 80g) and `DAILY_TARGET` (3000ml water) are module-level constants. User's actual targets (from health_goals DB via momentum signals) differ — protein 175–190g, water 2400–2800ml, etc. Editing goals in the app has no effect on these values.
- **Risk:** Low — minor display inaccuracy. Defer until goals page exposes food targets via API.

---

### FOOD-003 [Low] — No loading state during food log fetch in useFoodNutrition
- **File:** `src/hooks/useFoodNutrition.ts:73–78`
- **Layer:** Frontend — hook state
- **Description:** The date-change effect resets `todayLog` to `[]` synchronously before the fetch completes. `FoodNutritionCard` immediately shows "Nothing logged yet" while waiting for the API. On fast connections this is a brief flicker; on slow connections it's misleading.
- **Risk:** Low — UX polish.

---

### FOOD-004 [Low] — Dead file: `src/components/log/NutritionCard.tsx`
- **File:** `src/components/log/NutritionCard.tsx`
- **Layer:** Frontend — dead code
- **Description:** Replaced by `FoodNutritionCard.tsx`. No longer imported by `LogCards.tsx` or any other file. Consumes build analysis budget and adds noise to the codebase.
- **Risk:** Low — no runtime impact.

---

### FOOD-005 [Low] — "Today's log" label hardcoded regardless of selected date
- **File:** `src/components/log/FoodNutritionCard.tsx:303`
- **Layer:** Frontend — UX
- **Description:** The log section always shows "TODAY'S LOG" even when viewing a past date. Minor UX inconsistency.
- **Risk:** Low — cosmetic only.

---

### WATER-001 [Low] — Add/delete errors in WaterCard are silently swallowed
- **File:** `src/components/log/WaterCard.tsx:68–72, 90–93, 103–105`
- **Layer:** Frontend — error handling
- **Description:** `handleAdd`, `handleCustomAdd`, and `handleDelete` all have `catch { // no-op }`. Failed add: no feedback, no optimistic rollback. Failed delete: entry silently stays (already not removed optimistically), no error shown.
- **Risk:** Low — user has no indication their action failed.

---

---

### DASH-001 [Medium] — `refetchAll` never calls `progress.refetch()`, and `momentum` missing from deps
- **File:** `src/pages/DashboardPage.tsx:70–82`
- **Layer:** Frontend — pull-to-refresh
- **Description:** `refetchAll` calls `readiness.refetch()`, `momentum.refetch()`, `v2.refetch()`, etc. but never calls `progress.refetch()`. ProgressCard data (weight, RHR, cals) is stale after pull-to-refresh or sync. Additionally, `momentum` is used inside the callback but not listed in the `useCallback` dependency array — stale closure risk if `momentum.refetch` were ever unstable.
- **Repro:** Pull to refresh → MomentumCard updates → ProgressCard stays at old weight/data.
- **Risk:** Medium — stale data displayed without any indication.

---

### DASH-002 [Low] — `useDashboard.refetch` not memoized — unstable object refs in `refetchAll` deps
- **File:** `src/hooks/useDashboard.ts:158–163`
- **Layer:** Frontend — hook
- **Description:** The `refetch` returned by `useDashboard` is a plain arrow function (not `useCallback`). The `readiness`, `vitals`, `streaks` objects returned are also new references on every render. Since `refetchAll` in DashboardPage lists these objects in its dependency array, `refetchAll` is recreated on every render, causing SyncButton to receive a new prop on every render.
- **Risk:** Low — SyncButton re-renders unnecessarily on every state change. No functional bug.

---

### DASH-003 [Low] — Duplicate `useMomentumSignals(14)` API calls on every dashboard load
- **Files:** `src/components/dashboard/MomentumCard.tsx:311`, `src/hooks/useProgress.ts:7`
- **Layer:** Frontend — API efficiency
- **Description:** Both `MomentumCard` and `ProgressCard` independently call `useMomentumSignals(14)`, firing 2 identical `GET /api/momentum/signals?days=14` requests on every dashboard render. `GoalDetailSheet` adds a third `useMomentumSignals(7)` when open.
- **Risk:** Low — redundant network request. No correctness issue.

---

### DASH-004 [Low] — `SignalDeviationChart` has unused `signal?: MomentumSignal` prop
- **File:** `src/components/dashboard/SignalDeviationChart.tsx:14`
- **Layer:** Frontend — dead prop
- **Description:** The `signal` field is declared in the `Props` interface but is never destructured or used in the component body. Dead interface field.
- **Risk:** Low — code quality.

---

### DASH-005 [Low] — `ProgressCard.MiniSparkline` renders flat data at bottom edge instead of centre
- **File:** `src/components/dashboard/ProgressCard.tsx:248–253`
- **Layer:** Frontend — chart rendering
- **Description:** When all 7 values are identical (e.g. weight unchanged for a week), `range = vMax - vMin = 0 || 1 = 1`. Then `(p.v - vMin) / range = 0`, so all points map to `y = pad + innerH` (bottom edge of the sparkline). `MomentumCard.MiniSparkline` (lines 282–286) handles this correctly by rendering at `centerY` when `range === 0`.
- **Risk:** Low — visual glitch when progress metrics are stable.

---

### DASH-006 [Medium] — ProgressCard weight headline "At goal weight" triggers above target range
- **File:** `src/components/dashboard/ProgressCard.tsx:289–293`
- **Layer:** Frontend — display
- **Description:** `const gap = targetMin - weightToday; if (gap <= 0)` marks "At goal weight" whenever `weightToday >= targetMin`, ignoring `targetMax`. Weight goal is 71–72 kg; if weight is 73 kg, `gap = 71 - 73 = -2 <= 0` → headline shows "At goal weight" despite being above the target ceiling.
- **Risk:** Medium — misleading headline for overshoot case.

---

### DASH-007 [Low] — `ProgressCard.trendArrow` ignores signal direction for RHR
- **File:** `src/components/dashboard/ProgressCard.tsx:44–49`
- **Layer:** Frontend — UX
- **Description:** `trendArrow` uses `_key` (unused) and returns ↑ when `today > baseline` for all signals. For `rhr_bpm` (direction: "lower"), ↑ means RHR is rising — bad — but the arrow shows ↑ without qualification. `trendColor` does correctly show blue for a rising RHR, so the colour communicates the sentiment, but the arrow is semantically inverted.
- **Risk:** Low — colour already communicates direction correctly; arrow is supplementary.

---

## Resolved

### ~~DASH-001~~ [Medium] — refetchAll missing progress.refetch() ✅ Fixed (2026-03-16)
`progress.refetch()` added to `refetchAll`. `momentum` and `progress` added to deps array.

### ~~DASH-002~~ [Low] — useDashboard.refetch not memoized ✅ Fixed (2026-03-16)
Wrapped in `useCallback` with `[readiness.refetch, vitals.refetch, streaks.refetch]` deps.

### ~~DASH-004~~ [Low] — SignalDeviationChart unused `signal` prop ✅ Fixed (2026-03-16)
Removed `signal?: MomentumSignal` from Props interface and its import.

### ~~DASH-005~~ [Low] — ProgressCard MiniSparkline flat data at bottom edge ✅ Fixed (2026-03-16)
Applied same `range === 0 ? centerY : ...` pattern already in MomentumCard.MiniSparkline.

### ~~DASH-006~~ [Medium] — ProgressCard weight headline ignores targetMax ✅ Fixed (2026-03-16)
"At goal weight" now requires `weightToday >= targetMin && weightToday <= targetMax`.

### ~~FOOD-001~~ [Medium] — Parse state persists across date changes ✅ Fixed (2026-03-16)
Date-change `useEffect` in `useFoodNutrition.ts` now resets `parsedItems`, `parseInput`, and `parseState` to idle before fetching the new day's log.

### ~~FOOD-003~~ [Low] — No loading state during food log fetch ✅ Fixed (2026-03-16)
Added `logLoading` boolean to `useFoodNutrition` hook. `FoodNutritionCard` shows "Loading…" instead of "Nothing logged yet" while fetch is in flight.

### ~~FOOD-004~~ [Low] — Dead file NutritionCard.tsx ✅ Fixed (2026-03-16)
File deleted. No imports existed.

### ~~FOOD-005~~ [Low] — "Today's log" label hardcoded for all dates ✅ Fixed (2026-03-16)
`FoodNutritionCard` now shows "Today's log" for today and "Log" for past dates.

### ~~WATER-001~~ [Low] — Add/delete errors silently swallowed in WaterCard ✅ Fixed (2026-03-16)
`handleAdd`, `handleCustomAdd`, `handleDelete` now set `error` state on failure. Existing "Retry" UI in the card displays the message.

### ~~LOG-001~~ [High] — ActivityDetailSheet wrong edit type for workouts ✅ Fixed (2026-03-16, commit: 7147ba7)
Workout/strength items now open `type='workout'` with `WorkoutInit` (split picker, date/time, HR fields). Run/ride items continue to use `type='activity'`. `workout_split` sourced from `linkedSession.session_label`.

### ~~LOG-002~~ [Medium] — ActivityDetailSheet deriveSplit vs session_label ✅ Fixed (2026-03-16, commit: 7147ba7)
Split display now uses `session_label` (capitalised) first, falls back to `deriveSplit()`. Mirrors the CAL-001 fix already applied to `DayDetailSheet`.

### ~~BUG-003~~ [High] — Delete activity leaves dangling session link ✅ Fixed (2026-03-16, commit: e824f3e)
`DELETE /api/activity-logs/{id}` now NULLs `strength_sessions.activity_log_id` before deleting.

### ~~BUG-002~~ [High] — Relink doesn't update strength_session ✅ Fixed (2026-03-16, commit: e824f3e)
`PATCH /api/log/strength/{id}/relink` now updates `strength_sessions.activity_log_id` via `bridged_session_id`.

### ~~BUG-004~~ [Medium] — Workout split edit is a no-op ✅ Fixed (2026-03-16, commit: e824f3e)
`PATCH /api/activity-logs/{id}` propagates `workout_split` → `strength_sessions.session_label`. DB column missing fix was already in previous session.

### ~~BUG-005~~ [Medium] — Duration update silent fail for NLP sessions ✅ Fixed (2026-03-16, commit: e824f3e)
Duration edit also updates `activity_logs.duration_mins` for sessions without a `manual_strength_logs` row.

### ~~BUG-006~~ [Medium] — Wrong date in session list ✅ Fixed (2026-03-16, commit: e824f3e)
`list_strength_sessions` + `last_strength_log` now cast dates with `AT TIME ZONE 'Australia/Brisbane'`.

### ~~BUG-001~~ [High] — Duplicate auto-link in `save_strength_log` ✅ Fixed (other session, 2026-03-16)
Added exclusivity check (mirrors `confirm_strength_entry`). Manual link endpoint also now returns 409 on conflict.

### ~~BUG-004 (partial)~~ [Medium] — workout_split column missing from DB ✅ Fixed (other session, 2026-03-16)
Column migration added to `main.py` startup. PATCH `/api/activity-logs/{id}` no longer errors on `workout_split`. The split label vs `activity_logs.workout_split` display mismatch (feed reads from `session_label` not column) remains as BUG-004 above.

### ~~(new fix)~~ — DayDetailSheet missing Edit/Link buttons for unlinked sessions ✅ Fixed (other session, 2026-03-16)
Calendar day detail now shows "Edit session" (set split label) and "Link workout" for unlinked strength sessions.
