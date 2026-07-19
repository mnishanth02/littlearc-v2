# LittleArc Design-System Foundation

> **Status:** Accepted M0 foundation specification; prototype validation pending
> **Version:** 1.0
> **Last updated:** 18 July 2026
> **M0 source:** [M0 Readiness and Evidence Dossier](./m0-readiness-and-evidence.md)

---

## 1. Direction and Boundaries

LittleArc uses a calm family utility with archival warmth: native familiarity,
warm neutral surfaces, muted sage and terracotta accents, restrained motion,
and clear trust states. The interface must feel dependable and humane without
becoming childish, decorative, or clinical.

The current token, theme, component, and reference-screen files are prototype
inputs. Preserve them through M0. Production adoption occurs file by file after
the repository, Expo, TypeScript, Unistyles, and test foundations exist.

Hard rules:

- Use system fonts for native familiarity and reliable Dynamic Type behavior.
- Use semantic tokens in product UI; literal colors stay inside token/theme definitions.
- Never communicate provenance, urgency, confirmation, or destructive state by color alone.
- Manual and offline paths remain first-class; automation must not own the visual hierarchy.
- Health suggestions remain visibly distinct from parent-confirmed facts.
- Emergency information prioritizes legibility, field-state clarity, and offline access.

## 2. Semantic Token Specification

### 2.1 Color roles

| Group | Required roles |
| --- | --- |
| Background | `primary`, `secondary`, `elevated`, `inverse`, `disabled` |
| Text | `primary`, `secondary`, `muted`, `inverse`, `disabled`, `link` |
| Border | `subtle`, `default`, `strong`, `focus`, `destructive` |
| Action | `primary`, `primaryPressed`, `secondary`, `disabled`, `destructive` |
| Status | `neutral`, `info`, `success`, `attention`, `warning`, `danger`, `offline` |
| Record | `suggested`, `confirmed`, `verified`, `corrected`, `deleted` |
| Provenance | `manual`, `imported`, `ocr`, `ai`, `caregiver`, `provider`, `government` |
| Overlay | `scrim`, `snapshotProtection`, `skeleton` |

Light, dark, and high-contrast themes map the same semantic roles to different
values. Components must never branch on literal theme names to determine domain
meaning.

### 2.2 Typography roles

| Role | Use |
| --- | --- |
| `display` | Rare high-emphasis empty or completion state |
| `screenTitle` | One primary title per screen |
| `sectionTitle` | Major content groups |
| `cardTitle` | Record, task, or dashboard-card title |
| `body` | Primary content and explanatory copy |
| `bodyEmphasis` | Important facts without using color alone |
| `metadata` | Dates, sources, and secondary context |
| `label` | Controls and fields |
| `caption` | Bounded supporting text; never critical information alone |
| `monospace` | Technical support identifiers only; never health content by default |

All roles support font scaling through 200%. Text containers may grow vertically;
critical content must not be truncated or hidden behind fixed heights.

### 2.3 Layout and interaction tokens

- Spacing follows a named scale rather than arbitrary component values.
- Radii distinguish controls, cards, sheets, and pills without encoding state.
- Minimum touch target is 44 points on iOS and 48 dp on Android.
- Focus rings use a semantic focus token and remain visible in high contrast.
- Elevation is reserved for navigation, temporary overlays, and clear grouping.
- Motion tokens include `instant`, `fast`, `standard`, and `deliberate`; reduced
  motion removes nonessential transforms and preserves state feedback.

## 3. Component Inventory

### 3.1 Foundation primitives

| Component | Required variants and behavior |
| --- | --- |
| `Typography` | Every semantic text role; scalable; selectable where useful |
| `Button` | Primary, secondary, quiet, destructive; idle, pressed, focused, loading, disabled |
| `IconButton` | Accessible name required; never icon-only without a label for assistive technology |
| `TextField` | Label, hint, required/optional, value, validation, disabled, read-only |
| `Checkbox` / `Switch` | Label and description; mixed state where applicable; platform-native semantics |
| `SelectField` | Searchable where lists are long; explicit unknown/not-provided options |
| `DateField` | Date precision, timezone, unknown state, and parent-confirmation copy |
| `Banner` | Info, offline, stale, warning, destructive, recovery action |
| `Progress` | Determinate/indeterminate with textual status; never progress by animation alone |
| `Skeleton` | Reduced-motion safe; not used for critical emergency data |
| `EmptyState` | Reason, next safe action, and offline/provider distinctions |
| `Sheet` / `Dialog` | Focus management, escape/cancel, destructive confirmation, keyboard-safe layout |
| `List` / `Divider` | Screen-reader grouping, large data support, no color-only selection |
| `Avatar` | Optional image with text fallback; child photo never required |

