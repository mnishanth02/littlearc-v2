# LittleArc M0 Readiness and Evidence Dossier

> **Status:** M0 CLOSED — engineering scope accepted; pre-pilot obligations tracked
> **Version:** 1.2
> **Last updated:** 18 July 2026
> **Accountable owner:** Founder/product lead
> **Technical execution:** Codex
> **Source documents:** [Product plan](./littlearc-complete-product-plan.md),
> [architecture](./littlearc-architecture-and-tech-stack.md),
> [implementation roadmap](../impl-plan/roadmap.md), and
> [design system](./design-system.md)

---

## 1. Purpose and Status Model

This dossier is the authoritative decision and evidence register for M0. It does
not replace the source documents. It records which M0 conclusions are accepted,
which evidence exists, which external dependencies remain, and what work is
permitted after each gate.

M0 originally used two gates:

- **Gate 0A — Technical Readiness** permits engineering-foundation work.
- **Gate 0B — Product Readiness** collected research, physical-device, account,
  specialist-review, and pilot-readiness evidence.

On 18 July 2026, the founder changed the milestone boundary: Gate 0A closes M0;
the former Gate 0B work continues in parallel and must be complete at its named
pre-pilot or pre-real-data gate. This authorizes implementation with synthetic
data. It does not authorize production child data, public claims, store pilot
distribution, or bypassing any specialist approval.

### 1.1 M0 closure decision

**Decision: PROCEED — M0 CLOSED.** The founder accepts the technical baseline
and moves representative-parent research, five-flow validation, physical-device
acceptance, pediatric/privacy/security review, and organization-owned provider
setup into parallel pre-pilot work.

The OCR dependency blocker is resolved with a narrow override to corrected ML
Kit core 5.0.0. Clean peer, Expo, type, Android, and iOS checks pass. On the iOS
simulator, the runtime, AES-GCM, and SQLCipher probes pass; biometric APIs load
but enrolled-biometric behavior cannot be proven; and the scanner fails safely
because the simulator has no camera. Large text, dark appearance, and increased
contrast render without a fixed-height or navigation failure, with title
wrapping retained as a design-polish follow-up.

No deferred item is recorded as tested or approved. Each remains a named
pre-pilot or pre-real-data obligation with an owner and evidence trigger.

### 1.2 Decision statuses

| Status | Meaning |
| --- | --- |
| `accepted` | Approved for implementation until superseded through the source-of-truth process |
| `provisional-safe-default` | Safe default approved for planning; evidence may narrow it before product implementation |
| `blocked-external` | Engineering must not choose or bypass the required external decision or evidence |
| `accepted-deferred` | Founder removed the item from M0 closure; its named later gate still applies |
| `superseded` | Replaced by a newer decision with an explicit reference |

### 1.3 Evidence rules

- Use synthetic or properly de-identified fixtures only.
- Never place credentials, access tokens, child data, participant identifiers,
  or unredacted medical documents in repository evidence.
- Link to CI, store, device, or provider evidence when retaining the artifact in
  the repository would expose sensitive or account-bound information.
- Every compatibility result records package version, platform, OS, fixture,
  steps, expected result, observed result, disposition, owner, and date.
- A blocked result requires a resolution trigger and must never be counted as a
  pass.

---

## 2. Work-Package Dashboard

