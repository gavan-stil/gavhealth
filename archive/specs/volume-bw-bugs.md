# Bodyweight Volume/Load Bug Register — 2026-07-08
_Audit of every volume/load calculation in the system after the SessionPickerSheet "0 kg volume" bug.
Each fix has a premortem: what could regress, and the mitigation baked in._

**Bug class:** the app has one canonical load definition — `reps × (bodyweight_at_session if is_bodyweight else 0 + weight_kg)` —
but some code paths compute load ignoring bodyweight. Pure-BW sessions (most of Gav's training) then read 0,
and `bw+` sessions undercount (added kg only). A related trap: JSONB `bw` sets carry a **stale `kg` value**
(leftover `DEFAULT_SET.kg = 20` UI state) that must never be trusted.

---

## Audit results — every load calculation

| Surface | Formula | Verdict |
|---|---|---|
| `GET /api/strength/sessions` (Trends charts, DayDetailSheet) | SQL, BW-inclusive | ✅ correct |
| `GET /api/strength/sessions/last-by-split/{split}` (StrengthCard compare) | SQL, BW-inclusive | ✅ correct |
| `GET /api/strength/exercise/{id}/history` → `session_volume_kg` | SQL, BW-inclusive | ✅ correct |
| `GET /api/strength/exercise/{id}/history` → `estimated_1rm` | `COALESCE(weight_kg,0)` only | ❌ **BUG 1** — fixed |
| `GET /api/strength/exercise/{id}/history` → `top_weight_kg` | external weight only | ⚠️ intended for PB guards; effective-load variant added (**BUG 2**) |
| `GET /api/log/strength/recent/{split}` (SessionPickerSheet) | JSONB, skipped `bw` | ❌ fixed 2026-07-08 (`4e35589`) |
| `StrengthCard.computeCurrentStats` (live logging) | BW-inclusive via `/api/weight?limit=1`, `~` when unknown | ✅ correct |
| `ExerciseProgressCard` TOP / EST 1RM / sparkline | consumed broken `estimated_1rm` + external-only `top_weight_kg` | ❌ **BUG 2** — fixed |
| `GET /api/strength/prs` (data.py) | `WHERE weight_kg IS NOT NULL` — BW PBs invisible | ⚠️ **no frontend consumer** — documented, not fixed |
| Bridge paths (`new_endpoints.py` builder save, `logging.py` NLP save) | snapshot `bodyweight_at_session` (exact date → 7-record rolling avg) | ✅ correct |
| Historical data | 57/57 sessions have non-zero load (curl-verified 2026-07-08) | ✅ no backfill needed |

**Weight-sync hypothesis disproved:** `bodyweight_at_session` was populated for all sessions.
The lookup falls back to the average of the last 7 weight readings, so a stale sync still yields a value —
it returns NULL only if `weight_logs` is empty before the session date.

---

## BUG 1 — `estimated_1rm` is 0 for bodyweight sessions

**Bug:** Epley formula used `COALESCE(st.weight_kg, 0)` — `bw` sets (weight NULL) → 1RM 0.0;
`bw+` sets → 1RM from added kg only (e.g. 24kg "1RM" for +20kg pull-ups).
Trends exercise cards showed "EST 1RM 0.0kg" for most exercises.

**Fix:** compute Epley on effective load: `(bodyweight_at_session if is_bodyweight else 0) + weight_kg`.

**Premortem:**
- *Consumers:* `estimated_1rm` is read only by `ExerciseProgressCard`. For kg-only exercises the value is
  unchanged (`is_bodyweight = false` → same formula). No other surface can regress.
- *Values jump at deploy* (0 → ~90kg for pull-ups): a correction, not a regression; no comparisons are stored.
- *Epley accuracy above ~10 reps is poor:* inherent to the formula, unchanged for kg exercises — out of scope.

## BUG 2 — ExerciseProgressCard TOP/sparkline show external weight only

**Bug:** sparkline + TOP + 4-week-change badge used `top_weight_kg`, which is external weight only.
For BW exercises this flip-flops 0↔20 depending on whether any set was `bw+` — meaningless as a progress line.

**Fix:** backend adds `top_effective_kg` (max per-set effective load) to the history response;
`ExerciseProgressCard` uses `top_effective_kg ?? top_weight_kg` for sparkline/TOP/change badge.

**Premortem — why NOT change `top_weight_kg` itself:**
- `DayDetailSheet`, `ActivityDetailSheet`, `ActivityFeed` compute weight-PB flags from `top_weight_kg`
  guarded by `!uses_bodyweight`; `StrengthCard`'s history modal hides the TOP column when all zeros.
  Changing its semantics could raise false PB flames and un-hide columns. **Additive field instead.**
- *Deploy-order coupling:* Vercel + Railway deploy independently from the same push. If the frontend lands
  first, `top_effective_kg` is `undefined` → `?? top_weight_kg` falls back to old behaviour. Baked in.
- *Response stripping:* endpoint returns plain dicts (no Pydantic `response_model`) → new field passes through.
  (Contrast MOMENTUM schema trap in MEMORY.md.)
- *BW fluctuation noise in the sparkline:* effective load moves with bodyweight (~±0.5kg) — acceptable;
  it IS the load being lifted, and bodyweight gain is a stated goal.
- *NULL `bodyweight_at_session`:* COALESCE→0 keeps today's behaviour; verified zero such rows exist.

## BUG 3 — Trends split charts drop most sessions since April (found 2026-07-08, same review)

**Symptom:** Split Progress showed "5 sessions / latest 29 Jun" for Push despite ~20 push sessions in the
window (latest 5 Jul). Strength Quality showed most dots as "Mixed" and "3 of 38 have HR".

**Two stacked causes:**
1. `_session_category` only consulted the user's explicit `session_label` (set from `workout_split` at
   builder save) when muscle-group inference came up EMPTY. Any session spanning ≥2 muscle groups — i.e.
   nearly all of them — returned `"mixed"` regardless of the label. The authority order was inverted.
