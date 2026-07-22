# OFF-05 Emergency-Card Vertical Slice

> **Status:** Complete
> **Started date:** 22 July 2026
> **Last updated:** 22 July 2026
> **Owner:** Engineering
> **Milestone:** M2
> **Work package:** `OFF-05`
> **Depends on:** Accepted Gate 1 and completed `OFF-01` through `OFF-04`
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Inputs:** [roadmap](../roadmap.md),
> [product plan](../../core/littlearc-complete-product-plan.md),
> [architecture](../../core/littlearc-architecture-and-tech-stack.md),
> [data model](../../core/backend-data-model-and-database-schema.md),
> [mobile flow](../../core/mobile-application-flow.md),
> [design system](../../core/design-system.md),
> [local-security decision](../../adr/0011-local-key-custody-app-lock-and-device-enrollment.md),
> [synchronization decision](../../adr/0012-server-authoritative-synchronization-and-conflict-boundary.md),
> and [OFF-04 boundary](./off-04-repository-and-synchronization-engine-plan.md)

---

## Outcome

An authorized household member can create, edit, synchronize, and read one
confirmed emergency card for the active synthetic child. The card opens from
the encrypted SQLCipher read model in one deliberate post-unlock action, stays
usable without a network after process restart, preserves explicit clinical
unknown states and immutable server version history, and provides deliberate
phone/contact actions without exposing emergency content to logs or analytics.

## Scope

- Add a dedicated household- and child-scoped emergency-card aggregate with one
  active card per child and immutable encrypted versions.
- Represent blood group, allergies, critical notes, urgent medication,
  guardian contacts, and pediatrician contact with explicit confirmed,
  `not provided`, and applicable `none confirmed` states. Never infer absence
  from blank input.
- Add authenticated, capability-checked emergency-card read and write routes.
  The server derives household, actor, role, and authorization from the
  session and active membership; request identifiers never grant authority.
- Extend the accepted OFF-04 change feed, snapshot, mutation, idempotency,
  conflict, and audit boundaries to emergency-card projections and edits.
- Add SQLCipher schema V3 plus emergency-card repository APIs for atomic local
  edits, queued mutations, confirmed server projections, stale conflicts,
  freshness, and process-restart persistence.
- Add production Expo Router emergency-card read and edit screens using the
  accepted semantic tokens and native accessibility semantics.
- Keep the card reachable from the unlocked application landing route in one
  deliberate action. Render important values as selectable text and expose
  phone numbers through deliberate dialer actions, not automatic calls.
- Preserve the last confirmed local card when refresh fails. Show offline,
  stale, pending, conflict, unavailable, and field-absence states distinctly.
- Add a development-only synthetic Android acceptance route and disposable
  Aiven PostgreSQL harness for the complete standard-access lifecycle.

## Out of Scope

- OS-level locked quick access. `OD-03` still requires product, security, and
  privacy approval of the OS entry point, limited-field exposure warning,
  screenshot posture, reauthentication timeout, and key-separation model.
  OFF-05 ships `standard` access only and does not create a second weaker key,
  plaintext cache, notification payload, widget, shortcut, or custom PIN.
- Shareable image/PDF or exported wallet card. The roadmap explicitly defers
  this unless promoted into committed MVP scope.
- Emergency-card photo, identity documents, attachments, suggestions, AI
  output, timeline, or selected health-record access.
- Actual calls, SMS delivery, contact-book mutation, or medical advice. The app
  opens the platform dialer with the confirmed number and leaves placement to
  the user.
- Real parent, child, participant, contact, or medical data; live providers;
  production credentials; signed-store distribution; or pilot claims.
- OFF-06 onboarding activation shell, multi-child navigation, physical iOS,
  two physical devices, actual biometric-set mutation, and the complete
  pre-pilot device/assistive-technology matrix.
- Gate 2 closure. This package supplies the emergency-card portion of Gate 2;
  remaining cross-platform onboarding, two-device conflict, and broader gate
  evidence retain their current owners.

## Dependencies and Constraints

- OFF-01 provides the authenticated identity and recent-reauthentication
  boundary; the device harness may inject only its named synthetic identity.
- OFF-02 provides the active household, member capability rows, encrypted child
  profile, child ownership, consent, RLS, audit, and envelope-encryption
  foundations.