| Package | Current status | Gate | Accountable owner | Completion evidence or blocker |
| --- | --- | --- | --- | --- |
| `RDY-01` Research operations | `accepted-deferred` | Pre-pilot | Founder/product | Protocol retained; recruitment and sessions not started |
| `RDY-02` Critical-flow validation | `accepted-deferred` | Pre-pilot | Founder/product + design | Requires representative participants and testable prototypes |
| `RDY-03` Taxonomy and data map | `provisional-safe-default` | M0 draft; pre-real-data approval | Product + privacy + pediatric | Version 1 below; clinical terminology and legal retention review pending |
| `RDY-04` Product decisions | `accepted` except the provider-bound verification mechanism | M0 / pre-real-data | Founder/product | Decisions `M0-D01` through `M0-D10` below |
| `RDY-05` Design-system foundation | `accepted` specification | M0 draft; pre-pilot flow validation | Product design | Component/state matrix in the design-system source; participant validation pending |
| `RDY-06` Dependency snapshot | Passed | 0A | Engineering | Exact install, peer check, TypeScript, Expo Doctor, clean prebuild, and Android/iOS native builds pass with the narrow ML Kit core override |
| `RDY-07` Native compatibility | Accepted for M0; physical acceptance deferred | 0A / pre-pilot | Engineering | Simulator runtime, AES-GCM, and SQLCipher pass; builds pass; camera, enrolled biometrics, notifications, imports, and assistive-technology gestures remain in the physical-device matrix |
| `RDY-08` Threat/privacy kickoff | `accepted` initial model | M0 draft; pre-real-data approval | Engineering/security + privacy | Threat and control backlog below; specialist review pending |
| `RDY-09` Railway/store verification | Partially verified | M0 / pre-pilot | Founder + engineering | Primary-doc verification complete; live accounts, costs, signing, and recovery pending |

---

## 3. Accepted Product Decision Register

### `M0-D01` Vaccination schedule behavior

- **Status:** `accepted`
- **Decision:** Launch manual-first. A parent records or confirms every due,
  scheduled, or administered date. No schedule template silently creates an
  authoritative date or reminder.
- **Future template:** The Ministry of Health National Immunization Schedule is
  the first candidate. IAP or provider schedules may follow only after pediatric
  review and source/version attribution.
- **Review trigger:** Pediatric approval of the source, versioning, regional
  differences, update process, safety copy, and correction behavior.

### `M0-D02` Emergency quick access

- **Status:** `accepted`
- **Decision:** Device unlock and app reauthentication remain the default. The
  owner may opt into a deliberate quick-access action.
- **Quick-view fields:** Preferred name, calculated age, explicitly confirmed
  blood group, confirmed allergies, critical health notes, current urgent
  medication, guardian contacts, and pediatrician contact.
- **Excluded:** Photo, exact date of birth, identity documents, record
  attachments, timeline, and unconfirmed OCR/AI suggestions.
- **Safety rule:** Show provenance and `not provided` separately from `none
  confirmed`. Turning quick access on requires a privacy warning and explicit
  confirmation.

### `M0-D03` Launch Smart Capture categories

- **Status:** `accepted`
- **Structured assistance:** Vaccination record, prescription, doctor-visit
  summary, and discharge summary.
- **Document-only capture:** Birth certificate and laboratory report. Laboratory
  content receives no diagnostic interpretation.
- **Invariant:** The original remains available, manual completion always works,
  and no suggested health value or reminder is committed before confirmation.

### `M0-D04` Free packaging defaults

- **Status:** `provisional-safe-default`
- **Limits:** One child, 25 structured records, 250 MB of original-document
  storage, one invited member, three monthly capsules, and five assisted
  captures per calendar month.
- **Invariant:** Safety, manual capture within record/storage limits, emergency
  access, export, privacy controls, and deletion are never paywalled.
- **Review trigger:** Pilot activation, retained-record distribution, storage
  cost, assisted-capture cost, and willingness-to-pay evidence.

### `M0-D05` Reminder delivery

- **Status:** `accepted`
- **Decision:** Local and push notifications are the MVP reminder channels.
  Email is restricted to authentication, recovery, and essential account
  operations.
- **Review trigger:** Evidence of push delivery failure or an accessibility need
  that cannot be met through the primary channels.

### `M0-D06` Family access defaults

- **Status:** `accepted`
- **Decision:** No record is shared automatically. An owner explicitly invites a
  co-parent or caregiver.
- **Co-parent:** Broad record, task, and memory capabilities after acceptance;
  no ownership, household deletion, subscription, or export authority.
- **Caregiver:** Emergency card, assigned tasks, and owner-selected records only.
- **Invariant:** Revocation blocks future server access and is auditable; the
  product does not claim to erase copies previously exported by a member.

### `M0-D07` Monthly-capsule media

- **Status:** `accepted`
- **Decision:** Capsule text, prompts, dates, and non-sensitive metadata may
  synchronize. Photos remain device-local until the owner explicitly uploads
  them for that capsule.
- **Invariant:** The interface distinguishes `local only`, `uploading`, `synced`,
  `failed`, and `removed from cloud`.

