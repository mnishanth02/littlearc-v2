# FND-08 Design-System Prototype Reconciliation

> **Status:** Completed
> **Started date:** 19 July 2026
> **Last updated:** 19 July 2026
> **Completion date:** 19 July 2026
> **Owner:** Engineering
> **Milestone:** M1
> **Work package:** `FND-08`
> **Depends on:** `FND-03`, `FND-07`, and accepted `RDY-05`/`RDY-07` evidence
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Acceptance evidence:** [FND-08 implementation evidence](./fnd-08-implementation-evidence.md)
> **Inputs:** [Implementation roadmap](../roadmap.md),
> [design-system foundation](../../core/design-system.md),
> [architecture](../../core/littlearc-architecture-and-tech-stack.md), and
> [M0 readiness evidence](../../core/m0-readiness-and-evidence.md)

---

## Outcome

`FND-08` replaces quarantined design-system experiments with a small accepted
production foundation. The result is a platform-neutral semantic-token package,
supported Unistyles 3 theme registration in the mobile shell, accessible text
and action primitives, and a development-only component gallery. Prototype
domain components and disconnected reference screens do not become production
APIs merely because they already exist.

## Scope

Included:

- A recorded disposition for every loose token, theme, component, and screen
  file present when this package started.
- Platform-neutral semantic color, typography, spacing, radius, touch-target,
  breakpoint, and motion tokens exported from `@littlearc/design-tokens`.
- Light, dark, and high-contrast mappings with automated role-shape and WCAG AA
  contrast checks for the supported text/background and action combinations.
- Unistyles 3.3 registration through `StyleSheet.configure`, with system
  light/dark selection and an accessibility high-contrast override.
- Accepted `Typography`, `Button`, and `Banner` primitives using semantic tokens,
  scalable text, text alternatives for state, and minimum 48-point targets.
- A development-only Expo Router gallery reachable from the synthetic landing
  screen only when `__DEV__` is true.
- Static enforcement that product UI cannot introduce literal hex/rgb colors or
  use React Native `StyleSheet` outside the token/theme boundary.
- Focused package tests, mobile type/build checks, root validation, and evidence.

Out of scope:

- Production domain components without a production feature consumer.
- The prototype Today and Vault compositions as production routes.
- A broad component library, icons, custom fonts, visual snapshot infrastructure,
  or new runtime dependencies.
- VoiceOver/TalkBack and 200% type claims on physical devices; those remain part
  of the named physical-device gate and are not replaced by static checks.
- Product redesign of the FND-03 synthetic shell beyond adopting the accepted
  primitives and semantic theme.

## Prototype Disposition

| Prototype file | Disposition | Implementation decision |
| --- | --- | --- |
| `packages/design-tokens/src/colors.ts` | Adapt | Replace incomplete palette aliases with the full semantic role contract and tested theme mappings. |
| `packages/design-tokens/src/spacing.ts` | Adapt | Keep the 4-point intent; add named layout, radius, touch-target, breakpoint, and motion contracts. |
| `packages/design-tokens/src/typography.ts` | Adapt | Remove the React Native dependency and align names with the accepted semantic typography roles. |
| `packages/design-tokens/src/index.ts` | Adapt | Make it the accepted public package entry point. |
| `apps/mobile/src/theme/unistyles.ts` | Adapt | Replace the removed v2 assumptions with typed Unistyles 3 registration and accessibility preference handling. |
| `apps/mobile/src/components/ui/Typography.tsx` | Adapt | Retain the purpose, replace the API and role names, and accept it as a production primitive. |
| `apps/mobile/src/components/ui/Button.tsx` | Adapt | Retain action variants, remove open `any` styling and literal colors, and accept it as a production primitive. |
| `apps/mobile/src/components/domain/ProvenanceBadge.tsx` | Reference only | Preserve its state intent in this disposition and design specification; do not keep disconnected source. |
| `apps/mobile/src/components/domain/RecordSummaryCard.tsx` | Reference only | Rebuild with its first production record consumer; do not accept the prototype API. |
| `apps/mobile/src/components/domain/EmergencyCard.tsx` | Reference only | Preserve emergency-legibility requirements, but rebuild in the emergency vertical slice after data/state contracts exist. |
| `apps/mobile/src/app/(app)/(today)/index.tsx` | Discard | Synthetic names, medical facts, fixed dates, and disconnected routing make it unsuitable as production or gallery source. |
| `apps/mobile/src/app/(app)/(vault)/index.tsx` | Discard | Mock record data and a disconnected prototype route are superseded by later offline/vault slices. |

Reference-only intent is retained in this plan and the accepted design-system
specification, not as excluded TypeScript source. Git history remains the source
for the discarded implementation details.

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Package brief and prototype disposition | Completed | This reviewed plan records every loose artifact. |
| Design-token package | Completed | Platform-neutral semantic contract and five focused tests pass. |
| Mobile theme registration | Completed | Unistyles 3 compiler/configuration and accessibility preferences pass export. |
| Accepted primitives | Completed | Typography, Button, and Banner are adopted by the active shell. |
| Development gallery | Completed | Dev-only content; gallery strings are absent from release bundles. |
| Enforcement and accessibility checks | Completed | Contrast, shape, literal-color, target, type, and motion checks pass. |
| Documentation and evidence | Completed | See the linked implementation evidence. |

