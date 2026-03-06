# Calendar Spec

**Route:** `/calendar`
**Purpose:** Multi-layer pattern view. See all health categories overlaid across time to spot patterns and correlations.

## Core Use Case

Pattern recognition. "When I string together 3 nights of poor sleep, my RHR climbs and my run pace drops 2 days later." The calendar makes these correlations VISIBLE without requiring the user to cross-reference data manually.

## Layout (Mobile-First)

### Month View (Default)
- Compact dot matrix: 7 columns (Mon-Sun), 4-5 rows per month
- Each day cell contains small colored dots representing categories with data
- Category dots stacked vertically in each cell
- Month/year header with prev/next navigation
- Swipe left/right to change month

### Category Dots

| Category | Color | Dot Meaning |
|----------|-------|-------------|
| Weight | #e8c47a | Weight logged |
| Sleep | #7FAABC | Sleep data available (dawn blue — exclusive to sleep) |
| Heart | #c4856a | RHR data available |
| Running | #b8a878 | Run activity logged |
| Strength | #b47050 | Strength session logged |
| Sauna | #c45a4a | Sauna session logged |
| Nutrition | #e8c47a | Food logged |

### Day Detail (Tap to Expand)
- Bottom sheet slides up showing day's data
- Sections for each category with data that day
- Key metrics displayed: sleep hours, RHR, run distance/pace, strength volume, food macros
- Signal color coding on values (good/caution/poor thresholds)

## Data Sources

| Data | Endpoint | Notes |
|------|----------|-------|
| Activities | `GET /api/data/activities?days=90` | All activity types for dot rendering |
| Sleep | `GET /api/data/sleep?days=90` | Sleep data for dots + day detail |
| Weight | `GET /api/data/weight?days=90` | Weight for dots + day detail |
| RHR | `GET /api/data/rhr?days=90` | Heart rate for dots + day detail |
| Food | `GET /api/data/food?date=YYYY-MM-DD` | Per-day on tap (not preloaded) |
| Sauna | `GET /api/data/sauna?days=90` | Sauna for dots + day detail |

## Interactions

- Swipe left/right for month navigation
- Tap day cell → bottom sheet with day detail
- Category filter toggle bar at top (show/hide categories)
- Pinch to zoom between month/week view (Phase 2)

## Phase 1 Scope

**Included:** Month dot matrix, day detail bottom sheet, category filter toggles, 90-day data window
**Excluded:** Week view, pinch zoom, trend overlays within calendar, year view