### `M0-D08` Verifiable parent/adult identity

- **Status:** `blocked-external`
- **Accepted requirement:** Child-data creation is impossible until the adult's
  identity and age have been verified through a privacy-counsel-approved method.
  Self-attestation alone is not acceptable.
- **Engineering boundary:** Define a replaceable verification-provider interface
  only after counsel approves the assurance, evidence, retention, recovery, and
  provider requirements.
- **Gate:** The provider/method, failure path, and consent evidence must be
  approved before any real child-data creation.

### `M0-D09` Legal entity and store accounts

- **Status:** `blocked-external`
- **Decision:** Use an Indian registered organization and organization-owned
  Apple Developer and Google Play accounts. Obtain and reconcile the legal
  entity's D-U-N-S record before enrollment.
- **Owner:** Founder with qualified Indian legal/accounting advice.
- **Invariant:** Engineering does not choose the legal structure, use personal
  store identities as a production shortcut, or become the sole credential
  custodian.

### `M0-D10` Subscription and partner activation

- **Status:** `accepted`
- **Decision:** No store subscription implementation in the first
  retention-validation release. Use database-backed free/founding entitlements.
  Partner codes grant sponsored Plus only after household activation.
- **Review trigger:** Retention gate, real payment or sponsor evidence, support
  cost, storage cost, and store-policy review.

---

## 4. Record Taxonomy Version 1

### 4.1 Common record envelope

Every record category uses these product concepts even when the eventual
physical schema separates them:

| Field group | Purpose | Storage and trust rule |
| --- | --- | --- |
| Identity | Record, household, child, creator, updater | Queryable identifiers; household authorization and RLS required |
| Category and status | Type, lifecycle status, active/deleted state | Queryable; never derived from an unconfirmed suggestion |
| Event time | Effective date/time, timezone, precision | Queryable when needed for Timeline/reminders; preserve unknown precision |
| Display metadata | Parent-confirmed title and bounded tags | Queryable/searchable only after confirmation |
| Sensitive payload | Health, identity, notes, and memory content | Application-encrypted structured payload; decrypted only in bounded authorized contexts |
| Original files | Images, PDFs, and capsule media | Individually encrypted objects; filenames and keys contain no sensitive labels |
| Suggestions | OCR/AI category and field candidates | Separate from confirmed values; never used as authoritative search/reminder facts |
| Provenance | Manual, imported, OCR-assisted, AI-assisted, caregiver, provider, government | Stored per value/version where material; visible in review and correction flows |
| Versioning | Revision, correction reason, superseded version | Append/audit correction history; server-authoritative conflict handling |
| Lifecycle | Retention class, deletion/tombstone state | Exportable; active deletion and backup expiry handled separately |

### 4.2 Launch categories

| Category | Required product fields | Optional fields | Offline/search behavior |
| --- | --- | --- | --- |
| Emergency profile | Child reference; guardian contact; field-state distinctions | Blood group, allergies, critical notes, urgent medication, pediatrician | Fully offline; pinned; search not required |
| Vaccination | Vaccine label; source; status; parent-confirmed event/due date when present | Provider, batch, attachment, notes | Offline; searchable by confirmed label/date/status |
| Prescription | Document/date; provider when known; confirmation state | Parent-confirmed medicine text, written schedule, duration/end, reminder link | Offline when pinned; confirmed text searchable |
| Doctor visit | Event date; parent-visible title | Provider, reason, notes, follow-up, tags, attachments | Offline when selected; confirmed fields searchable |
| Discharge/document | Category; document date or unknown state; original file | Facility, title, child-match result, notes | Metadata offline; file based on pin/cache state |
| Task/handover | Title; assignee; due state; completion state | Due time, notes, source-record link | Offline mutation capable; searchable by title/status |
| Timeline entry | Event type; effective date/precision; source link | Parent note, milestone label | Offline projection; source version remains traceable |
| Monthly capsule | Month; text/prompt state | Up to five local-or-explicitly-uploaded photos, milestone, caregiver note, future-unlock flag | Text offline; each media item exposes local/cloud state |

### 4.3 Field-level data-map rules

Before a field becomes a code contract, its package plan must record:

