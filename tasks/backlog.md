# Backlog

> Prioritised future work. Each item: 1-line description + relevant reference.
> Pick from top to bottom. Create a task file in `tasks/active/` before starting.

---

## High Priority

- **Strength Trends — backend work** — 4 backend tasks required before Strength Trends UI can be wired. See `reference/withings-data.md` §Backend Work Required. In order:
  1. Store `bodyweight_at_session` at log time (lookup `weight_log`, 7d rolling avg fallback)
  2. Add `activity_log_id FK` to `strength_sessions` — link by date proximity at log time
  3. New `GET /api/strength/sessions?days=N` — per-session aggregates (sets, load, duration, avg_hr)
  4. New `GET /api/strength/exercise/:id/history?days=N` — per-exercise session data for drill-down
- **Strength Trends — frontend** — HTML mockup approved → wire to React on Trends page. Two sections: Workout Volume (cascade weekly→session bars + metric toggles) + Exercise Progress (per-exercise sparkline + cumulative load). Mockup: `archive/strength-trends-mockup.html`.
- **Sleep dashboard** — Stage bars + consistency % + debt tracker + score trend. Original design reference: `archive/gavhealth[original-design].html` (sleep section). API: `GET /api/sleep?days=N`.
- **Goal rings** — 4 SVG progress rings (Sleep, Activity, Nutrition, Recovery) as dashboard hero. Replaces or wraps ReadinessCard. Original design reference: `archive/gavhealth[original-design].html` (goal rings section).
- **Deploy `GET /api/habits`** — Endpoint exists in `new_endpoints.py`, needs deploying to Railway. Unlocks habits history view in HabitsCard.

---

## Medium Priority

- **Visual polish pass** — Card texture overlays (SVG), Strava-style underline tabs on LogPage, micro-animations on state transitions. Reference: `archive/gavhealth[original-design].html`, `reference/brand.md`.
- **AI trend narratives** — Add GPT/Claude narrative summaries to TrendsPage below correlation indicators. API: `GET /api/readiness` already returns narrative for dashboard; need similar for trends.
- **Store Withings HR zones** — `activity_log` has `zone_seconds` col (always NULL). Expand to `hr_zone_0/1/2/3` int columns (secs in each zone) + populate at sync time from Withings `data.hr_zone_*`. See `reference/withings-data.md`. Enables intensity tracking on Trends.
- **Unmatched strength sessions** — Sessions in `manual_strength_logs` not shown in ActivityFeed independently. Either surface them in the feed or prompt to link at next Workout item.
- **CORS tightening** — Backend currently allows `*`. Restrict to `gavhealth.vercel.app` after frontend is stable. (Backend change, not frontend.)

---

## Low Priority

- **PWA manifest** — `manifest.json` + service worker so app can be installed to home screen on iOS/Android. No build changes required, just static files.
- **Desktop layout** — App is 375px only. Responsive breakpoints at 768px+ for use on laptop. Low priority (user says phone only).
- **Build chunk size** — JS bundle is 673KB (Vite warns > 500KB). Could split recharts into a lazy chunk. No functional impact.
- **Period selector** — Original design has 1W/1M/3M/1Y/All range selector on Trends. Current app has 7/30/90 only.

---

## Blocked / User Action Required

- **Withings OAuth** — Daily sync via GitHub Actions cron is set up but Withings OAuth flow not completed. No new health data will sync until Gav completes the Withings device authorisation. (Not a code task.)