- OFF-03 provides enrolled-device key custody, biometric app unlock, SQLCipher,
  invalidation recovery, encrypted files, and verified sign-out wipe.
- OFF-04 provides signed cursors, snapshots, ordered local mutations,
  idempotency, reset-safe SQLCipher reconciliation, critical conflicts, and
  TanStack Query coordination. OFF-05 extends these abstractions rather than
  adding a parallel synchronization channel.
- The server remains authoritative after synchronization. PostgreSQL stores
  only encrypted emergency payloads; change, audit, outbox, idempotency, log,
  and analytics records contain minimized non-clinical metadata only.
- `viewEmergencyCard` authorizes card reads for a caregiver. Emergency-card
  edits require owner role or both `viewEmergencyCard` and
  `editConfirmedRecords`; no device identifier or local row grants authority.
- Only synthetic fixtures are permitted until every named pre-real-data gate
  passes.

## Reviewed Decisions

1. **Dedicated aggregate and immutable versions.** Implement
   `emergency_cards` plus `emergency_card_versions`, following the data-model
   recommendation rather than embedding emergency content in child profiles or
   the future generic record aggregate. The active row holds current-version
   and revision state; every accepted edit appends one encrypted immutable
   version.
2. **Standard access now; quick access gated.** Preserve ADR-0011 key custody
   and require the already unlocked SQLCipher capability. Do not silently make
   the privacy/security decision represented by `OD-03`.
3. **Confirmed state is structural.** Persist discriminated field states in
   the encrypted payload. Blood group supports `notProvided` or `confirmed`;
   allergies, critical notes, and urgent medication support `notProvided`,
   `noneConfirmed`, or `confirmed`; pediatrician supports `notProvided` or a
   confirmed contact. At least one confirmed guardian contact is required.
4. **Snapshot child identity with the version.** Store preferred name and date
   of birth in each encrypted emergency version so a locally confirmed card is
   internally consistent during an outage. A later child-profile change does
   not silently rewrite an accepted emergency version.
5. **No silent conflict merge.** Treat the complete confirmed emergency card as
   critical. A stale mutation preserves both the local proposal and current
   authoritative projection for explicit review; field-level automatic merging
   is not permitted.
6. **Resource route plus shared sync.** `GET` reads the current authorized card
   and `PUT` creates or replaces a version with an idempotency key and base
   revision. Offline edits use the same persistence command through the OFF-04
   mutation batch and arrive through the shared change feed/snapshot.
7. **Privacy-safe observability.** The only allowed product event is a coarse
   emergency-card screen/action outcome with no child, card, contact, clinical,
   record, exact-date, or free-text values. Seeded canaries must remain absent
   from logs, analytics, audit metadata, change metadata, outbox metadata, and
   plaintext PostgreSQL inspection.

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Plan and design/security review | Completed | Source traceability, quick-access gate, field semantics, aggregate ownership, evidence boundary, documentation validation, and diff review passed. |
| Domain and contracts | Completed | Explicit emergency state/value rules, capability policy, resource routes, and typed shared-sync entities pass focused and root tests. |
| PostgreSQL and API | Completed | Migration `0004`, dedicated immutable versions, RLS/capabilities, encrypted persistence, routes, and minimized evidence pass Aiven integration. |
| SQLCipher repository and sync | Completed | Schema V3, atomic optimistic edits, shared queue/pull/snapshot/reset dispatch, authoritative projections, and stale conflicts pass. |
| Mobile emergency-card experience | Completed | Standard read/edit routes, one-action landing entry, explicit states, contact actions, offline/freshness/conflict states, and retry recovery pass. |
| Automated and physical validation | Completed | 164 tests, Aiven, generated drift twice, builds/exports, Doctor, validation, clean checkout, and the bounded Pixel 8 lifecycle pass. |

## Implementation Plan

1. Finalize this plan through source traceability, security/privacy review,
   documentation validation, and diff review. Mark OFF-05 `IN PROGRESS` only
   after the plan is accepted.
2. Record the dedicated aggregate, immutable version, standard-access, quick-
   access gate, capability, encryption, and conflict decisions in an ADR.
