---
name: fix-bug
description: Diagnose and fix a LittleArc defect, failing test, regression, or incorrect behavior.
---

# Fix Bug

1. Reproduce the defect or establish evidence from the failing command, error,
   log, test, or code path.
2. Run the `find-project-context` workflow for the affected behavior.
3. Determine the root cause before editing.
4. Add a failing regression test where practical and proportional.
5. Apply the smallest correct fix within existing package boundaries.
6. Check adjacent code for equivalent defects.
7. Run focused and related validation.
8. Report root cause, fix, tests, skipped validation, and any remaining risk.
