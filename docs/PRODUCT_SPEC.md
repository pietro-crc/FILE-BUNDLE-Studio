# Product Specification

## Product statement

AI Bundle Studio converts user-selected local files into a structured package that an AI assistant can inspect without receiving the original ZIP archive. It is a static, browser-only application with no backend.

## Primary users

- Non-developers who need to share a project folder with an AI assistant.
- Analysts and knowledge workers consolidating mixed documents.
- Developers who need an inventory-preserving AI handoff without uploading an archive to an intermediate service.

## Core jobs

1. Import ZIPs, multiple files, or directories.
2. Scan before processing and expose size, format, risk, and support level.
3. Preserve the original tree and allow inclusion/exclusion.
4. Generate a visual PDF, semantic Markdown, and machine-readable manifest.
5. Explain every omission, truncation, degradation, and security decision.
6. Download outputs locally and optionally create a preservation ZIP.

## Non-goals

- Universal, pixel-perfect Office conversion.
- Running macros, formulas, scripts, executables, or active HTML.
- Password bypass or document decryption.
- Cloud storage, collaboration, accounts, or server-side conversion.
- Pretending unsupported binary formats were converted.

## Output contract

The default mode targets exactly three logical outputs:

- `<project>-documents.pdf`
- `<project>-content.md`
- `<project>-manifest.json`

Multipart mode splits oversized PDF or Markdown families while keeping one authoritative manifest. Quick preview mode intentionally processes a subset.

## Success criteria for 1.0

- Static GitHub Pages deployment.
- Zero user-content uploads.
- Deterministic manifest and Markdown references.
- Tested support for text/code, PDF, images, DOCX, and XLSX.
- Safe inventory for all other files.
- Per-file failure isolation, progress, cancellation, worker processing, and explicit limits.
- Unit, integration, E2E, security, performance, and accessibility coverage.

## STEP-000 acceptance

The bootstrap is accepted when the repository is initialized, strict TypeScript compiles, lint/tests/build pass, the four required format probes establish technical feasibility, documentation is present, runtime audit is clean, Git is clean, and a commit exists.

## STEP-001 acceptance

The application shell is accepted when all six workflow destinations are represented without simulated functionality, privacy status remains visible, system/light/dark themes work, keyboard focus follows navigation, the layout has no horizontal overflow at the tested narrow viewport, the compiled bundle makes no HTTP/HTTPS requests, documentation is updated, and the quality gate passes.


## STEP-005 acceptance

The text and Markdown pipeline is accepted when tested text/code files are decoded with declared transformations, bounded by configurable byte/character limits, isolated in safe fences, assigned deterministic anchors, split by UTF-8 byte budgets, cross-referenced into Manifest v1, cancellable, kept outside React state except for a bounded snapshot, and verified by unit, integration, compiled Chromium, security, performance, build, and audit gates.

## STEP-009 acceptance

The security and resilience step is accepted when local scanning identifies fixture-backed sensitive names, credentials, tokens, private keys, connection strings and optional high-entropy candidates without serializing matched values; report-only, redaction and exclusion policies are deterministic and leave originals untouched; visual omissions and exclusions are represented consistently across Markdown, PDF and Manifest v1; scanner limits, cancellation and per-file failures remain explicit; the UI exposes the policy and category-only results; a generic error boundary releases the local session without logging sensitive details; and security, regression, benchmark, browser, build and audit gates pass.
