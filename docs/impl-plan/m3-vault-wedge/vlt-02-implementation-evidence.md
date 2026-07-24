# VLT-02 Implementation Evidence

> **Status:** Complete
> **Evidence date:** 2026-07-24
> **Last updated:** 2026-07-24
> **Owner:** Engineering
> **Milestone:** M3
> **Plan:** [VLT-02 plan](./vlt-02-manual-record-creation-plan.md)
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)

---

## Outcome

VLT-02 manual record creation is implemented for document, vaccination,
doctor-visit, and prescription records. An enrolled parent can use production
mobile routes to save an encrypted local draft, confirm it locally and
synchronize it, inspect its current content and status, append an immutable
correction, inspect cached history, and delete it through the accepted
tombstone flow.

Automated tests, disposable Aiven PostgreSQL integration, Android and iOS
release exports, a complete iPhone 17 Pro Simulator lifecycle, and a complete
physical Pixel 8 lifecycle passed. Both runtime lifecycles crossed an actual
process termination/relaunch while the API remained unavailable and recovered
the encrypted SQLCipher V5 draft before synchronization.

This evidence does not close Gate 2, authorize `VLT-03` or later M3 packages,
establish physical-iOS or two-physical-device evidence, approve real data, or
prove low-end Android, live provider, pilot, or complete
assistive-technology coverage.

## Implemented Boundary

- Four reviewed `RecordVersionContentV1` category payloads:
  `document.v1`, `vaccination.v1`, `doctor_visit.v1`, and
  `prescription.v1`.
- Explicit optional-value states, strict calendar-date handling,
  category/detail agreement, parent-entered vaccination date meaning, and
  literal prescription instructions without schedule generation or medical
  inference.
- Generated OpenAPI contract coverage for all four payloads and device local
  schema version 5.
- SQLCipher V5 `local_record_drafts` storage with child/category/target
  metadata and bounded form JSON. Drafts remain local-only and do not create
  provenance, versions, Timeline rows, mutations, or server writes.
- Atomic draft confirmation through the accepted ordered mutation repository:
  the optimistic record and generated Timeline projection are written and the
  source draft is removed in one transaction.
- Production record routes for the local management list, creation, detail,
  correction, history, textual synchronization state, retry, discard, and
  deletion.
- Reuse of VLT-01 record persistence, immutable history, generated Timeline,
  synchronization, conflict, tombstone, and purge-request boundaries.
- Development-only synthetic device orchestration that drives the production
  editor/detail components. Production Metro exports substitute safe redirect
  modules for every OFF/VLT validation route.

No production dependency was added.

## Automated Evidence

The following commands passed with Node.js 24.18.0 and pnpm 11.14.0:

```sh
pnpm --filter @littlearc/domain test
pnpm --filter @littlearc/contracts test:contract
pnpm --filter @littlearc/database test
pnpm --filter @littlearc/api test
pnpm --filter @littlearc/mobile test
pnpm test
pnpm check:generated
pnpm test:database:record
pnpm --filter @littlearc/mobile build
pnpm validate
pnpm build
pnpm --filter @littlearc/mobile run doctor
pnpm test:database:rls
./tooling/validate-clean-checkout.sh
git diff --check
```

Focused counts were:

| Surface | Result |
| --- | --- |
| Domain | 31 tests passed, including 8 record/category tests |
| Contracts | 15 tests passed |
| Database unit/schema/migration | 27 tests passed |
| API | 20 tests passed |
| Mobile SQLCipher/repository/form/presentation | 33 tests passed |
| Root unit matrix | 191 tests passed |
| Root contract matrix | 15 tests passed |
| Root total | 206 tests passed |

`pnpm validate` passed the exact toolchain check, 43 tooling tests, workspace
boundaries, semantic design policy, environment and Railway skeleton checks,
workflow policy, generated OpenAPI/migration drift, supply-chain policy,
formatting, documentation governance, and all 18 typecheck tasks.

The source-only clean-checkout install and validation passed. Expo Doctor
passed all checks.

## Disposable Aiven PostgreSQL Evidence

`pnpm test:database:record` passed against a fresh disposable TLS-protected
Aiven database and removed the fixture afterward.

The VLT-02 extension proved:

- encrypted create and correction for document, vaccination, doctor-visit,
  and prescription payloads;
- manual provenance and category/detail agreement;
- immutable correction history and generated Timeline replacement;
- logical delete through the accepted record tombstone and purge-request
  boundary;
- household authorization inherited from the VLT-01 RLS/BOLA foundation; and
- absence of seeded form/content plaintext from encrypted persistence and
  minimized operational evidence.

The same consolidated integration run also passed the existing OFF-02,
OFF-03, OFF-04, OFF-05, and VLT-01 scenarios. The independent disposable
PostgreSQL RLS suite passed as `littlearc_app`.

This is local Aiven synthetic evidence, not Railway staging/production or
real-data evidence.

## Release-Containment Evidence

The first Android export correctly failed closed because Metro had hidden
development validation routes from navigation but still bundled their
modules. The scan identified the synthetic session header, validation endpoint
path, and VLT-02 prescription canary.

The resolver was corrected so production exports substitute one redirect-only
module for all development OFF/VLT validation route modules. Subsequent
Android and iOS Hermes exports passed their bundle scans:

| Platform | Export result | Containment result |
| --- | --- | --- |
| Android | Passed | 29 files inspected; no validation canary found |
| iOS | Passed | 25 files inspected; no validation canary found |