1. Purpose and user-visible meaning
2. Sensitivity and whether `none confirmed`, `not provided`, and `unknown` differ
3. Queryable plaintext versus application-encrypted payload placement
4. Offline requirement and cache/pinning rule
5. Search and reminder eligibility
6. Who may view, create, correct, share, export, or delete it
7. Provenance, confirmation, revision, and conflict behavior
8. Retention, tombstone, active purge, and backup-expiry behavior
9. Audit, analytics allowlist, log prohibition, and staff masking
10. Medical, legal, privacy, and accessibility review requirements

This taxonomy is planning input only. Implementation may create provisional
contracts against synthetic fixtures, but they cannot be treated as approved
real-data contracts before pediatric and privacy review.

---

## 5. Threat Model and Control Backlog

### 5.1 Actors and trust boundaries

- Household owner, co-parent, caregiver, revoked member, and unauthenticated user
- Lost/stolen device user and malicious local software
- External attacker with a session, identifier, upload, or API foothold
- Support operator, privileged administrator, and compromised staff identity
- Apple, Google, email, push, analytics, error-reporting, OCR/AI, and hosting providers
- Mobile secure storage, encrypted local database/files, public network, API,
  worker, PostgreSQL, object storage, backup storage, and staff-console boundaries

### 5.2 Initial controls

| Control | Threat addressed | Owning package/gate | Required evidence |
| --- | --- | --- | --- |
| `M0-C01` Capability checks plus PostgreSQL RLS | Cross-household/BOLA access | `FND-05`, `OFF-02` | Adversarial cross-tenant integration suite |
| `M0-C02` SecureStore key custody and reauthentication recovery | Stolen device and biometric invalidation | `RDY-07`, `OFF-03` | Physical-device invalidation and resync test |
| `M0-C03` SQLCipher plus per-file AES-GCM | Local extraction and object disclosure | `RDY-07`, `OFF-03`, `VLT-04` | Wrong-key, AAD, nonce, interruption, and cleanup tests |
| `M0-C04` Session listing, rotation, revocation, and explicit provider linking | Session theft and account takeover | `RDY-07`, `OFF-01` | Refresh/revoke/replay and enumeration tests |
| `M0-C05` MIME, size, page, decompression, and malware controls | Malicious uploads/resource exhaustion | `VLT-03`, `VLT-04` | Malformed and oversized fixture suite |
| `M0-C06` Separate suggestions and explicit confirmation | Unsafe OCR/AI automation | `VLT-06`, `VLT-07` | Ambiguous/low-confidence/manual-fallback cases |
| `M0-C07` Generic notification payloads and authenticated deep links | Lock-screen disclosure and link abuse | `RDY-07`, `UTL-03` | Cold-start, revoked-session, and payload inspection |
| `M0-C08` Analytics/error/log wrappers with sensitive canaries | Telemetry leakage | `FND-07` onward | Automated canary scans and provider kill switch |
| `M0-C09` Staff passkeys, allowlisting, masking, purpose codes, and audit | Staff abuse | `BTA-04` | Privileged-action and masked-content tests |
| `M0-C10` Restartable export/deletion with processor tracking | Incomplete lifecycle operations | `BTA-01`, `BTA-02` | Authorization, restart, purge, and evidence tests |
| `M0-C11` PITR, object/key recovery, and signing-custody drills | Data, key, or release continuity loss | `BTA-03`, `BTA-09` | Timed restore and second-custodian exercise |
| `M0-C12` Provider adapters, minimal scopes, consent, and kill switches | Provider compromise or policy change | Relevant provider package | Contract review, withdrawal, failure, and disablement tests |

### 5.3 Pre-Real-Data and Pre-Pilot Specialist Review

Privacy/legal review must approve parental verification, notices, consent
evidence, processors, retention, deletion timing, breach workflow, and public
claims. Pediatric review must approve terminology, vaccination-source behavior,
emergency copy, reminder language, and the medical-safety boundary. Security
review must confirm that the controls above cover the final provider and native
module choices.

---

## 6. Dependency and Environment Evidence

### 6.1 Accepted toolchain target

