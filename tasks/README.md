# Task Conventions

> How AI sessions execute tasks, handle changes, and keep the project in sync.

---

## Session Start Protocol

Every Cowork session begins with exactly 2 reads:

1. **Read `goe-health/README.md`** — get project status, find next task
2. **Read the active task file** (e.g. `tasks/active/01-scaffold.md`) — get ALL context needed to execute

That's it. No other files should be needed. If a task file references something that isn't inline, the task file is broken — fix it before executing.

---

## Task File Structure

Every task file is self-contained. It includes:

```
# Task NN — Title
Purpose: One sentence.

## Scope Gate
DOES: [list of deliverables]
DOES NOT: [explicit exclusions]

## Pre-flight Checks
- [ ] Verify X is accessible
- [ ] Confirm Y returns expected data

## Design Tokens (inline)
[Subset of brand tokens needed for this task — copied from reference/brand.md]

## API Endpoints (inline)
[Subset of endpoints needed — copied from reference/api.md]

## Components to Build
[Detailed specs per component]

## Mock Data (inline)
[JSON fixtures for development/testing]

## Done-When
- [ ] Checklist of completion criteria

## If Blocked
1. Try 3 different approaches
2. Document what was tried and what failed
3. Stop — do NOT keep looping
4. Report the blocker to Gav with specifics

## After Completion ("save it all")
1. Move this file from tasks/active/ to tasks/done/
2. Update STATUS.md — move task to Recently Completed, clear Active Task
3. Add entry to CHANGELOG.md
4. Update features.md — update affected route's feature list
5. Update reference/api.md — add/update any new or changed endpoints
6. Delete SESSION.md if it exists
```

**Why duplication?** Cowork sessions lose context during compaction. If a task file contains everything inline, re-reading it after compaction restores full context. Cross-file references break under compaction.

---

## Executing a Task

1. Read the task file top to bottom
2. Run pre-flight checks — stop if any fail
3. Build what's in the Scope Gate DOES list. Nothing else.
4. Test against Done-When checklist
5. Follow After Completion steps

**Rules:**
- Never modify files outside the task's scope
- Never add features not in the spec
- If something feels wrong, stop and ask Gav
- If blocked after 3 attempts, stop and report

---

## Handling Feature Changes

Gav gives instructions in plain language. The AI interprets and executes:

### Small Change (wording, colors, spacing)
1. Update the relevant spec file directly
2. Add a line to CHANGELOG.md
3. If a task file references the changed value, update it too

### Medium Change (new component, altered flow)
1. Update the relevant spec file
2. Update or create affected task files
3. Add entry to CHANGELOG.md
4. If it changes a decision, update DECISIONS.md

### Large Change (new route, architectural shift)
1. Discuss with Gav first — confirm scope
2. Update specs, create new task files
3. Add entry to CHANGELOG.md
4. Record decision in DECISIONS.md
5. Update README.md file map and route status

### Change Checklist
For any change, ask:
- [ ] Which spec files are affected?
- [ ] Which task files need updating?
- [ ] Does this change a recorded decision?
- [ ] Does the README.md status table need updating?
- [ ] Does CHANGELOG.md need an entry? (yes, always)

---

## Task Lifecycle

```
tasks/active/NN-name.md  →  [execute]  →  tasks/done/NN-name.md
```

- **active/** = not started or in progress
- **done/** = completed and verified
- Tasks execute in numerical order unless Gav says otherwise
- Never skip a task — each builds on the previous

---

## "Save it all" — What This Means

When Gav says **"save it all"**, execute this checklist in full:

- [ ] `CHANGELOG.md` — add entry for what was built
- [ ] `STATUS.md` — move task to Recently Completed, clear Active Task
- [ ] `features.md` — update affected route's feature list
- [ ] `reference/api.md` — add/update any new or changed endpoints
- [ ] `tasks/active/` → `tasks/done/` — move the completed task file
- [ ] `SESSION.md` — delete when done

---

## File Ownership

| File | Who updates it |
|------|---------------|
| `STATUS.md` | AI (after each task completion) |
| `CHANGELOG.md` | AI (after every change) |
| `features.md` | AI (after every task — "save it all") |
| `DECISIONS.md` | AI (when architectural decisions made) |
| `reference/*.md` | AI (when infra/API changes) |
| `tasks/active/*.md` | AI (created upfront, updated if spec changes) |
| `tasks/done/*.md` | AI (moved from active on completion) |
| `archive/*.md` | AI (created once, rarely updated) |

Gav never edits files directly. He gives instructions. The AI does all file operations.

---

## Emergency: Context Lost Mid-Task

If compaction occurs during task execution:

1. Re-read the active task file — it has everything
2. Check what's already been built (ls, test, etc.)
3. Continue from where you left off
4. Do NOT restart from scratch unless the work is corrupted

---

## Emergency: Task Won't Complete

If stuck after 3 genuine attempts:

1. Document exactly what was tried
2. Document the error/blocker
3. Save partial work (don't delete it)
4. Report to Gav with:
   - What the task was
   - What was tried (3 attempts)
   - What the error/blocker is
   - Suggested next step
5. Do NOT keep looping. Stop.