This failed-first result is retained because it demonstrates that the release
guard detected and prevented a real validation-content leak.

## iOS Simulator Evidence

| Fact | Observed value |
| --- | --- |
| Device | iPhone 17 Pro Simulator |
| Runtime | iOS 26.5 |
| UDID | `7C8183EE-08E8-4F3D-A064-D3C404A10CC9` |
| App | LittleArc development client |
| Local schema | SQLCipher V5 |
| API/database | Local synthetic HTTP harness backed by disposable Aiven PostgreSQL |

The Simulator completed:

1. a clean local-security wipe, synthetic owner/child bootstrap, enrollment,
   and keyed SQLCipher V5 reopen;
2. encrypted save of a partially completed prescription draft;
3. authenticated API transition to unavailable;
4. actual `simctl terminate`, development-client relaunch, and encrypted draft
   recovery while the API independently remained unavailable;
5. restoration of connectivity and exactly one confirmed prescription;
6. confirmed document, vaccination, and doctor-visit records through the same
   production form mapping and repository path;
7. synchronization of all four categories;
8. a full-record correction to immutable version 2 and two-version cached
   history;
9. logical deletion, synchronization, and local tombstone removal; and
10. the final textual result
    `VLT-02 validation passed · four categories · draft/restart ·
    correction/history · delete`.

An earlier Simulator attempt exposed that the synthetic prescription fixture
omitted its required medicine and written-schedule values. The form correctly
rejected it; the fixture was repaired and the complete lifecycle was rerun to
passing.

## Physical Android Evidence

| Fact | Observed value |
| --- | --- |
| Device | Google Pixel 8 (`shiba`) |
| Serial | `3A110DLJH000U7` |
| Android | Android 17, API 37 |
| Build | `CP2A.260705.006` |
| Security patch | 2026-07-05 |
| Connection | Physical USB ADB |
| App | LittleArc development client `0.0.1` |
| Local schema | SQLCipher V5 |

The physical device completed:

1. a clean local-security wipe, synthetic owner/child bootstrap, enrollment,
   biometric protection, and keyed SQLCipher V5 reopen;
2. encrypted save of the partially completed prescription draft;
3. authenticated API transition to unavailable;
4. actual application force-stop, cold development-client relaunch, biometric
   face confirmation, and encrypted draft recovery while the API remained
   unavailable;
5. restoration of connectivity and exactly one confirmed prescription;
6. confirmed document, vaccination, and doctor-visit records;
7. synchronization of all four categories;
8. a correction to immutable version 2 and two-version cached history;
9. logical deletion, synchronization, and local tombstone removal; and
10. the same final textual VLT-02 passing result as the Simulator.

The app rendered the passing route in dark appearance with a scrollable narrow
layout. Android's native semantic tree exposed the screen title, boundary
warning, completion heading, and textual evidence. Current LittleArc-process
log inspection found no seeded prescription, medicine, or correction values
and no LittleArc fatal or exception match. Device-wide fatal lines observed in
the broad log belonged to the unrelated `com.infrasoft.uboi` process and were
excluded by package-specific inspection.

USB reverse rules added for API port 3001 and Metro port 8082 were removed
after validation.

## Functional And Safety Acceptance

| Acceptance area | Result |
| --- | --- |
| Four manual category schemas and form mappings | Passed |
| Required/invalid date and vaccination-meaning rejection | Passed in domain/form tests |
| Encrypted draft without record/version/Timeline/server authority | Passed |
| Actual offline process restart and draft recovery | Passed on both requested targets |
| Atomic local confirmation and ordered synchronization | Passed |
| Manual provenance and textual status/date meaning | Passed |
| Immutable correction and two-version history | Passed |
| Logical delete and tombstone synchronization | Passed |
| Plaintext persistence/log canaries | Passed |
| Android/iOS production export containment | Passed after failed-first correction |
| Physical Android complete flow | Passed |
| iOS Simulator complete flow | Passed |

The package uses the accepted semantic components, native accessibility roles,
textual non-color states, scrolling layouts, and existing dark/high-contrast
theme boundary. A separate 200% text plus end-to-end TalkBack/VoiceOver
walkthrough was not performed for the new VLT-02 screens because it would
change the attached physical device's user settings and full
assistive-technology coverage remains a named Gate 2 obligation. This does not
change the functional device results above and is not claimed as passing
accessibility-matrix evidence.

## Documentation And Decision Review

- The reviewed plan, M3 index, repository index/context map, delivery
  dashboard, and roadmap are aligned to this evidence.
- ADR-0014's early review trigger was exercised because VLT-02 added the
  second and later category payloads. Its generic aggregate, immutable
  version, manual provenance, generated Timeline, synchronization, and delete
  decisions remain valid.
- No core source document was rewritten: the implementation follows the
  existing product, architecture, backend-data-model, and mobile-flow
  requirements without changing their approved scope.

## Residual Limits And Manual Follow-Up

No manual action remains to make the requested VLT-02 functional flow pass.
The physical Pixel 8 biometric confirmation occurred during the run.

The following broader work remains deliberately outside this package:

- a 200% text and full TalkBack/VoiceOver walkthrough for VLT-02, which requires
  approval to change physical-device accessibility settings and human
  qualitative review;
- physical iOS/Secure Enclave evidence;
- a second physical device and two-device conflict exercise;
- target low-end Android and the complete Gate 2 accessibility matrix;
- real-provider, real-data, signed-distribution, specialist, and pilot gates;
  and
- separate founder direction or Gate 2 closure before `VLT-03+`.
