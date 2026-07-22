# STEP-001 Report — Design system and application shell

Date: 2026-07-20

## Scope completed

STEP-001 replaces the engineering-only bootstrap screen with the accessible application shell that later features will inhabit. It does not import, inspect, process, or download user files.

Implemented:

- persistent product header and local-processing privacy status;
- six-destination workflow navigation;
- introduction, import, preflight, configuration, processing, and results screen shells;
- reusable buttons, notices, metrics, output cards, icons, brand, and section-heading components;
- light, dark, and system theme selection;
- responsive desktop, tablet, and narrow-layout behavior;
- skip link, semantic landmarks, `aria-current`, focus transfer on screen changes, visible focus, and reduced-motion support;
- explicit disabled states and future-step notices for every unfinished capability;
- Italian document language and GitHub Pages-safe favicon base path;
- component and compiled-bundle tests.

## Architecture decisions

- Navigation uses typed local React state instead of a routing dependency. No deep links or browser history are required before the workflow state model exists.
- Design tokens are plain CSS custom properties. No UI framework or runtime styling dependency was introduced.
- Theme preference is session-local for now. Persistence is deferred until storage and PWA behavior are designed explicitly.
- Feature screen shells live in their intended `src/features/*` boundaries, while reusable primitives live under `src/ui`.
- Unfinished actions are disabled rather than mocked. The shell never claims that file acquisition or conversion is active.

## Accessibility review

Verified in code and tests:

- one primary `main` landmark with a skip link;
- labeled navigation and privacy status;
- native buttons and inputs;
- keyboard-operable theme and workflow controls;
- focus moved to the new `h1` after workflow navigation;
- `aria-current="step"` on the active destination;
- no information conveyed only by color;
- minimum 320 px layout without horizontal overflow at the 390 px E2E viewport;
- light/dark semantic tokens and visible focus ring;
- `prefers-reduced-motion` handling.

Automated WCAG conformance tooling and screen-reader/browser matrix validation remain scheduled for STEP-014.

## Visual validation

Chromium screenshots were captured from the compiled application bundle:

- `docs/screenshots/STEP-001-desktop-light.png`
- `docs/screenshots/STEP-001-mobile-dark.png`

The visual pass found and corrected insufficient body-text contrast on the accent privacy card before close-out.

## Tests added or expanded

- Unit/component tests: privacy posture, skip link, navigation, focus management, document title, disabled unfinished actions, theme switching, and six workflow destinations.
- E2E: compiled-bundle navigation, theme change, zero HTTP/HTTPS requests, narrow viewport, and horizontal-overflow check.
- Existing ZIP, PDF, DOCX, XLSX, and pipeline contract tests remain passing.

## Bundle result

Production application after STEP-001:

- CSS: approximately 18.4 kB minified / 4.0 kB gzip;
- JavaScript: approximately 209.6 kB minified / 65.5 kB gzip.

The separate parser spike continues to produce the expected large-chunk warning and remains outside the application shell.

## Deferred work

- Real input controls and virtual filesystem: STEP-002.
- Capability/preflight data: STEP-003.
- Persisted configuration and complete workflow state: later feature steps.
- Worker orchestration and live progress: STEP-010.
- Output downloads: STEP-011.
- Complete configuration/results UX: STEP-012.
- PWA persistence/offline behavior: STEP-013.
- Full accessibility tooling and browser matrix: STEP-014.
