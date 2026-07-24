# VLT-01 Implementation Evidence

> **Status:** Complete
> **Evidence date:** 2026-07-24
> **Last updated:** 2026-07-24
> **Owner:** Engineering
> **Milestone:** M3
> **Plan:** [VLT-01 plan](./vlt-01-record-model-versions-provenance-and-timeline-projection-plan.md)
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)

---

## Outcome

The bounded VLT-01 foundation is implemented across the domain, contracts,
PostgreSQL, API, shared synchronization, SQLCipher V4 repository, and
development-only native validation route.

Automated validation, disposable Aiven PostgreSQL validation, Android and iOS
release exports, the iPhone 17 Pro iOS Simulator lifecycle, and the physical
Pixel 8 lifecycle and accessibility checks passed.

This evidence does not close Gate 2, authorize `VLT-02`, establish physical-iOS
or two-physical-device evidence, approve real data, or prove a live
provider/government integration.

## Implemented Boundary

- One generic server-authoritative `record` aggregate with immutable
  `record_versions`, bounded encrypted content, current-version pointers, and
  provenance.
- Separate encrypted `record_suggestions`; suggested values and source spans
  cannot become record or Timeline authority without a confirmed version.
- One active encrypted generated Timeline projection per current confirmed
  record version, with prior projections retained as inactive history.
- Same-household foreign keys, forced RLS, server-derived capability checks,
  BOLA resistance, immutable-version triggers, minimized audit/change/outbox
  evidence, idempotency, stale critical conflicts, tombstones, and one queued
  purge request.
- Authorized current-record and cursor-paginated version-history API reads.
- OFF-04-compatible record and Timeline pull, snapshot, push, conflict, reset,
  and tombstone behavior.
- SQLCipher schema V4 current record, version cache, Timeline projection,
  optimistic proposal, conflict-retention, reset, and wipe behavior.
- Development-only VLT-01 native validation route. Android and iOS release
  bundle scans prove that the validation implementation is absent.
- Accepted [ADR-0014](../../adr/0014-record-aggregate-provenance-and-generated-timeline-boundary.md).

## Automated Evidence

The following commands passed with Node.js 24.18.0 and pnpm 11.14.0:

```sh
pnpm --filter @littlearc/domain test
pnpm --filter @littlearc/contracts test:contract
pnpm --filter @littlearc/database test
pnpm --filter @littlearc/api test
pnpm --filter @littlearc/mobile test
pnpm test
pnpm validate
pnpm build
pnpm --filter @littlearc/mobile build
pnpm --filter @littlearc/mobile run doctor
./tooling/validate-clean-checkout.sh
git diff --check
```

Focused counts were:

| Surface | Result |
| --- | --- |
| Domain | 29 tests passed, including 6 record lifecycle/provenance tests |
| Contracts | 14 tests passed |
| Database unit/schema/migration | 27 tests passed |
| API | 20 tests passed |
| Mobile SQLCipher/repository | 23 tests passed |
| Root unit matrix | 179 tests passed |
| Root contract matrix | 14 tests passed |
| Root total | 193 tests passed |

`pnpm validate` passed toolchain, 43 tooling tests, workspace boundaries,
semantic design policy, environment and Railway skeleton checks, workflow
policy, generated OpenAPI/migration drift, supply-chain policy, formatting,
documentation governance, and all 18 typecheck tasks.

The temporary source-only clean-checkout install and validation also passed.

Android and iOS Hermes exports completed. Both release bundle containment scans
passed and found no development VLT-01 validation implementation.

Expo Doctor passed all 20 checks. The first attempted invocation omitted
`run` and reached pnpm's own `doctor` command, which failed with
`Unknown option: 'recursive'`; the corrected project-script command above
passed.

## Disposable Aiven PostgreSQL Evidence

`pnpm test:database:record` passed against a fresh disposable TLS-protected
Aiven database and removed the fixture afterward.

The suite proved:

- encrypted create, exact replay, changed-replay rejection, correction,
  immutable history, and stale conflict;
- suggestion separation from confirmed record and Timeline authority;
- cross-household RLS/BOLA isolation and capability enforcement;
- atomic rollback, immutable-version enforcement, Timeline replacement,
  tombstone behavior, and one purge request; and
- absence of record, suggestion, source-span, and Timeline plaintext canaries
  from persisted envelopes and minimized evidence.

The pre-existing OFF-02 through OFF-05 database scenarios also passed in the
same run.

## iOS Simulator Evidence

| Fact | Observed value |
| --- | --- |
| Device | iPhone 17 Pro Simulator |
| Runtime | iOS 26.5 |
| UDID | `7C8183EE-08E8-4F3D-A064-D3C404A10CC9` |
| App | LittleArc development client |
| API/database | Local synthetic HTTP harness backed by disposable Aiven PostgreSQL |

The simulator completed:

1. protected enrollment and keyed reopen on SQLCipher 4.7.0 community schema
   V4;