## Implementation Plan

1. Turn `@littlearc/design-tokens` into a normal workspace package with build,
   test, and typecheck tasks and no React Native runtime dependency.
2. Define the complete semantic role shape once, then provide exact light, dark,
   and high-contrast mappings plus typography, spacing, radii, layout, touch,
   breakpoint, and motion tokens.
3. Add focused tests for theme parity, token immutability, minimum targets, and
   WCAG AA contrast for supported text/surface/action pairings.
4. Register themes through supported Unistyles 3 APIs before any styled module is
   evaluated. Add a small preference controller for system color scheme, Android
   high-text-contrast, and reduced-motion state.
5. Adapt Typography and Button and add Banner. Require semantic roles, preserve
   native font scaling, avoid fixed text heights, expose accessible state/value
   copy, and keep interactive targets at least 48 points.
6. Replace literal colors in the active FND-03 shell and error boundary with the
   accepted theme/primitives. Keep content synthetic and generic.
7. Add a development-only gallery showing typography, action states, feedback,
   long copy, semantic trust labels, and current accessibility preferences.
8. Remove the disconnected prototype domain and screen source after its intent is
   captured above; include accepted source in Biome and TypeScript validation.
9. Add a deterministic source-policy check for literal UI colors and forbidden
   styling bypasses, with focused tests and root-task integration.
10. Run focused checks, inspect the diff, then run root validation, mobile exports,
    Expo Doctor, and clean-checkout proof. Record evidence and update delivery state.

## Acceptance Criteria

- Every prototype artifact has exactly one recorded adopt/adapt/reference/discard
  outcome and no quarantined source directory remains excluded from validation.
- All three themes expose the same complete semantic role shape; application UI
  references roles rather than literal colors or theme names.
- Required text/surface/action combinations meet WCAG AA in automated checks,
  and meaningful states include a text label rather than color alone.
- Unistyles 3.3 configuration loads before styled components and responds to
  system light/dark preference plus the supported high-contrast signal.
- Typography uses semantic roles, permits native font scaling, and does not clip
  long text through fixed heights or line counts in accepted primitives/gallery.
- Buttons expose role, disabled/busy state, labels, pressed feedback, and a
  minimum 48-point target without relying on motion.
- Reduced-motion preference is observable by the design-system boundary and no
  accepted primitive requires animation to communicate state.
- The component gallery cannot be navigated to from the production build and
  contains synthetic, non-sensitive examples only.
- Focused tests, mobile typecheck/export, root validation, documentation checks,
  and clean-checkout validation pass before completion is claimed.

## Validation

Focused checks:

- `pnpm --filter @littlearc/design-tokens test`
- `pnpm --filter @littlearc/design-tokens typecheck`
- `pnpm --filter @littlearc/design-tokens build`
- `pnpm test:design-system`
- `pnpm --filter @littlearc/mobile typecheck`
- `pnpm --filter @littlearc/mobile build:android`
- `pnpm --filter @littlearc/mobile build:ios`
- `pnpm --filter @littlearc/mobile run doctor`

Broad checks:

- `pnpm check:workspace`
- `pnpm check:format`
- `pnpm check:docs`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm validate`
- `git diff --check`
- `./tooling/validate-clean-checkout.sh`

## Evidence

[FND-08 implementation evidence](./fnd-08-implementation-evidence.md) records
the accepted focused, broad, release-bundle, and clean-checkout results.

## Risks And Controls

| Risk | Control | Residual obligation |
| --- | --- | --- |
| Prototype APIs become accidental architecture | File-by-file disposition and deletion of disconnected source | Rebuild domain components with their first real consumer. |
| Theme shape drifts between modes | One typed contract plus parity tests | Add any new role to all themes in one change. |
| Static contrast checks overstate device accessibility | Label them as deterministic token evidence only | Gate 1 checks the accepted platform matrix; representative-user and broader assistive-technology review remains pre-pilot. |
| High-contrast support differs by platform | Use the supported RN signal and show the current preference state in the gallery | Preserve the accepted Gate 1 evidence and repeat it on the broader pre-pilot device matrix. |
| Gallery leaks into production navigation | Guard route registration, route rendering, and landing link with `__DEV__` | Verify release export contains no reachable gallery path. |

## Decisions

- Keep the design-token package platform neutral; system font behavior belongs to
  React Native primitives rather than shared token source.
- Use Unistyles 3 as already accepted in M0. This package changes no dependency or
  durable architecture direction and therefore does not require a new ADR.
- Accept only the primitives needed to prove the system. Domain components remain
  feature-owned and are rebuilt when their contracts and first consumers exist.
- Use 48 points as the cross-platform minimum target, satisfying both the 44-point
  iOS and 48-dp Android requirements with one token.

## Follow-Up

- Physical-device VoiceOver, TalkBack, 200% type, orientation, smallest-phone,
  tablet, and high-contrast visual evidence remains deferred to the existing
  physical-device gate.
- EmergencyCard, ProvenanceBadge, RecordSummaryCard, field/input primitives, and
  later reference flows remain owned by their first production vertical slices.
