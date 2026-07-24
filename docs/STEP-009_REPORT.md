# STEP-009 Report — Security, secrets, and resilience

## Status

The STEP-009 implementation is complete in source and committed as a recoverable Git artifact. The official npm-based quality gate could not be reproduced in this container because the internal package registry repeatedly returned HTTP 503 while restoring exact lockfile dependencies. This report distinguishes the checks actually executed from the prepared-but-not-run Vite, Vitest, Playwright, and npm-audit commands.

## Scope delivered

STEP-009 adds a bounded browser-local secret scanner, category-only evidence, report/redact/exclude policies, derived-content redaction, cross-output security invariants, defensive fixtures, and a privacy-preserving React error boundary. It does not add a cloud scanner, mutate originals, persist findings, execute active content, or move parsers into workers; typed worker isolation and watchdog orchestration remain STEP-010.

## Architecture

- `src/core/security/scanner.ts` checks normalized paths and bounded extracted text for harmless fixture-backed credential patterns plus optional high-entropy candidates.
- Findings contain only category, severity, confidence, generic description, offsets, and line/column. Matched values are never stored in reports, summaries, or Manifest v1.
- `redact.ts` merges overlapping intervals and inserts typed placeholders while preserving removed line breaks.
- `apply.ts` implements report-only, derived-text redaction, and complete derived-output exclusion.
- `summary.ts` records aggregate counts without content excerpts.
- Manifest v1 records policy, limits, category-only file evidence, redaction/exclusion/visual-omission state, and aggregate totals.
- Markdown/Documents validators reject excluded files retaining anchors/parts and security-omitted visuals retaining page references.
- `ErrorBoundary` deliberately avoids logging exception details and releases the current in-memory import session on reset.

## Supported detections

The baseline covers sensitive filenames, private-key blocks, selected cloud credential identifiers, selected GitHub/Slack token prefixes, JWT structures, credential-bearing connection strings, password/secret assignments, and optional high-entropy candidates. All repository fixtures use harmless synthetic values.

This remains a transparent heuristic baseline, not a guarantee that every secret will be detected. High-entropy findings can be false positives, and content beyond configured limits is explicitly marked as truncated.

## Default limits

| Limit | Default | Maximum accepted configuration |
|---|---:|---:|
| Characters scanned per file | 2,000,000 | 10,000,000 |
| Findings per file | 100 | 1,000 |
| Candidate length | 512 | 4,096 |
| Minimum entropy candidate | 24 | 4,096 |
| Entropy threshold | 4.2 bits/character | 8 |
| High-entropy scan | Enabled | Boolean |

## Policy behavior

| Policy | Markdown | Visual representation | Manifest |
|---|---|---|---|
| Report only | Original derived text retained | Retained | Category/count evidence only |
| Redact | Matched intervals replaced | Omitted when equivalent safe visual redaction is unavailable | Redaction and omission state recorded |
| Exclude | File omitted | File omitted | `excluded-secret-policy` with no output references |

Original `File`, `Blob`, ZIP entry, and `ByteSource` data are never modified.

## Verification actually executed

- Fresh strict TypeScript compilation of every `src/core/**/*.ts` file with global TypeScript and isolated declarations for pinned external packages.
- Substitute strict full-source typecheck of all `src/**/*.ts` and `src/**/*.tsx`; external React/package declarations were isolated outside the repository. `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` remained enabled.
- Compiled-core integration for `report-only`, `redact`, and `exclude`:
  - three findings in each mode;
  - two merged redactions in redact mode;
  - one file excluded in exclude mode;
  - no detected value serialized into Manifest v1;
  - anchors, Markdown parts, and PDF page references removed for excluded files.
- Mutation validation proving that a visually omitted file with a PDF page reference is rejected with `pdf-security-omission`.
- Scanner/redaction runtime assertions covering category detection, no-value report serialization, line-preserving redaction, policy ceilings, and aggregate summaries.
- Static production-source scan found no `fetch`, XMLHttpRequest, WebSocket, `sendBeacon`, `eval`, `dangerouslySetInnerHTML`, direct HTML assignment, browser persistent storage, or production console logging.
- `package.json`, lockfile, Manifest JSON Schema, and benchmark JSON parsed successfully; no temporary `file:/tmp` dependency override remains.
- `git diff --check` passed.

## Verification not executable in this environment

The following official commands are prepared in the repository but were not claimed as passed:

- `npm run quality`;
- `npm test` (including the new security and error-boundary suites);
- `npm run benchmark:all` through Vitest;
- `npm run test:e2e` through compiled Chromium;
- `npm audit`.

Reason: repeated HTTP 503 responses from the internal npm registry during exact `npm ci` restoration. No dependency version or lockfile source was changed to bypass this condition. These commands must run in CI or another environment where the pinned packages can be restored.

## Benchmark actually executed

A compiled-core diagnostic baseline processed 300 text files, including 60 sensitive files. All 60 were flagged and redacted, 120 total findings were recorded, and no synthetic value reached Markdown or Manifest output.

Authoritative values are stored in `docs/benchmarks/STEP-009.json`.

## Remaining risks

- Regex and entropy analysis currently execute cooperatively on the main thread; STEP-010 must add typed workers, queue limits, watchdogs, and deterministic cleanup.
- Report-only mode intentionally preserves derived content and therefore requires a visible warning before final download UX is enabled.
- Visual redaction is conservative: representations are omitted rather than partially masked when equivalent redaction cannot be proven.
- Obfuscated, fragmented, encoded, unknown-format, or out-of-budget secrets can be missed.
- Paths are retained by product contract and can themselves be sensitive.
- The official dependency/build/browser gate must be rerun when the registry is available.

## Handoff

STEP-010 must move costly parser/scanner work behind typed workers, maintain per-file isolation, provide concurrency/backpressure and cancellation, terminate stalled tasks, and release transferred buffers and object URLs without weakening STEP-009 security evidence.