| Technology | Accepted target | Current evidence |
| --- | ---: | --- |
| Node.js | 24.18.0 LTS | Installed through the existing version manager and used by every recorded harness check; global default unchanged |
| pnpm | 11.14.0 | Corepack-pinned exact install and lockfile supply-chain verification pass |
| Expo / React Native / React | 57.0.7 / 0.86.0 / 19.2.3 | Expo Doctor's SDK 57 compatibility matrix; newer React 19.2.7 is not accepted |
| Unistyles / Nitro | 3.3.0 / 0.36.1 | Registry snapshot matches architecture |
| TypeScript / Biome / Vitest | 6.0.3 / 2.5.4 / 4.1.10 | TypeScript 6.0.3 is accepted by Expo 57's peer contract; TypeScript 7.0.2 is not |

Use exact versions. If pnpm 11.14.0 fails the clean compatibility gate, the
only pre-approved fallback is 11.13.1 with a recorded reason.

### 6.2 Observed build environment

- Intel x86_64 MacBook Pro with 16 GB memory
- macOS 26.5.2 and Xcode 26.5
- iOS 26.5 simulator images available; no physical iOS device connected
- Android SDK platforms 35, 36, and 36.1 with x86_64 emulator images
- JDK 17 and 22 installed; JDK 17 is the accepted Android baseline unless the
  generated Expo project requires a newer supported version
- No physical Android device connected

### 6.3 Platform support decision

- iOS 16.4 and newer
- Android 10 (API 29) and newer
- Compile and target Android SDK 36 as required by Expo 57
- Validate at the minimum OS in simulators/emulators and on current physical
  devices. Add a representative constrained Android device before pilot exit.

---

## 7. Native Compatibility Evidence Matrix

The isolated harness is not a production application and may not be imported by
production packages.

| Spike | Gate 0A acceptance | Status/evidence |
| --- | --- | --- |
| Expo 57 + RN 0.86 + Unistyles 3 | Local iOS/Android dev clients build; themes and breakpoints work | Accepted for M0: TypeScript, clean Android/iOS builds, signed simulator install, LAN Metro, and runtime render pass |
| React Compiler + Unistyles | No Babel/runtime conflict; otherwise compiler disabled and recorded | Accepted for M0: Expo config, TypeScript, prebuild, Hermes export, native builds, and simulator runtime pass |
| SQLCipher | Create, migrate, lock, reopen, wrong-key failure, biometric invalidation recovery | M0 round trip passed with SQLCipher 4.7.0 community, WAL, migration, write/read; lock/reopen, wrong-key, and biometric invalidation remain pre-pilot physical tests |
| Better Auth Expo | Email OTP and session lifecycle first; Apple/Google before pilot | Client and callback initialization pass; provider lifecycle remains organization-account work |
| Document scanner | Multi-page physical iOS/Android scan under New Architecture | Module compiles/loads and fails safely as unsupported on iOS simulator; camera workflow deferred to pre-pilot physical matrix |
| Offline OCR | Representative synthetic/de-identified Indian medical layouts work offline | Dependency/native integration accepted for M0; accuracy and offline fixture run deferred to pre-pilot physical matrix |
| Incoming sharing | Image/PDF from Files, gallery, and supported share sources | Blocked: physical devices |
| AES-GCM pipeline | Encrypt, interrupt/resume, validate, download, decrypt, reject wrong AAD/hash | Local AES-256-GCM round trip and mismatched-AAD rejection pass; interruption/service transfer remains package-owned testing |
| Notifications | Token rotation, generic payload, authenticated cold-start deep link | Blocked: physical devices/provider configuration |
| Local signed builds | Reproducible Android release artifact and iOS archive on designated Mac | Unsigned Android debug APK and unsigned iOS simulator app pass; release/archive signing remains pending |
| Pilot distribution | TestFlight and Google Play organization-track install/upgrade | Pre-pilot; blocked on entity/accounts |

Native package dispositions use exactly these outcomes:

1. `accepted-package`
2. `local-expo-module-fallback`
3. `blocked` with owner and resolution date

Scanner failure falls back to VisionKit on iOS and Google ML Kit Document
Scanner on Android through local Expo modules. OCR failure falls back to direct
Vision/ML Kit integration through asynchronous local Expo modules.

