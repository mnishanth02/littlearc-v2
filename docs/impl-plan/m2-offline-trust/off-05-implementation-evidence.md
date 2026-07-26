# OFF-05 Implementation Evidence

> **Status:** Accepted
> **Last updated:** 22 July 2026
> **Owner:** Engineering
> **Work package:** `OFF-05`
> **Plan:** [OFF-05 Emergency-Card Vertical Slice](./off-05-emergency-card-vertical-slice-plan.md)
> **Decision:** [ADR-0013](../../adr/0013-emergency-card-aggregate-and-standard-access-boundary.md)

---

## 1. Implemented Outcome

LittleArc now has a complete synthetic-only emergency-card vertical slice. An
authorized household member can create and edit a card with explicit confirmed
and absence states, synchronize it through the shared offline protocol, reopen
the encrypted local copy without a network after process restart, hand a
confirmed contact to the platform dialer, retain both sides of a stale critical
conflict, and wipe the local card through the accepted security boundary.

The implementation is deliberately standard access. It does not add a locked
quick-access surface, weaker key, plaintext cache, share artifact, physical-iOS
claim, or two-physical-device claim. Those boundaries remain gated.

## 2. Implemented Boundary

- Domain and Zod contracts define blood group, allergies, critical notes,
  urgent medication, guardian contacts, pediatrician, preferred name, and date
  of birth with structural `notProvided`, applicable `noneConfirmed`, and
  confirmed states.
- PostgreSQL stores one active `emergency_cards` aggregate per child and
  append-only `emergency_card_versions`. The current pointer and version append
  move atomically under same-household foreign keys, RLS, capability checks,
  least-privilege grants, and an immutability trigger.
- Every complete version is an AES-256-GCM household envelope. Audit, change,
  outbox, and idempotency evidence contains only stable identifiers, revisions,
  action codes, and minimized metadata.
- Authenticated `GET` and `PUT` resource routes use the same persistence
  behavior as the OFF-04 mutation path. The request cannot select its tenant,
  actor, role, capabilities, revision result, audit identity, or sequence.
- The shared pull/snapshot/push protocol now transports child and emergency-
  card entities through typed upserts, tombstones, stable snapshot order,
  idempotency, and explicit critical conflicts.
- SQLCipher schema V3 stores the local card, authoritative server payload,
  version/revision, sync state, queued mutation, and review artifact. Optimistic
  card writes and mutations commit together.
- The production Expo route renders SQLCipher first, distinguishes offline,
  unavailable, pending, conflict, and error states, exposes important values as
  selectable text, and opens deliberate guardian/pediatrician dialer intents.
- A development-only route and disposable PostgreSQL server path exercise the
  complete fixed-synthetic lifecycle without weakening production authority.

## 3. Review and Defect Closure

Plan review resolved the open aggregate decision in favor of dedicated
immutable versions and preserved `OD-03` instead of inventing quick-access key
or exposure policy. ADR-0013 records that boundary.

Implementation and device validation found and closed three issues:

1. The production card's `Try again` action changed visual state but did not
   start another encrypted read. It now calls a shared guarded reload function;
   the post-wipe device check reran the read and returned the expected
   not-enrolled error.
2. The development proof could resume the required offline version-1 stage but
   not a retained revision-2 conflict after a later accessibility restart. It
   now detects either durable state, preserves the offline network assertion
   for version 1, and resumes immutable evidence/wipe for revision 2.
3. Expo Doctor reported ten SDK 57 patch mismatches. Expo's installer aligned
   the exact pins, lockfile, supply-chain release-age allowlist, and the dynamic
   config's `expo-web-browser` plugin. Doctor then passed all 20 checks and the
   Android/iOS exports were rerun.

## 4. PostgreSQL Integration Evidence

`pnpm test:database:emergency-card` created a fresh disposable Aiven database,
applied all four reviewed migrations, ran under `littlearc_app`, and retained
OFF-02 through OFF-04 regression coverage. OFF-05 proved:

1. encrypted first create and immutable second version;
2. exact replay without duplicate aggregate/version/audit/change/outbox state;
3. changed idempotency replay rejection;
4. stale critical conflict without an accepted third version;
5. cross-household isolation and capability-derived authorization;
6. append-only/least-privilege version enforcement; and
7. absence of seeded preferred-name, birth-date, clinical-note, medicine, and
   contact canaries from plaintext PostgreSQL and minimized evidence.

The harness dropped its temporary database after the passing run.

## 5. Validation Results

All repository commands use Node.js 24.18.0 and pnpm 11.14.0.

