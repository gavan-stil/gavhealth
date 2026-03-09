# Architecture Visualisation — Design Session

## Goal
Build a learning artifact that shows how the goe-health codebase works —
from user tap → React component → API → Python → Database → back up.

---

## Questions & Answers

### Q1: What's the main thing you want to "get" from this?
Options: A (data flow) / B (code organisation) / C (backend layer) / D (all layers connected)
**Answer: D** — full stack, frontend → backend → database as connected layers.

### Q2: How do you like to learn visually?
Options: A (top-down flow) / B (layer cake) / C (node map) / D (hybrid: layer cake for big picture, node map inside frontend)
**Answer: D** — layer cake for the stack, node map inside the frontend layer.

### Q3: How much detail inside the frontend layer?
Options: A (4 pages + major cards only) / B (pages → cards → hooks/API calls) / C (full chain: pages → cards → hooks → API endpoint → Python → DB table)
**Answer: C** — everything. Full chain for every card.

### Q4: Interactivity level?
Options: A (static) / B (click to expand) / C (hover tooltips) / D (B + C: expandable + hover explanations)
**Answer: D** — click to expand cards, hover for plain-English descriptions.

### Q5: Style?
Options: A (match the app — ochre, dark bg, design tokens) / B (classic tech diagram) / C (clean minimal)
**Answer: A** — match the app. Could build B/C variants later.

### Q6: Anything specific to highlight?
**Answer:** No — cover everything evenly. All tooltips in plain English, no jargon.

---

## Questions remaining
None. Ready to build.

---

## Emerging spec (draft)
- HTML artifact saved to `archive/`
- Layer cake: 3 horizontal bands — React (top) / FastAPI Python (middle) / PostgreSQL (bottom)
- Inside React band: node map of pages → cards → hooks
- Each node traces down to its API endpoint, then to its Python handler, then to its DB table
- Full chain visible for every card
