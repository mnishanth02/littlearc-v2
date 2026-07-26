# ADR-0016: Worker File Validation And Plaintext Cleanup Boundary

> **Status:** Accepted
> **Date:** 2026-07-25
> **Owner:** Engineering
> **Review date:** 2026-10-25
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [VLT-05 plan](../impl-plan/m3-vault-wedge/vlt-05-worker-side-file-validation-plan.md),
> [ADR-0015](./0015-encrypted-file-object-and-resumable-transport-boundary.md)

---

## Context

VLT-04 leaves each completed encrypted original in `pending` validation. A
worker must temporarily decrypt synthetic staging files to validate structure
and malware status without exposing names, document content, child data,
household identifiers, object keys, or key material through queue jobs,
operational state, logs, or evidence. Parser or scanner failure must never
promote a file, and a terminal result must never outlive plaintext cleanup.

## Decision

Upload completion atomically emits a minimized outbox event containing only an
opaque file-object ID. The dispatcher creates a deterministic
`file-validation-v1` pg-boss job with bounded retries and a dead-letter queue.
Queue schema creation is a reviewed migration-time operation; the worker
runtime uses `role=littlearc_worker` for every PostgreSQL session and cannot
read validation tables directly.

A security-definer claim returns only one leased object's bounded ciphertext,
wrapped-key, declared-format, and storage facts. The worker rechecks ciphertext
size and SHA-256, performs streaming authenticated AES-256-GCM decryption, and
zeroes transient keys. Parsers receive plaintext only after authentication.

JPEG and PNG use complete bounded structure validation. PDF uses the verified
QPDF 12.3.2 artifact in a no-new-privileges process with address-space, CPU,
file-size, descriptor, process-count, and timeout limits; encrypted, malformed,
active, embedded, form/XFA, JavaScript, rich-media, over-page, and over-object
documents are rejected. HEIC/HEIF remains fail-closed with
`unsupported_format` until a separately reviewed bounded decoder proves full
image decode in the deployed worker.

Malware scanning is mandatory for `ready`. The provider-neutral adapter streams
plaintext with clamd `INSTREAM` to a private, digest-pinned Railway staging
ClamAV service. Readiness requires a minimum loaded signature serial and a
recent FreshClam observation; unavailable or stale scanning prevents intake.

Every attempt uses an opaque mode-0700 workspace. A successful or rejected
result is first proposed as nonterminal, the workspace is removed and verified
absent, and only then is the terminal state committed. Cleanup failure is
retryable. Startup and periodic scavenging recover abandoned workspaces; retry
exhaustion becomes terminal only after no attempt owns plaintext.

Preview derivation is independent and remains unauthorized:
`FILE_PREVIEWS_ENABLED=false`. The worker rejects production enablement and
permits the one-shot provider probe only in staging. Logs and API status expose
only allowlisted state, safe error codes, aggregate outcomes, and non-identifying
timestamps.

## Alternatives Considered

- Scan encrypted bytes. Rejected because malware engines require plaintext.
- Put storage or tenant facts in queue jobs. Rejected because the database
  lease can resolve minimum authority from one opaque ID.
- Commit terminal state before best-effort cleanup. Rejected because a crash
  would make residual plaintext invisible to retry reconciliation.
- Run QPDF without process limits. Rejected because file-size bounds alone do
  not contain parser CPU, memory, descriptor, or subprocess use.
- Use a public or cloud malware API. Rejected because it expands plaintext
  disclosure and processor scope.
- Treat ISO-BMFF brand parsing as successful HEIC validation. Rejected because
  a valid container does not prove bounded image decode.
- Enable preview generation with core validation. Rejected because rendering,
  derivative storage, and metadata removal require separate authorization.

## Consequences

Files become `ready` only after authenticated decryption, allowed complete
structure, conservative PDF policy, a current clean malware result, and
verified plaintext cleanup. Queue redelivery is idempotent and the database
holds explicit safe operational state without logging document identifiers.

The staging worker has bounded plaintext authority and therefore remains a
high-sensitivity service. ClamAV consumes dedicated memory and needs an
operational signature attestation refresh. Static PDF policy intentionally
rejects signed/form documents. HEIC uploads are safely rejected until the
decoder boundary is reviewed. Previews, OCR, record linkage, search, production,
real data, and Gate 2 closure remain outside this decision.

## Validation

- Unit and contract tests cover state transitions, authenticated streaming
  decrypt, format/PDF rejection, scanner framing/readiness, workspace cleanup,
  safe logging, and API status.
- Disposable Aiven validation applies migration
  `0007_vlt_05_file_validation.sql`, prepares the reviewed pg-boss schema,
  proves atomic minimized dispatch, worker least authority, cleanup-gated
  terminal state, retry exhaustion, RLS/BOLA, and plaintext-canary absence.
- Railway staging proves the private scanner, current signatures, bounded QPDF
  process, clean/detected scanner matrix, cleanup, final API/worker health, and
  preview/production containment using generated synthetic bytes only.

## Review Triggers

Review by 2026-10-25, or earlier if HEIC support or previews are proposed,
accepted PDF policy changes, file limits increase, scanner/QPDF/provider or key
custody changes, production validation is considered, or real-data approval
work begins.
