# Backlog

> Prioritised future work. Each item: 1-line description + relevant reference.
> Pick from top to bottom. Create a task file in `tasks/active/` before starting.

---

## High Priority

- **Sleep dashboard** — Stage bars + consistency % + debt tracker + score trend. Original design reference: `archive/gavhealth[original-design].html` (sleep section). API: `GET /api/sleep?days=N`.
- **Goal rings** — 4 SVG progress rings (Sleep, Activity, Nutrition, Recovery) as dashboard hero. Replaces or wraps ReadinessCard. Original design reference: `archive/gavhealth[original-design].html` (goal rings section).
- **Deploy `GET /api/habits`** — Endpoint exists in `new_endpoints.py`, needs deploying to Railway. Unlocks habits history view in HabitsCard.

---

## Medium Priority

- **Visual polish pass** — Card texture overlays (SVG), Strava-style underline tabs on LogPage, micro-animations on state transitions. Reference: `archive/gavhealth[original-design].html`, `reference/brand.md`.
- **AI trend narratives** — Add GPT/Claude narrative summaries to TrendsPage below correlation indicators. API: `GET /api/readiness` already returns narrative for dashboard; need similar for trends.
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
