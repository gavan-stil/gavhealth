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

## D006 — Calendar is Phase 1 core (2026-03-04)

**Decision:** Calendar overview is a core Phase 1 feature, not deferred to Phase 2.

**Rationale:** User explicitly stated: "I really love the calendar overview... That's super important." The multi-layer dot matrix showing patterns across categories over time is central to the recovery-performance correlation use case.
