---
name: update-documentation
description: Update LittleArc documentation after behavior, architecture, configuration, APIs, data models, operating procedures, or delivery status changes.
---

# Update Documentation

1. Inspect the code, diff, or delivery-state change that triggered the doc work.
2. Use `docs/index.md`, `docs/context-map.yaml`, and
   `./scripts/context/find-context.sh` to identify affected documents.
3. Update only the affected documents.
4. Keep `docs/IMPLEMENTATION_STATUS.md` aligned with implementation-plan status
   headers and evidence links when delivery state changes.
5. Create or update ADRs only for important durable decisions.
6. Update `Last updated` metadata where the document content changes.
7. Run `./scripts/context/validate-docs.sh` and relevant formatting checks.
