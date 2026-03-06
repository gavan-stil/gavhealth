# Task 09 — Integration, Polish & Deploy

Purpose: Auth gate, route transitions, pull-to-refresh, global error boundary, Vercel deployment, smoke test.

---

## Scope Gate

**DOES:**
- Add auth gate (password: `goe2026`) — blocks all routes until authenticated
- Add route transition animations
- Add pull-to-refresh on Dashboard
- Add global error boundary component
- Deploy to Vercel via fresh clone + push
- Smoke test all 4 routes on deployed URL

**DOES NOT:**
- Modify individual card designs or layouts
- Add new features or routes
- Change API endpoints or data layer
- Add analytics or telemetry

---

## Pre-flight Checks

- [ ] Tasks 01–08 completed: all 4 routes functional
- [ ] `npm run build` succeeds
- [ ] All routes accessible via tab bar

---

## Design Tokens (inline)

```css
:root {
  --bg-base: #0d0d0a; --bg-card: #14130f; --bg-card-hover: #1c1b15; --bg-elevated: #1e1d18;
  --border-default: #222018; --border-subtle: #1a1914;
  --text-primary: #f0ece4; --text-secondary: #b0a890; --text-tertiary: #9a9080; --text-muted: #7a7060;
  --ochre: #d4a04a; --ochre-light: #e8c47a; --ochre-dim: #a07830;
  --sand: #b8a878; --clay: #c4856a; --rust: #b47050; --gold: #e8c47a;
  --dawn: #7FAABC; --blush: #d4a890; --ember: #c45a4a;
  --signal-good: #e8c47a; --signal-caution: #d4a04a; --signal-poor: #c47a6a;
  --space-xs: 4px; --space-sm: 8px; --space-md: 14px; --space-lg: 20px; --space-xl: 32px; --space-2xl: 48px;
  --radius-sm: 8px; --radius-md: 14px; --radius-lg: 20px; --radius-pill: 100px;
  --ease-settle: cubic-bezier(0.16, 1, 0.3, 1); --ease-drift: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --duration-fast: 120ms; --duration-normal: 200ms; --duration-slow: 400ms;
}
```

### Typography

```
.hero-value   { font: 800 52px/1 'JetBrains Mono', monospace; letter-spacing: -3px; }
.card-value   { font: 800 40px/1 'JetBrains Mono', monospace; letter-spacing: -2px; }
.stat-number  { font: 800 28px/1 'JetBrains Mono', monospace; letter-spacing: -1.5px; }
.small-number { font: 600 14px/1 'JetBrains Mono', monospace; letter-spacing: -0.5px; }
.page-title   { font: 800 24px/1.2 'Inter', sans-serif; letter-spacing: -1px; }
.section-head { font: 700 16px/1.2 'Inter', sans-serif; letter-spacing: -0.5px; }
.body-text    { font: 400 14px/1.5 'Inter', sans-serif; }
.label-text   { font: 600 10px/1 'Inter', sans-serif; letter-spacing: 1.2px; text-transform: uppercase; }
```

---

## API Endpoints (inline)

No new endpoints. This task uses all existing endpoints from Tasks 03–08.

**Base URL:** `https://gavhealth-production.up.railway.app`
**Auth header:** `X-API-Key: gavhealth-prod-api-2026-xK9mP3`

---

## Component Specs

### 1. Auth Gate — `src/components/AuthGate.tsx`

Full-screen gate that wraps the entire app.