| Validation | Result |
| --- | --- |
| Focused domain, contract, database, API, and mobile tests | Passed; 23 domain, 13 contract, 24 database, 19 API, and 17 mobile tests cover the new invariants and retained behavior. |
| `pnpm test:database:emergency-card` | Passed; OFF-02/OFF-03/OFF-04 regressions plus encrypted versions, replay, stale conflict, isolation, minimized evidence, and plaintext canaries passed on Aiven PostgreSQL. |
| Physical Android emergency-card lifecycle | Passed on Pixel 8, Android 17/API 37, through native SQLCipher, HTTP, disposable Aiven PostgreSQL, Android dialer, accessibility services, conflict, and wipe. |
| `pnpm check:generated` twice | Passed; generated OpenAPI document, JSON, types, Better Auth adaptation, and four migration artifacts are idempotent and drift-free. |
| `pnpm test` | Passed; 164 tooling, unit, and contract tests across the workspace. |
| `pnpm build` | Passed after the SDK patch alignment; package/server/staff builds and Android/iOS Hermes exports completed. |
| `pnpm --filter @littlearc/mobile run doctor` | Passed all 20 Expo project checks after aligning the SDK 57 patch set. |
| `pnpm validate` | Passed; toolchain, workspace, supply chain, generated output, formatting, documentation, and 13-package typechecks passed. |
| `git diff --check` | Passed. |
| `./tooling/validate-clean-checkout.sh` | Passed from a source-only snapshot with frozen install and uncached workspace validation. |

## 6. Physical Android Evidence

The connected Pixel 8 reported Android 17/API 37. The development-only route
completed this fixed synthetic sequence:

1. wiped earlier local security, enrolled SQLCipher schema V3, and synchronized
   the child snapshot;
2. committed the explicit-state emergency card and ordered create mutation in
   one local transaction;
3. pushed encrypted version 1 and pulled the authoritative projection;
4. opened the production card and observed blood group `O+`, `none confirmed`
   allergy/urgent-medication states, one confirmed critical note, guardian and
   pediatrician actions, version 1, and the standard-access notice;
5. disabled Wi-Fi and mobile data, confirmed the device could not reach the
   network, force-stopped/relaunched LittleArc, and resumed the retained card
   from SQLCipher at version 1;
6. opened Android's dialer with the synthetic guardian number and placed no
   call;
7. restored connectivity, simulated a server writer at revision 2, queued a
   stale local proposal, and observed `Revision 2 authoritative · 1 local
   proposal needs review`;
8. verified exactly two immutable versions and two audit/change/outbox records
   with no duplicate;
9. rendered the full production card at 200% font scale with Android high
   contrast enabled, scrolled from the first fact through both contact actions,
   conflict warning, freshness/access labels, and edit action without clipping;
10. bound TalkBack with touch exploration enabled and inspected the ordered
    native semantic labels, warning text, dialer actions, and edit action;
11. restored the device accessibility settings, resumed the durable conflict,
    explicitly discarded it, and verified the security wipe; and
12. reopened the production route after wipe and observed `This installation
    is not enrolled`, proving the card was inaccessible.

UIAutomator observed the final `OFF-05 physical Android validation passed`
semantic state. Screenshots for the online card, offline resume, dialer, 200%
top/bottom states, and completion were visually reviewed during the run. A
bounded current-process logcat scan found no fatal Android runtime or seeded
preferred-name, clinical-note, contact-name, or phone-number matches.

The remote writer was server-side synthetic control, not a claim that two
physical devices were tested.

## 7. Evidence Boundaries

The run used fixed synthetic content, synthetic sessions, and disposable
database state. It does not claim:

- real parent, child, participant, contact, medical, file, or consent data;
- a live identity/email/social provider, production credentials, or signed
  store distribution;
- locked OS quick access, a separate emergency key, screenshot/recents policy,
  or a shareable card artifact;
- physical iOS, a second physical device, low-end Android, actual biometric-set
  mutation, or the complete pre-pilot matrix;
- specialist approval of clinical terms, privacy/legal policy, retention,
  deletion, backup, or incident handling; or
- Gate 2 closure. At OFF-05 acceptance, OFF-06 and both-platform onboarding
  were still open. OFF-06 later added bounded physical-Android plus
  iOS-Simulator onboarding coverage; real two-device conflict and the
  remaining unproven gate criteria stay open.

## 8. Completion Decision

**Decision: COMPLETE.** OFF-05 meets its standard-access synthetic boundary
through a dedicated encrypted aggregate, immutable version history, shared
synchronization, SQLCipher V3, accessible production UI, Aiven integration,
all repository gates, and the bounded Pixel 8 lifecycle. `OD-03`, OFF-06, and
the wider Gate 2/pre-pilot obligations remain unchanged.

## iOS Simulator Parity Follow-Up — 23 July 2026

The production custom development client passed create/sync, the production
emergency route, a controlled API outage, real process termination/relaunch,
API-offline SQLCipher version 1, stale conflict, two immutable versions,
minimized server evidence, discard, and wipe. iOS emitted the expected
Simulator warning that no Phone app is available for the `tel:` URL; a real
dialer handoff and radio-off test remain physical-iPhone evidence. See the
[cross-milestone parity dossier](../ios-simulator-parity-validation-evidence.md).
