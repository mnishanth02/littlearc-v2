# FND-08 Implementation Evidence

> **Work package:** `FND-08`
> **Status:** Completed
> **Evidence date:** 19 July 2026
> **Last updated:** 20 July 2026
> **Toolchain:** Node.js 24.18.0, pnpm 11.14.0
> **Plan:** [FND-08 package plan](./fnd-08-design-system-prototype-reconciliation-plan.md)

---

## 1. Reconciliation Outcome

`FND-08` completed the file-by-file disposition recorded in the package plan and
replaced the loose prototype with an accepted, deliberately small production
foundation:

- `@littlearc/design-tokens` is platform neutral and exports complete semantic
  color roles, ten typography roles, a named 4-point spacing scale, radii,
  breakpoints, layout widths, 48-point touch targets, and motion durations.
- Light, dark, and high-contrast themes share the same typed role shape.
- The Expo Router entry initializes Unistyles before routes, and the Unistyles 3
  Babel plugin processes the mobile source through its supported API.
- The mobile theme follows system light/dark mode and switches to the
  high-contrast theme for Android high-text-contrast or iOS darker-system-colors
  preferences. Reduced-motion preference is exposed at the same boundary.
- `Typography`, `Button`, and `Banner` are accepted foundation primitives. They
  use semantic roles, allow text scaling, grow vertically, use explicit state
  language, expose native accessibility state, and meet the 48-point target.
- The FND-03 landing, runtime status, error, and not-found routes use accepted
  primitives and no literal UI colors.
- The synthetic component gallery is linked and registered only in development;
  non-development access redirects to `/`.
- The disconnected Today/Vault screens and three premature domain component
  implementations were removed after their intent was captured in the plan.

No production dependency, custom font, provider, credential, participant data,
child data, or medical document was added.

## 2. Automated Accessibility And Policy Evidence

The design-token suite contains five tests covering:

- Exact semantic-role parity across light, dark, and high-contrast themes.
- WCAG AA 4.5:1 contrast for the supported primary, secondary, muted, link,
  inverse, primary-action, secondary-action, and destructive-action pairs in
  every theme.
- A minimum 48-point cross-platform target.
- Line heights larger than font sizes for every typography role.
- A zero-duration reduced-motion foundation.

The source-policy suite adds five cases and a repository scanner. It rejects:

- Hex, rgb/rgba, and hsl/hsla literals in active mobile UI source.
- React Native `StyleSheet` imports in accepted mobile UI.
- Removed Unistyles v2 `createStyleSheet` and `useStyles` APIs.

The scanner is part of `pnpm check:workspace`, so the accepted boundary is no
longer excluded from formatting, TypeScript, workspace-import, or semantic-style
validation.

## 3. Mobile Build And Gallery Boundary

The initial Android export correctly rejected a Babel plugin `root` of `.`
because it would include `node_modules`. The configuration was narrowed to
`src`, while styled route files outside that root remain discovered by their
direct `react-native-unistyles` imports.

After the correction:

- Expo Doctor passed all 20 checks.
- Android and iOS Hermes exports passed with the Unistyles 3 transform.
- Searches of both release `.hbc` bundles found none of the gallery heading,
  description, or navigation-link strings, confirming development-only content
  was removed from the release bundles.

## 4. Validation Results

All commands ran from the repository root with Node.js 24.18.0 and pnpm
11.14.0.

| Validation | Result |
| --- | --- |
| `pnpm install --lockfile-only` | Pass; workspace dependency lockfile updated |
| `pnpm --filter @littlearc/design-tokens test` | Pass; 5 tests |
| `pnpm --filter @littlearc/design-tokens typecheck` | Pass |
| `pnpm --filter @littlearc/design-tokens build` | Pass |
| `pnpm test:design-system` | Pass; 10 tests across token and policy suites |
| `pnpm check:design-system` | Pass; active mobile UI uses semantic Unistyles source |
| `pnpm --filter @littlearc/mobile typecheck` | Pass |
| `pnpm --filter @littlearc/mobile build:android` | Pass; Hermes export |
| `pnpm --filter @littlearc/mobile build:ios` | Pass; Hermes export |
| `pnpm --filter @littlearc/mobile run doctor` | Pass; 20/20 checks |
| Release-bundle gallery string scan | Pass; no gallery-only strings found in Android or iOS `.hbc` output |
| `pnpm check:workspace` | Pass; 32 tooling tests and all workspace policies |
| `pnpm check:format` | Pass; Biome and Markdown |
| `pnpm check:docs` | Pass |
| `pnpm typecheck` | Pass; tooling and 13 workspace packages |
| `pnpm test` | Pass; 95 tooling, unit, and contract tests |
| `pnpm build` | Pass; all configured package and application builds |
| `pnpm validate` | Pass |
| `git diff --check` | Pass |
| `./tooling/validate-clean-checkout.sh` | Pass in the final source-only snapshot |

The package-scoped Doctor command must use `pnpm --filter @littlearc/mobile run
doctor`; bare `pnpm ... doctor` selects pnpm's unrelated built-in command.

## 5. Evidence Boundaries

Completed in this package:

- File-by-file prototype disposition and removal of excluded prototype source.
- Typed platform-neutral tokens and three registered mobile themes.
- Supported Unistyles 3 compiler/configuration integration.
- Scalable Typography, accessible Button, explicit-state Banner, and a
  development-only gallery.
- Deterministic token contrast/shape/target checks and active-source semantic
  enforcement.
- Mobile typecheck, Doctor, Android/iOS export, root tests/build/validation, and
  clean-checkout proof.

Not claimed by this package:

- The later Gate 1 mobile validation pass is recorded separately in
  [Gate 1 mobile device and accessibility evidence](./gate-1-mobile-device-and-accessibility-evidence.md).
- Physical-iOS VoiceOver, orientation, smallest-phone/tablet, representative-
  user, and broader pre-pilot device-matrix acceptance.
- Acceptance of EmergencyCard, ProvenanceBadge, RecordSummaryCard, input fields,
  sheets, dialogs, or later reference flows as production APIs.
- Approval to use real child, participant, household, or medical data.

## 6. Completion Decision

**Decision: COMPLETE for the accepted FND-08 production design-system
foundation.** The quarantined prototype no longer defines application APIs; the
accepted token/theme/primitives boundary is compiled, enforced, tested, and
integrated into the scaffolded mobile shell. The accepted Gate 1 platform
matrix subsequently passed; the broader pre-pilot obligations remain deferred.