- Background: `var(--bg-base)` (#0d0d0a)
- Center-aligned vertically and horizontally
- Logo/title: "GOE" in `hero-value` style, `var(--ochre)`
- Subtitle: "Health" in `section-head`, `var(--text-muted)`
- Password input:
  - `bg: var(--bg-elevated)`, `border: 1px solid var(--border-default)`, `radius: var(--radius-md)`
  - `padding: var(--space-md)`, `color: var(--text-primary)`, `font: body-text`
  - `type: password`, placeholder: "Enter password"
- Submit button: "Enter" — `bg: var(--ochre)`, `color: var(--bg-base)`, `radius: var(--radius-md)`, `padding: var(--space-sm) var(--space-xl)`
- Wrong password: input border flashes `var(--signal-poor)` for 1s, subtle shake animation
- Correct password (`goe2026`): store in `sessionStorage`, render app
- Check `sessionStorage` on mount — skip gate if already authenticated

### 2. Route Transitions

Wrap route outlet with a simple fade transition:

```css
.route-enter { opacity: 0; transform: translateY(8px); }
.route-enter-active {
  opacity: 1; transform: translateY(0);
  transition: opacity var(--duration-normal) var(--ease-drift),
              transform var(--duration-normal) var(--ease-settle);
}
```

Keep it minimal — no page slide or complex choreography.

### 3. Pull-to-Refresh — Dashboard Only

- Overscroll at top of Dashboard triggers refresh
- Pull indicator: small `Loader2` icon (lucide-react), spinning, `var(--ochre)`, centered above first card
- Threshold: 60px pull distance
- On release: re-fetch all 3 dashboard endpoints
- Implementation: touch event listeners on Dashboard scroll container (`touchstart`, `touchmove`, `touchend`)

### 4. Global Error Boundary — `src/components/ErrorBoundary.tsx`

React error boundary that catches render crashes.

- Catches: any uncaught error in component tree
- Shows: centered card with `AlertTriangle` icon, "Something went wrong" message, "Reload" button
- Reload button: `window.location.reload()`
- Styling: standard card (`bg-card`, `border-default`, `radius-lg`), centered on `bg-base`

### 5. Deployment

**Method:** Fresh clone to `/tmp`, copy built files, push with PAT. **Never use git inside `/mnt/`.**

```bash
# 1. Build the project
cd /mnt/goe-health && npm run build

# 2. Fresh clone
rm -rf /tmp/gavhealth-push
git clone https://github.com/gavan-stil/gavhealth.git /tmp/gavhealth-push

# 3. Copy built output
cp -r /mnt/goe-health/dist/* /tmp/gavhealth-push/
# (adjust based on actual build output structure)

# 4. Configure git and push
cd /tmp/gavhealth-push
git config user.name "Gavan Stilgoe"
git config user.email "gavan@r6digital.com.au"
git add -A
git commit -m "Deploy: all routes live"
git push https://gavan-stil:TOKEN@github.com/gavan-stil/gavhealth.git main
```

**Git credentials:**
- Repo: `https://github.com/gavan-stil/gavhealth.git`
- PAT: `[REDACTED]`
- User: `Gavan Stilgoe <gavan@r6digital.com.au>`
- Vercel project: `prj_fxgUwqBpIWrKNTBGbtvOYJeBy7mq`
- Vercel team: `team_Gwse87RecVqLNTuaAmnpXG8M`

### 6. Smoke Test Checklist

After deploy, verify on `gavhealth.vercel.app`:

- [ ] Auth gate appears, rejects wrong password, accepts `goe2026`
- [ ] Dashboard loads with live data, pull-to-refresh works
- [ ] Calendar shows month grid with dots, day detail sheet opens
- [ ] Log cards accept input, NLP parsing works, confirmation saves
- [ ] Trends charts render with correct time ranges
- [ ] Tab bar navigates between all 4 routes
- [ ] No console errors on any route

---

## File Structure

```
src/
├── components/
│   ├── AuthGate.tsx           (new)
│   └── ErrorBoundary.tsx      (new)
├── App.tsx                     (modify — wrap with AuthGate + ErrorBoundary)
├── pages/
│   └── DashboardPage.tsx       (modify — add pull-to-refresh)
```

---

## Done-When

- [ ] Auth gate blocks access until correct password entered
- [ ] Session persists in sessionStorage (no re-auth on refresh)
- [ ] Route transitions animate smoothly (fade + subtle translateY)
- [ ] Pull-to-refresh on Dashboard re-fetches all data
- [ ] Error boundary catches render crashes with reload option
- [ ] Successfully deployed to gavhealth.vercel.app
- [ ] All 4 routes pass smoke test on mobile viewport
- [ ] No TypeScript errors (`npm run build` succeeds)
- [ ] No console errors in production

---

## If Blocked

1. Try 3 different approaches
2. Document what was tried and what failed
3. Stop — do NOT keep looping
4. Report the blocker to Gav with specifics

---

## After Completion

1. Move this file from `tasks/active/` to `tasks/done/`
2. Update `README.md` — all routes marked as complete
3. Add final entry to `CHANGELOG.md`
4. Project complete 🎉