### 3.2 Domain components

| Component | Required behavior |
| --- | --- |
| `ProvenanceBadge` | Source label plus icon/text; suggested, confirmed, and verified remain distinct |
| `RecordSummaryCard` | Category, title, confirmed date/unknown state, source, sync/offline state, action menu |
| `ConfirmedField` | Value, provenance, correction action, and confirmation date when material |
| `SuggestedField` | Source snippet/location, editable value, ambiguity state, explicit confirm/reject |
| `OCRSourceSnippet` | Bounded source context, highlight, zoom/accessibility alternative |
| `EmergencyCard` | Large scalable text, explicit field-state language, offline indicator, quick-access warning |
| `ReminderCard` | Source record, confirmed date, timezone, status, non-shaming copy |
| `TimelineEvent` | Effective date/precision, event type, active source version, correction state |
| `CaregiverAccessSummary` | Role, selected capabilities, pending/active/revoked state, owner controls |
| `UploadItem` | Local-only, queued, uploading, retrying, synced, failed, canceled, removed-cloud states |
| `ConflictPanel` | Both values and provenance, effect of each choice, defer/review action |

## 4. State Matrix

Every applicable component or composition documents and verifies these states:

| Dimension | Required states |
| --- | --- |
| Theme | Light, dark, high contrast |
| Typography | Default, large, 200%, long localized copy |
| Motion | Standard and reduced motion |
| Network | Online, offline, reconnecting, stale, provider unavailable |
| Content | Loading, empty, partial, populated, overflow/large dataset |
| Outcome | Success, recoverable error, permanent error, permission lost, canceled |
| Trust | Suggested, confirmed, corrected, provider-issued, verified, unknown |
| Synchronization | Local-only, queued, syncing, synced, conflict, rejected, tombstoned |
| Access | Owner, co-parent, caregiver-selected, revoked, signed out, reauthentication required |
| Destructive | Warning, explicit confirmation, in progress, failed/retry, completed, grace period |

State copy must identify the condition and next action. `Offline`, `not provided`,
`none confirmed`, `could not determine`, `permission denied`, and `access revoked`
are different states and must not collapse into a generic error.

## 5. Reference Flows

The first reference flows are:

1. Account/adult verification, child creation, and emergency-card setup
2. Emergency-card standard and opt-in quick-access modes
3. Prescription capture, OCR review, explicit confirmation, and retry
4. Vaccination entry and reminder confirmation without medical certainty
5. Today dashboard with normal, attention, offline, empty, and error states
6. Vault search, local-only/synced records, and empty/offline retrieval
7. Timeline retrieval with corrected and superseded source records
8. Caregiver invitation, selected access, handover, and revocation

Parallel pre-pilot prototype tests cover the five critical flows defined in the
M0 dossier. Reference-screen approval does not make prototype files production
components.

## 6. Accessibility and Content Requirements

- Meet WCAG AA contrast for text and meaningful non-text indicators.
- Verify VoiceOver and TalkBack reading order, grouping, labels, values, hints,
  errors, and modal focus behavior.
- Support 200% type without clipped emergency facts or inaccessible actions.
- Provide minimum platform touch targets and adequate target separation.
- Respect reduced motion and avoid flashing, parallax dependence, or motion-only feedback.
- Preserve meaningful focus after retry, validation, navigation, and modal dismissal.
- Use plain-language privacy and medical-safety copy. Avoid `safe`, `verified`,
  `none`, or `complete` unless the underlying state supports that claim.
- Generic notification previews never include child names, medicines, vaccines,
  conditions, document titles, or provider names.

## 7. Implementation Order

1. Adopt and test platform-neutral semantic tokens.
2. Register light, dark, and high-contrast Unistyles themes after the M0 native spike.
3. Implement typography, layout, feedback, input, and action primitives with a component gallery.
4. Add domain components with their first production consumer.
5. Add reference compositions as vertical product slices become ready.
6. Expand the system only in response to verified component needs; do not build a broad abstract library first.

## 8. Verification

- Typecheck tokens, themes, primitives, domain components, and reference compositions.
- Enforce semantic UI colors and review literal-color exceptions inside token definitions only.
- Render the component/state matrix in light, dark, and high contrast.
- Test 200% type, long copy, smallest supported phone, tablet width, safe areas,
  keyboard, and orientation behavior where supported.
- Test VoiceOver and TalkBack on physical devices.
- Test reduced motion, focus, loading, offline, empty, recovery, conflict, and destructive states.
- Verify emergency-card legibility and deliberate quick-access warnings without a network connection.
- Record visual/accessibility evidence in the owning package and link it from the M0 dossier or later milestone gate.