2. `activity_log_id` is NULL on almost every session since April: the save-time activity match runs when
   the manual log is saved, but Withings syncs the workout row HOURS LATER — the match races the sync and
   loses. With the link dead, the frontend `workout_split` lookup can't rescue the category, HR/duration
   never attach, and the Withings rows keep `workout_split = NULL` (calendar unlabelled).

**Fixes:**
- `_session_category` now returns a valid `session_label` FIRST; muscle inference is fallback-only.
- `_sweep_unlinked_sessions`: links unlinked sessions to unclaimed same-date workout rows, copies the
  session label to `activity_logs.workout_split` (only when NULL), and sets `matched_activity_id` on the
  bridged manual log. Runs on every builder save (best-effort, wrapped so it can never block the save) and
  on demand via `POST /api/strength/sessions/backfill-links`.

**Premortem:**
- *Wrong pairing is worse than no pairing:* the sweep only links when a date has EXACTLY one unlinked
  session and one unclaimed workout. Double-session days (e.g. 24 Jun abs+push) are skipped, never guessed —
  `PATCH /api/log/strength/{id}/relink` remains the manual escape hatch.
- *Overwriting user data:* `workout_split` copied only `WHERE workout_split IS NULL`; `matched_activity_id`
  only when NULL; invalid (NLP free-text) labels are not copied.
- *`daily_summary` trap (see MEMORY.md):* sweep filters `activity_type = 'workout'` explicitly.
- *Timezone:* session datetimes converted to Brisbane local date before comparing to `activity_date`.
- *Label-first category moves mislabelled sessions between tabs* (20 Apr / 14 May are labelled `abs` but
  muscle-infer `push`): they now follow the user's label — intended, but a visible diff.
- *Chart re-normalisation:* Push tab goes 5 → ~20 sessions; normalised lines re-scale. Expected correction.
- *NLP-source sessions* with labels outside push/pull/legs/abs fall through to inference — behaviour unchanged.

## BUG 4 — Every session in the picker wears a PB badge (found 2026-07-08)

**Bug:** per-exercise PB compared each session against the all-time max INCLUDING ITSELF
(`top_w >= atm_w`, `max(reps) >= atm_r`). The record-holding session always flags itself, and any
exercise appearing in only one session trivially "holds the record" — with 5–9 exercises per session,
virtually every session contained at least one, so every card got the flame.

**Fix (two levels, matching StrengthCard's volume-based PB convention):**
- **Session flame:** the session's BW-inclusive total volume strictly beat every EARLIER session of the
  split — a volume record when it happened. (First pass used "any exercise set a record", but in a
  progressing bodyweight program some exercise edges a rep record most sessions, so the flame stayed
  near-universal. Volume record is the meaningful session-level bar.)
- **Per-exercise dots:** strictly beat the best weight/reps of all EARLIER sessions, with prior history
  required.
Session volumes now computed for ALL sessions up front (single weight_logs fetch, resolved in Python
with the same exact-date→rolling-7 semantics as `_lookup_bodyweight`), replacing the post-selection
bodyweight top-up.

**Premortem:**
- *Sort order changes:* picker sorts PBs first; far fewer PBs now means mostly chronological order — intended.
- *Ties don't count:* equalling your best is not a PB. Deliberate; strict `>`.
- *First-ever sessions/exercises never PB:* deliberate — "first time" isn't "personal best".
- *Volume comparability:* sessions with no weight data fall back to added-kg-only volume, same as their
  display value — records compare like with like.
- *One weight_logs fetch (~400 rows) per request* replaces up to 20 per-date queries — cheaper, and the
  volume shown now always matches the volume used for the PB decision.

## Auto-link trust indicator (added 2026-07-08, user request)

Links now carry provenance via `manual_strength_logs.match_confirmed`:
- **Manual** (`match_confirmed = true`): user tapped "Link workout" (`PATCH /sessions/{id}/link`, which
  now sets the flag) or used the relink endpoint.
- **Auto** (`false`/null): save-time match or `_sweep_unlinked_sessions`.
`/api/strength/sessions` exposes `link_confirmed`; DayDetailSheet shows a dawn-blue "⚡ auto-linked"
chip on sessions whose link was made automatically. Unlink + relink by hand upgrades it to confirmed.

## Reviewed, working as intended (data gaps, not code)

- **Energy Balance / Protein vs Weight / Nutrition weekly:** no food logs since the week of 11 May 2026 —
  empty states are correct. Resume food logging to repopulate.
- **Water card:** `water_logs` empty for 14+ days — "No water data yet" is accurate (if grating).
- **5 Jul push session has NO Withings workout row at all** (watch not worn/synced) — nothing to link;
  it appears in charts via its label but will never have HR.

## Documented, deliberately not fixed

1. **`GET /api/strength/prs`** — ignores bodyweight entirely (`WHERE weight_kg IS NOT NULL`). No frontend
   consumer today. Fix when a PR surface is built; use effective load and the `uses_bodyweight` display split.
2. **SessionPicker per-exercise PB weight check** compares `bw+` added-kg against `kg` full-weight for the
   same exercise name. Exercises rarely mix load types; reps-PB still catches these. Revisit if flames look wrong.
3. **Stale `kg` on `bw` sets in JSONB** — harmless today because every reader ignores `kg` when
   `load_type === 'bw'`. Any NEW consumer of `raw_exercises`/`msl.exercises` must keep ignoring it.
