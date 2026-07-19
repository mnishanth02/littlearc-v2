---
name: find-project-context
description: Locate the smallest relevant set of LittleArc documents, source files, tests, decisions, and validation commands for a task before implementation or investigation.
---

# Find Project Context

1. Read `AGENTS.md`.
2. Read `docs/IMPLEMENTATION_STATUS.md` and `docs/index.md`.
3. Extract the main feature, module, work-package ID, and technical keywords
   from the task.
4. Run `./scripts/context/find-context.sh "<task keywords>"`.
5. Read the nearest module-level `AGENTS.md` for any affected path.
6. Select only the relevant docs, source files, tests, and validation commands.
7. Expand with `rg` only when the selected context is insufficient.
8. Report the context sources selected before proposing or making changes.
9. Do not load the complete `docs/` directory by default.