3. Add domain and contract schemas. Validate field-state/value invariants,
   bounded strings/lists, E.164-compatible phone values, UUIDv7 identifiers,
   revision semantics, and the emergency-card entity variants in pull,
   snapshot, mutation, and conflict responses.
4. Add Drizzle tables and reviewed migration `0004`. Enforce one active card
   per child, same-household composite foreign keys, immutable versions,
   current-version integrity, positive monotonically increasing versions,
   active membership/capability policy, RLS, least-privilege grants, and
   encrypted-envelope shape checks.
5. Implement one shared emergency-card persistence command used by the
   resource route and sync mutation path. Resolve tenant/actor from the
   session, validate child scope and capability, reserve idempotency, compare
   base revision, encrypt a new immutable version, update the active pointer,
   and atomically append audit, change, outbox, and stored result evidence.
6. Extend pull and captured-sequence snapshot projection to authorized
   emergency cards. Decrypt only the bounded requested page under tenant
   context, include typed tombstones, and preserve stable pagination across
   child and emergency-card entities.
7. Add SQLCipher schema V3 and repository codecs. Read the last confirmed card
   without network access; atomically write an optimistic card plus mutation;
   apply server pages; stage/finalize reset; and preserve pending/conflicted
   cards and authoritative versions without leaking clinical content outside
   SQLCipher.
8. Generalize the mobile synchronization coordinator to dispatch and apply
   child-profile and emergency-card mutations through the existing retry,
   dependency, idempotency, reset, and authentication behavior.
9. Build the emergency-card read and edit experience. Use semantic themes,
   scroll-safe layout, large child name/age, explicit field labels and absence
   states, selectable important values, last-updated/offline/sync labels,
   privacy-safe empty/error/conflict states, and accessible dialer actions.
   Place one Emergency action on the unlocked landing screen.
10. Add a development-only OFF-05 Android validation route and disposable
    Aiven harness. Exercise create/version, online sync, local read, airplane-
    mode process restart, dialer intent, offline optimistic edit, reconnect,
    immutable history, simulated stale conflict, authorization denial, and
    sign-out wipe with fixed synthetic values.
11. Run focused tests first, then Aiven integration, generated-output drift
    twice, root tests/build/validation, Expo Doctor, Android/iOS exports,
    clean-checkout proof, physical Android validation, accessibility/logcat
    review, and final diff/security review.
12. Create the evidence dossier and align the plan, M2 README, context index,
    dashboard, and roadmap. Mark completion only after every required OFF-05
    acceptance item has passing evidence; leave wider Gate 2 obligations
    explicitly open.

## Acceptance Criteria

- The first accepted write creates exactly one active card and one immutable
  encrypted version for the child. Every accepted later edit appends one
  version and advances the current pointer/revision atomically.
- Exact retry returns the stored result without another version, audit, change,
  outbox, or revision. Reusing the idempotency key with changed content fails
  closed. Forced evidence failure rolls the entire write back.
- PostgreSQL contains no plaintext child name, birth date, medical value,
  medicine, note, or phone canary. Encrypted versions use the accepted
  AES-256-GCM household envelope and immutable AAD.
- Household and child scope are server derived. RLS/BOLA tests hide another
  household; a caregiver without `viewEmergencyCard` cannot read; a caregiver
  without edit authority cannot mutate; a device ID grants nothing.
- Blank values cannot masquerade as a confirmed state. Allergies, critical
  notes, and urgent medication distinguish `not provided`, `none confirmed`,
  and confirmed values; blood group and pediatrician preserve their applicable
  explicit states.
- A stale base revision creates a reviewable conflict with local and
  authoritative versions and no emergency-card/version/change/outbox write.
- Pull and captured snapshot include typed emergency-card upserts/tombstones in
  deterministic order without regressing OFF-04 child behavior. Reset and
  process restart preserve nonterminal emergency edits/conflicts.
- The production emergency route renders only from an unlocked SQLCipher
  capability. It is reachable in one intentional action from the unlocked
  landing route and makes no network call before showing a cached card.
- Airplane mode plus process restart retains the complete confirmed synthetic
  card, explicit absence states, freshness/offline label, selectable values,
  and deliberate dialer actions. A refresh failure never replaces cached
  confirmed content with a skeleton or generic error.