2. one optimistic manual record and generated local Timeline projection;
3. encrypted synchronization of authoritative version 1;
4. process termination and relaunch while the synthetic API reported
   unavailable, followed by a successful SQLCipher-only reopen of version 1
   and its Timeline projection;
5. authoritative correction to immutable version 2, two-version local history,
   and replacement with one active Timeline projection;
6. remote authoritative version 3 followed by one preserved stale local
   critical proposal;
7. server evidence of 3 versions, 3 successful audit/record change events, 5
   Timeline change events, and 1 active Timeline projection; and
8. sign-out-equivalent removal of the SQLCipher database, WAL/SHM sidecars, and
   protected key material.

The final route displayed `VLT-01 device validation passed`.

The API-outage state was invoked through the same local synthetic validation
endpoint from the host after automated Simulator coordinate input missed the
on-screen outage button. The restart and offline read occurred while the
endpoint independently confirmed `available: false`; this is bounded
Simulator harness evidence, not a radio-off or physical-iOS claim.

An additional Simulator check rendered the route at the accessibility-large
content-size category with increased contrast and retained vertical scrolling.
Current-process log inspection found no seeded content canaries, crash, fatal,
or exception matches. VoiceOver interaction was not executed, and the broader
assistive-technology matrix remains a Gate 2 obligation.

## Physical Android Evidence

| Fact | Observed value |
| --- | --- |
| Device | Google Pixel 8 (`shiba`) |
| Android | Android 17, API 37 |
| Build | `CP2A.260705.006` |
| Security patch | 2026-07-05 |
| Verified boot | Green |
| Connection | Physical USB ADB |
| App | LittleArc development client `0.0.1`, target SDK 36 |
| TalkBack | `17.0.1.926549743` |

The physical device completed:

1. a clean local-security wipe, device enrollment, and keyed reopen on
   SQLCipher 4.7.0 community schema V4;
2. one optimistic manual-provenance record and its atomic local generated
   Timeline projection;
3. encrypted synchronization of authoritative version 1;
4. an authenticated API outage, host confirmation of `available: false`,
   process force-stop, cold relaunch, and SQLCipher-only resume of version 1
   plus its Timeline projection before reconnect;
5. authoritative correction to immutable version 2, two-version local history,
   and replacement with one active Timeline projection;
6. a server-side synthetic version 3 followed by one preserved stale local
   critical proposal;
7. server evidence of 3 versions, 3 successful audit/record changes, 5
   Timeline changes, one active Timeline projection, and revision 3;
8. sign-out-equivalent removal of the SQLCipher database, WAL/SHM sidecars,
   and protected key material;
9. a cold post-wipe reopen that returned `This installation is not enrolled`;
   and
10. the final `VLT-01 device validation passed` semantic state.

The Pixel's strong face authentication completed the Android biometric
ceremony and the system required an explicit confirmation press. No credential
was synthesized or bypassed.

At 200% font scale with Android high contrast enabled, the warning, section
heading, and both setup actions wrapped vertically, remained fully reachable,
and showed no horizontal clipping or overlap. TalkBack bound with spoken,
haptic, and audible feedback; UIAutomator inspected the ordered VLT-01
navigation title, synthetic-evidence warning, action labels, completion state,
and post-wipe error semantics.

The lifecycle and current-process logcat scans found no fatal Android runtime,
React Native exception, or fixed synthetic record-content matches. Font scale,
high contrast, TalkBack, touch-exploration grants, and the global accessibility
switch were restored to their original values. Metro and the validation API
were stopped, the disposable database was removed by the API harness cleanup,
and `pnpm dev:android:cleanup` removed the Metro/API reverse rules and reset
forced-idle and synthetic-battery state.

## Deviations And Defects Resolved

- The initial Simulator run exposed a validation-evidence query that counted
  retained inactive Timeline rows as active. Production persistence already
  used `projection_state`; the device evidence query was corrected to require
  `projection_state = 'active'`, and the clean run then reported one active
  projection.
- The native outage button was not reliably addressable through macOS
  coordinate automation. The host used the same authenticated local validation
  endpoint, and the limitation is recorded instead of being reported as an
  on-device interaction pass.
- The first resumed Android API command inherited Node.js 26.4.0 from the
  interactive shell. It was stopped before the validation database started and
  relaunched with the required Node.js 24.18.0 path.

## Remaining Boundaries

- Physical iOS, two-physical-device conflict, target low-end Android, and the
  complete assistive-technology matrix remain open Gate 2 obligations.
- The fixed native route does not separately exercise delete/tombstone/reset
  or cross-household denial after its conflict state. Those behaviors passed
  the focused repository and disposable Aiven suites; no broader physical
  device claim is made.
- No production manual record UI, capture/import, files, OCR, AI, search,
  production Timeline UI, hard purge executor, or trusted issuer adapter was
  added.
- No real child, parent, clinical, document, provider, or government data was
  used.