### 7.1 Current package dispositions

| Candidate | Disposition | Evidence and next action |
| --- | --- | --- |
| Expo, React Native, React, Unistyles, Nitro, and listed Expo modules | `accepted-package` | Expo Doctor 20/20, Android/iOS compilation, signed simulator installation, and simulator runtime pass; physical acceptance remains pre-pilot |
| `react-native-document-scanner-plugin` 2.0.4 | `accepted-package` for implementation | Native Android/iOS compilation and safe simulator unsupported-device result pass; owner: engineering; physical multi-page acceptance is mandatory before pilot |
| Infinite Red ML Kit text recognition 5.0.1/core 5.0.0 override | `accepted-package` for implementation | Text-recognition 5.0.1's stale core 3.1.0 dependency is narrowly overridden to corrected core 5.0.0; peer check, Expo Doctor, typecheck, clean prebuild, and Android/iOS builds pass; remove override when upstream publishes the corrected dependency |
| Better Auth Expo 1.6.23 | `blocked` | Client initialization is typed; provider/session lifecycle requires organization-owned configuration |

---

## 8. Railway, Store, and Custody Verification

### 8.1 Railway findings

- Southeast Asia Metal is available in Singapore as
  `asia-southeast1-eqsg3a`.
- Buckets are private, S3-compatible, region-bound, and accessed through
  credentials or presigned/backend-proxied requests.
- PITR archives WAL and base backups to a Railway bucket and restores to a new
  sibling service.
- Cutover after restore is manual. A restored fork must have PITR enabled again.
- A sustained bucket outage can exhaust the documented WAL queue and truncate
  the recoverable window while PostgreSQL remains available.

Before real-data or pilot use, verify selected-plan pricing, bucket/volume limits, synthetic
restore timing, environment isolation, hard usage limits, credential rotation,
and recovery-custodian access in live organization-owned projects.

### 8.2 Organization and store checklist

- Form the legal organization with professional advice.
- Obtain and reconcile its D-U-N-S record, legal name, address, phone, website,
  and authorized representative.
- Enroll organization-owned Apple Developer and Google Play accounts.
- Create role-based accounts; avoid shared credentials.
- Select a credential vault and at least two recovery custodians.
- Reserve final bundle/application identifiers only after legal-name ownership is
  confirmed.
- Document Apple signing, Google Play App Signing, provider secret ownership,
  rotation, and account-recovery procedures.
- Complete internal then external TestFlight and Google Play track installation
  and upgrade evidence before pilot distribution.

---

## 9. Parallel Pre-Pilot Research Protocol

### 9.1 Cohorts

- At least 20 first-time parents
- At least 10 co-parents
- At least 5 grandparents/caregivers
- At least 5 clinic/pediatric participants during M0, with the broader clinic
  target continuing as planned
- Separate founder-network and outside-network findings

### 9.2 Five critical flows

1. Create and configure an emergency card.
2. Scan and review a prescription.
3. Confirm a vaccination reminder without mistaking a suggestion for advice.
4. Find a record through Timeline or search.
5. Invite a caregiver and assign a handover.

For every flow capture completion, time, intervention, error/recovery,
comprehension, trust/privacy response, accessibility observation, and qualitative
reasoning. Use participant consent, coded identifiers, access-controlled notes,
and anonymized synthesis.

### 9.3 Gate thresholds

- At least 60% of target interviews describe a recent concrete retrieval or
  coordination failure.
- At least 80% complete first record capture without moderator intervention.
- All five flows have an approved interaction direction.
- No fatal usability, privacy, accessibility, or medical-safety issue remains.
- Pediatric, privacy/legal, and security reviewers approve their pre-pilot items.

---

## 10. Gate Checklists

### 10.1 Gate 0A — Technical Readiness

- [x] M0 decisions recorded with owners and review triggers
- [x] Taxonomy/data-map version 1 drafted
- [x] Initial threat/control backlog drafted
- [x] Toolchain target selected
- [x] Clean dependency, Expo, type, and native project checks pass
- [x] Core native packages have accepted M0 dispositions; physical acceptance is assigned to pre-pilot
- [x] Reproducible unsigned/local Android and iOS build evidence exists
- [x] Railway capabilities and recovery limitations documented
- [x] Entity/store/provider dependencies have owners and later-gate classification
- [x] M0 local links and changed-file diff checks pass; unchanged-diagram and inherited Markdown style debt is tracked
- [x] Founder records the explicit Gate 0A proceed decision

