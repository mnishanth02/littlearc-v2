# M2 Offline Trust Slice

> **Status:** Active planning index
> **Last updated:** 2026-07-23
> **Owner:** Engineering

M2 delivers secure enrollment and an offline emergency-card walking skeleton.
Work-package state remains in
[IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md); this folder keeps
stable plans and their validation evidence.

## Plans

- [`OFF-01` Consumer authentication and session lifecycle](./off-01-consumer-authentication-and-session-lifecycle-plan.md)
- [`OFF-01` implementation evidence](./off-01-implementation-evidence.md)
- [`OFF-02` Household, parent, child, consent, and audit](./off-02-household-parent-child-consent-and-audit-plan.md)
- [`OFF-02` implementation evidence](./off-02-implementation-evidence.md)
- [`OFF-03` Local security and enrollment](./off-03-local-security-and-enrollment-plan.md)
- [`OFF-03` implementation evidence](./off-03-implementation-evidence.md)
- [`OFF-04` Repository and synchronization engine](./off-04-repository-and-synchronization-engine-plan.md)
- [`OFF-04` implementation evidence](./off-04-implementation-evidence.md)
- [`OFF-05` Emergency-card vertical slice](./off-05-emergency-card-vertical-slice-plan.md)
- [`OFF-05` implementation evidence](./off-05-implementation-evidence.md)
- [`OFF-06` Onboarding activation shell](./off-06-onboarding-activation-shell-plan.md)
- [`OFF-06` implementation evidence](./off-06-implementation-evidence.md)
- [Cross-milestone iOS Simulator parity evidence](../ios-simulator-parity-validation-evidence.md)

`OFF-01` and `OFF-02` are planned together because identity IDs, household
membership, role language, consent, and child-creation gates cross their
boundary. Their implementations remain independently reviewable: `OFF-01`
must not create household or child records, and `OFF-02` must consume the
accepted identity/session boundary instead of reimplementing authentication.

`OFF-03` consumes both boundaries to protect the device-local read model. It
does not implement OFF-04 synchronization or OFF-05 emergency-card content.

`OFF-04` is complete. It consumes the unlocked SQLCipher boundary and existing
server change, idempotency, audit, and outbox primitives. Its first production
aggregate is the synthetic-only child profile.

`OFF-05` is complete. It extends that repository/synchronization boundary with
a dedicated encrypted emergency-card aggregate, immutable versions, SQLCipher
schema V3, and a standard post-unlock UI. Its Aiven, repository, accessibility,
and bounded Pixel 8 evidence pass. OS-level locked quick access remains gated by
the unresolved product, security, and privacy decision `OD-03`; Gate 2 remains
open for two-device conflict, the complete assistive-technology/low-end matrix,
and its other unproven named criteria.

`OFF-06` is complete. It composes the accepted authentication, atomic
owner/child/consent creation, local enrollment, synchronization, and emergency-
card paths into one activation shell. Its first-record step remains an
explicitly synthetic, non-persisted M3 preview. Its comprehensive repository,
Aiven, Android/iOS export, bounded Pixel 8 activation/restart/offline, and iOS
Simulator activation/simulated-Face-ID/failure/accessibility/restart/offline
evidence pass. The simulator follow-up contributes both-platform
development-client coverage but is not physical-iOS or Secure Enclave
evidence. Package completion does not close Gate 2.