- Dynamic type at 200%, dark/high-contrast themes, narrow width, TalkBack
  reading order/labels/hints, minimum touch targets, and safe-area scrolling do
  not clip or hide emergency facts or actions on the recorded Android device.
- Standard access requires the accepted app-unlock/key boundary. No locked
  quick-access surface, weaker key, plaintext copy, screenshot-policy claim,
  share artifact, or analytics payload is introduced.
- Sign-out makes the emergency card inaccessible under the OFF-03 wipe policy,
  with the OFF-04 explicit discard confirmation when risky work exists.

## Validation

- Domain invariant, age/display, phone-action, capability, and conflict-policy
  tests.
- Contract/OpenAPI request, response, pull, snapshot, mutation, route, UUID,
  revision, and field-state validation tests.
- Database schema/migration checksum, RLS, immutability, cardinality, current-
  version, and least-privilege tests.
- API route/service tests for read/create/edit, exact replay, changed replay,
  stale conflict, missing child/card, read/edit capability denial, and safe
  error responses.
- Aiven PostgreSQL create/version/history, encryption canaries, duplicate,
  mismatch, stale conflict, RLS/BOLA, audit/change/outbox/idempotency counts,
  and forced rollback scenarios.
- Mobile pure tests for SQLCipher V2-to-V3 migration, repository read/edit,
  generalized queue dispatch, pull/reset/tombstone/conflict preservation,
  state labels, age, dialer URL construction, and risky sign-out classification.
- Physical Pixel 8 create/sync, one-action open, airplane-mode process restart,
  offline rendering, selectable/accessibility semantics, dialer intent, offline
  edit/reconnect/version history, simulated stale conflict, and sign-out wipe.
- `pnpm check:generated` twice, `pnpm test`, `pnpm build`,
  `pnpm --filter @littlearc/mobile run doctor`, `pnpm validate`,
  `git diff --check`, `./scripts/context/validate-docs.sh`, and
  `./tooling/validate-clean-checkout.sh` under Node 24.18.0 and pnpm 11.14.0.

## Risks and Controls

| Risk | Control | Completion evidence |
| --- | --- | --- |
| Quick access weakens protected key custody | Ship standard mode only; retain `OD-03` and require a later approved key/OS/exposure design | No locked surface or second key in code/diff; plan and ADR preserve the gate. |
| Empty input is interpreted as clinical absence | Discriminated field states plus blocking validation | Domain, contract, form, and device validation cases pass. |
| Emergency values leak through operational evidence | Encrypt complete payload; minimize metadata; scan seeded canaries | PostgreSQL, logcat, logger, analytics, audit, change, and outbox scans pass. |
| Stale critical facts silently overwrite another edit | Whole-card conditional revision and explicit conflict artifact | Service, integration, local repository, and device conflict cases pass. |
| Version pointer and history diverge | Same transaction, composite FKs, immutable-version enforcement, rollback test | Migration/schema and forced-rollback evidence pass. |
| Offline refresh error removes usable facts | SQLCipher-first read and last-confirmed preservation | Network-failure and airplane-mode process-restart evidence pass. |
| Contact action triggers an unintended call | Open the dialer only after a labeled deliberate press | Pure URL/action test and physical intent inspection pass without placing a call. |
| Synthetic validation is mistaken for pilot readiness | Fixed synthetic values and explicit Pixel 8/standard-access boundary | Evidence dossier retains real-data, iOS, two-device, provider, and pre-pilot exclusions. |

## Evidence

Accepted implementation and validation evidence is recorded in the
[OFF-05 evidence dossier](./off-05-implementation-evidence.md).

## Follow-Up

- Product, security, and privacy must resolve `OD-03` before any locked quick-
  access implementation. That later work must define exposed fields, warning,
  screenshot/recents posture, OS entry point, timeout, key custody, revocation,
  and physical-device abuse cases.
- OFF-06 consumes the confirmed emergency-card setup and completion boundary in
  the onboarding activation shell.
- Gate 2 still requires both-platform onboarding, a real two-device stale
  conflict, duplicate/cursor/session/RLS evidence alignment, and its other
  named criteria before M3 breadth is authorized.
- Physical iOS, actual biometric-set mutation, signed distribution, upgrade,
  lower-memory Android, and the complete assistive-technology matrix remain
  pre-pilot obligations.
