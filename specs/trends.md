# Trends Route — Feature Spec

> Recovery vs performance correlation — THE core use case of the app.

---

## Route

`/trends` — accessible from bottom tab bar (chart/line icon)

## Purpose

Show how recovery signals (sleep, RHR, sauna, nutrition) correlate with performance outputs (run intensity, weightlifting frequency). This is what makes the app valuable beyond a basic dashboard.

---

## Layout

Mobile-first vertical scroll. Three sections:

### 1. Time Range Selector (sticky top)

- Pill toggle: 30d | 90d | 180d | All
- Default: 90d

### 2. Recovery Overview

Stacked mini-charts (sparkline style, ~80px tall each):

| Metric | Color | Source |
|--------|-------|--------|
| Sleep Duration | `#7FAABC` (dawn) | `/api/data/sleep?days=N` |
| Deep Sleep % | `#7FAABC` at 60% opacity | Same endpoint |
| Resting HR | `#c4856a` (clay) | `/api/data/rhr?days=N` |
| Sauna Sessions | `#c45a4a` (ember) | `/api/data/sauna?days=N` |
| Weight | `#e8c47a` (gold) | `/api/data/weight?days=N` |

Each sparkline shows 7-day rolling average as smooth line, raw data as dots.

### 3. Performance Overlay

Taller chart (~200px) showing activity intensity overlaid with selected recovery metric:

- X axis: time (shared with recovery charts above)
- Primary Y: Activity load (run distance × pace factor, or strength volume)
- Secondary Y: Selected recovery metric
- Activity dots colored by type: Running `#b8a878`, Strength `#b47050`
- Recovery line from section 2 selection

**Interaction:** Tap any recovery sparkline to overlay it on the performance chart below. Active overlay highlighted, others dimmed.

---

## Correlation Indicators

For each recovery-performance pair, show a simple directional indicator:

- **Arrow up + "Better recovery → more intensity"** when positive correlation detected
- **Arrow down + "Poor recovery → lighter sessions"** when negative correlation
- **Dash + "No clear pattern"** when correlation is weak

These are calculated client-side from the fetched data. Simple Pearson correlation on 7-day rolling averages. No backend AI needed for Phase 1.

---

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/data/sleep?days=N` | GET | Sleep duration + deep % |
| `/api/data/rhr?days=N` | GET | Resting heart rate |
| `/api/data/activities?days=N` | GET | Run + strength sessions |
| `/api/data/weight?days=N` | GET | Weight trend |
| `/api/data/sauna?days=N` | GET | Sauna frequency |
| `/api/summary/weekly` | GET | Aggregated weekly view |

All require header: `X-API-Key`

---

## Design Notes

- Sparklines: 1px stroke, no grid lines, subtle dot markers
- Performance chart: 2px stroke for overlay line, 6px dots for activities
- Use `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (drift) for chart transitions
- Correlation indicators: Inter 10px uppercase label, arrow icon 16px
- Card backgrounds: `#14130f`, borders: `#222018`
- Numbers: JBM 28px for hero stats, JBM 14px for axis labels

---

## Phase 1 Excludes

- AI-generated trend narratives (future: Claude interprets patterns)
- Nutrition overlay (needs more logged data first)
- Export/share trend charts
- Custom date range picker
- Comparison between two time periods
- Weekly email summary of trends
