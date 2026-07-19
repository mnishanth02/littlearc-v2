# Data Classification

> **Status:** Active
> **Last updated:** 2026-07-19
> **Owner:** Engineering
> **Applies to:** Source, configuration, telemetry, fixtures, and evidence
> **Decision:** [ADR-0007](../../adr/0007-privacy-safe-observability-boundary.md)

## Classification

| Class | Examples | Repository and telemetry rule |
| --- | --- | --- |
| Public | App environment label, public origins, documented log/event codes | May be committed or emitted only when intentionally public and non-identifying. |
| Sensitive | Service topology, bucket name, internal URL, operational metadata | Do not bundle into clients unnecessarily, emit to telemetry, or place in screenshots/evidence. |
| Secret | Database URL, API key, signing/session secret, credentials, key-wrapping material | Never commit, log, expose to clients, or copy into documentation; store only in the owning secret system. |
| Restricted product data | Child/parent identity, medical content, documents, consent, recognized OCR text | Prohibited from the current synthetic-only M1 environment and all logs, analytics, flags, error reports, fixtures, and evidence. |

## Handling Rules

- Use synthetic fixtures only until every named pre-real-data gate passes.
- Treat `EXPO_PUBLIC_*` and `NEXT_PUBLIC_*` as visible to end users.
- Add variable names and classification to the machine-readable catalog; keep
  secret/sensitive example values blank.
- Emit only allowlisted fields through `@littlearc/observability`. Never attach
  request bodies, headers, documents, free text, URLs with query data, or raw
  errors without approved scrubbing.
- Evidence records commands, counts, codes, versions, and outcomes—not captured
  content, credentials, service IDs, or participant data.

## Checks And Escalation

Run `pnpm check:environment`, observability tests, supply-chain checks, and root
validation. If restricted or secret data is exposed, stop distribution, preserve
only safe incident metadata, rotate affected credentials, and follow the future
incident process; do not paste the value into a ticket or ADR.