### 10.2 Former Gate 0B — Parallel Pre-Pilot Readiness

These items were founder-deferred on 18 July 2026. They do not block M0 closure
or synthetic-data implementation, but retain their original safety effect and
must not be described as passed until evidence is attached.

- [ ] Research cohorts and five-flow tests meet the evidence requirements
- [ ] Taxonomy and medical terminology receive pediatric approval
- [ ] Privacy/legal review approves verification, consent, retention, processors,
  deletion, breach workflow, and real-data pilot conditions
- [ ] Parent verification provider and recovery path are approved
- [ ] TestFlight and Google Play organization-track install/upgrade tests pass
- [ ] Apple, Google, and email authentication lifecycles pass with
  organization-owned credentials
- [ ] No fatal usability, privacy, accessibility, medical-safety, or native issue remains
- [x] Founder records the decision to defer this evidence from M0 to pre-pilot

### 10.3 Work Permitted After M0

M1 and later implementation may proceed with synthetic fixtures. Real child
data, pilot distribution, production medical/privacy claims, and provider-bound
verification remain blocked until their named later gates pass.

---

## 11. Evidence Log

| Date | Evidence | Result | Gate impact |
| --- | --- | --- | --- |
| 18 Jul 2026 | Repository and environment inspection | Prototype-only worktree; no production scaffold; Intel Mac toolchain available; no physical mobile devices | Confirms preservation rule and device blocker |
| 18 Jul 2026 | npm registry version revalidation | Architecture snapshot matches observed releases except pnpm advances from 11.13.1 to 11.14.0 | Target pnpm 11.14.0 pending clean validation |
| 18 Jul 2026 | Official Node, Expo, Railway, Apple, Google, MeitY, and MoHFW documentation review | Baseline and external constraints recorded in decisions and checklists | Documentary inputs accepted; live/specialist evidence still required |
| 18 Jul 2026 | Exact harness install and static checks on Node 24.18.0/pnpm 11.14.0 | Lockfile policy verification, TypeScript, public Expo config, and Expo Doctor 20/20 pass after aligning React 19.2.3, TypeScript 6.0.3, and safe-area-context 5.7.0 to Expo 57 | Toolchain and Expo dependency matrix accepted; OCR peer metadata remains open |
| 18 Jul 2026 | Clean Expo native prebuild | iOS and Android projects generated; CocoaPods resolved the complete native graph | Native project generation passes; generated projects remain disposable and ignored |
| 18 Jul 2026 | Android `:app:assembleDebug` with JDK 17, SDK 36, and all four ABIs | `BUILD SUCCESSFUL`; 496 tasks executed in 9m 39s; scanner, ML Kit OCR, Nitro, Unistyles, SQLCipher, biometrics, notifications, and Expo modules compiled into the debug APK | Android compile compatibility passes; emulator/physical runtime and release signing remain |
| 18 Jul 2026 | iOS Debug simulator build with Xcode 26.5 and code signing disabled | `BUILD SUCCEEDED`; the 151-target graph compiled and linked scanner, ML Kit OCR, Nitro, Unistyles, SQLCipher, biometrics, notifications, and Expo modules into the simulator app | iOS compile compatibility passes; physical runtime, archive, and signing remain |
| 18 Jul 2026 | pnpm strict peer check | Fails because Infinite Red ML Kit core 3.1.0 publishes React 17 test libraries as runtime dependencies, which request React 17 beside the Expo-required React 19.2.3 | Clean dependency gate remains blocked; do not suppress globally or count native compilation as dependency acceptance |
| 18 Jul 2026 | iOS development-client launch against LAN Metro | Installed app launched and discovered Metro at `192.168.0.5:8083`; iOS displayed its explicit Open confirmation, while macOS denied scripted confirmation without assistive access | Dev-client discovery passes; interactive JavaScript/native probes remain pending and are not counted as passes |
| 18 Jul 2026 | Final frozen install and static recheck after harness configuration cleanup | Frozen pnpm install, TypeScript, public Expo config, and Expo Doctor 20/20 pass | Confirms the recorded dependency/configuration baseline is reproducible |
| 18 Jul 2026 | React Compiler Metro/Hermes production export | Android and iOS each bundle 1,060 modules successfully into Hermes bytecode | Cross-platform JavaScript bundling passes; interactive native behavior remains pending |
| 18 Jul 2026 | Documentation validation | All 20 links in the M0 dossier, roadmap, and design-system documents pass; repository-wide diff/Markdown checks still report pre-existing staged prototype whitespace, intentional Markdown hard-break style, and inherited long-line debt; diagrams were not changed in this pass | Documentation gate remains pending until existing debt is baselined/fixed and diagrams are revalidated |
| 18 Jul 2026 | ML Kit core dependency repair and strict retest | A workspace-only override replaces stale core 3.1.0 with corrected core 5.0.0; 24 obsolete test/runtime packages disappear; `pnpm peers check` reports no issues; frozen install, TypeScript, Expo Doctor 20/20, clean prebuild, Android build, and iOS build pass | Supersedes the earlier peer failure and closes `RDY-06`; override remains narrow and removable when text-recognition updates upstream |
| 18 Jul 2026 | Expo MCP setup and authenticated iOS simulator automation | Expo MCP added to Codex and authenticated; project-local `expo-mcp` drives the signed development client by test ID | Local simulator automation is available; remote MCP tools become discoverable in a new Codex session |
| 18 Jul 2026 | Signed iOS simulator runtime probes | Runtime/Better Auth client initialization, AES-256-GCM round trip plus mismatched-AAD rejection, and SQLCipher 4.7.0 WAL/migration/write/read pass | Core runtime, cryptography, and encrypted database paths accepted for M0 |
| 18 Jul 2026 | Simulator native-boundary probes | Biometric API reports hardware but no enrollment; scanner module reports unsupported device instead of crashing; simulator provides no physical camera | Safe integration behavior passes; enrollment, invalidation, scanner capture, and OCR accuracy remain pre-pilot physical-device tests |
| 18 Jul 2026 | Simulator accessibility stress pass | Maximum Dynamic Type, dark appearance, and increased contrast render a scrollable screen without clipped fixed-height controls or navigation failure; long title wrapping is visually awkward | Structural accessibility baseline accepted for M0; VoiceOver/TalkBack gestures, focus order, physical performance, and title polish remain pre-pilot/package work |
| 18 Jul 2026 | Founder scope and closure decision | Research, five-flow validation, physical-device acceptance, specialist approvals, and account/provider work explicitly moved to parallel pre-pilot or pre-real-data gates | Gate 0A passes and M0 closes; no deferred obligation is represented as passed |
| 18 Jul 2026 | Final M0 document consistency check | All 13 local links across the six M0 source/harness documents resolve and `git diff --check` passes; architecture diagrams are unchanged | M0 documentation close-out passes; inherited repository-wide Markdown style work remains normal documentation debt |

Append new evidence chronologically. Never rewrite a failed result into a pass;
add a later retest row and link the superseding result.

---

## 12. Primary Sources

- [Expo SDK version and platform support](https://docs.expo.dev/versions/latest/)
- [Expo MCP server](https://docs.expo.dev/mcp/)
- [Infinite Red React Native ML Kit](https://github.com/infinitered/react-native-mlkit)
- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [Railway regions](https://docs.railway.com/deployments/regions)
- [Railway storage buckets](https://docs.railway.com/storage-buckets)
- [Railway point-in-time recovery](https://docs.railway.com/volumes/point-in-time-recovery)
- [Apple Developer membership types](https://developer.apple.com/support/compare-memberships/)
- [Apple TestFlight external testing](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers)
- [Google Play developer account types](https://support.google.com/googleplay/android-developer/answer/13634885)
- [Google Play test tracks](https://support.google.com/googleplay/android-developer/answer/9845334)
- [Digital Personal Data Protection Rules, 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa)
- [National Immunization Schedule](https://nhm.gov.in/New_Updates_2018/NHM_Components/Immunization/report/National_%20Immunization_Schedule.pdf)
