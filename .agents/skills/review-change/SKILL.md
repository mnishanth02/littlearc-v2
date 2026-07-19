---
name: review-change
description: Review a LittleArc diff, commit, branch, or uncommitted change for correctness, regressions, security issues, architecture violations, and missing tests.
---

# Review Change

1. Inspect the diff before reading unrelated files.
2. Identify affected modules and run the `find-project-context` workflow for
   those paths or behaviors.
3. Prioritize functional defects, security and privacy risks, data integrity,
   reliability, compatibility, architecture violations, and missing tests.
4. Cite exact file and line references for findings.
5. Separate confirmed defects from questions and suggestions.
6. Do not modify files unless the user explicitly asks for fixes.
