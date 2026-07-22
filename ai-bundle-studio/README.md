# AI Bundle Studio

AI Bundle Studio is a privacy-first web application that turns a local folder, multiple files, or a ZIP archive into an AI-readable bundle composed of a visual PDF, semantic Markdown, and an authoritative JSON manifest.

> Current state: **STEP-009 security, secrets, and resilience**. Local acquisition, secure VFS, preflight, Manifest v1, text/code, spreadsheet, PDF, image, DOCX/PPTX processing, bounded secret handling, and cross-output security validation are implemented.

## Problem

Many AI assistants accept common documents but not project archives. Manually opening, converting, naming, and uploading hundreds of files loses structure, hides omissions, and risks accidental disclosure.

## Product direction

AI Bundle Studio will:

- execute entirely in the browser;
- avoid backend services, accounts, telemetry, and file uploads;
- inventory every input while claiming conversion only for tested formats;
- preserve original paths and SHA-256 hashes;
- generate PDF, Markdown, and JSON outputs with cross-references;
- fail per file rather than aborting an entire project;
- support static deployment to GitHub Pages and offline use after PWA work is completed.

## STEP-009 capabilities

The current build includes:

- multiple-file, directory, drag-and-drop, and explicit ZIP acquisition;
- disposable lazy byte sources held outside React state;
- path normalization and structural ZIP defenses;
- bounded signature/MIME/text classification, capability levels A–E, risks, estimates, filters, inclusion decisions, and cancellation;
- Manifest v1 schema `1.0.0`, deterministic path-derived IDs, canonical JSON, and cross-consistency validation;
- production text/code extraction with encoding evidence, safe fences, deterministic anchors, truncation, sharding, and complete-read hashing;
- production XLSX/XLSM OOXML extraction with visible, hidden, and very-hidden sheets;
- values, cached formula values, formulas, date formats, comments, merged ranges, hidden rows/columns, defined names, and feature flags;
- strict workbook, ZIP-entry, XML-part, XML-total, sheet, row, column, cell, string, merge, comment, and output budgets;
- DTD/entity rejection, external-relationship blocking, macro detection, and zero formula evaluation;
- formula-like literal protection in derived tabular text;
- bounded spreadsheet Markdown tables with explicit omitted rows, columns, cells, and fidelity warnings;
- a lazy, local multipage PDF preview for sheets, kept outside React state;
- local PDF.js extraction of page text, count, dimensions, rotation, and embedded-script warnings;
- password-protected PDF isolation without bypass and per-file failure continuation;
- original PDF page copying without rasterization when possible;
- PNG/JPEG/GIF/WebP/BMP/TIFF header inspection before decode, with byte, dimension, and megapixel limits;
- direct PNG/JPEG embedding or bounded browser-native derived PNG pages;
- a validated visual PDF with cover, instructions, index, separators, PDF/image/spreadsheet pages, error pages, and completeness report;
- manifest mappings from each represented file and source page to actual output pages;
- production DOCX/DOCM semantic extraction through Mammoth with external file access disabled;
- strict local allowlist sanitization that strips active elements, event attributes, active links, SVG/MathML, forms, objects, and remote resource URLs before any derived representation;
- DOCX headings, paragraphs, lists, tables, links as inert text, metadata, supported images, comments/messages, macro flags, and fidelity warnings;
- production PPTX/PPTM PresentationML fallback preserving slide order, text, speaker notes, tables, safe image inventory, metadata, and slide numbering;
- PowerPoint macro, chart, embedded-object, audio/video, and external-relationship inventory without execution, loading, playback, or faithful-rendering claims;
- bounded DOCX pages and one simplified landscape page per PPTX slide inside the visual PDF;
- compiled desktop/mobile workflow coverage with zero observed network requests.
- browser-local secret scanning for sensitive names, private-key markers, selected cloud/token prefixes, JWTs, credential-bearing connection strings, password assignments, and optional high-entropy candidates;
- report-only, derived-text redaction, and complete derived-output exclusion policies without mutating original bytes;
- category/count-only security evidence in Manifest v1, with validators rejecting excluded or visually omitted files that retain output references;
- a privacy-preserving React error boundary that does not log exception details and releases the in-memory session on reset.

Download, output hashes, worker orchestration, faithful Office layout, pixel/region visual redaction, active SVG rendering, and non-OOXML spreadsheet parsers are not simulated. Their controls remain unavailable until the owning steps.

### Desktop Office results

![AI Bundle Studio STEP-008 desktop Office results](docs/screenshots/STEP-008-office-desktop.png)

### Mobile dark Office results

![AI Bundle Studio STEP-008 mobile dark Office results](docs/screenshots/STEP-008-office-mobile-dark.png)

## Privacy and memory baseline

The production application contains no upload client, analytics SDK, remote font, runtime CDN import, or telemetry endpoint. Compiled E2E tests watch for HTTP and HTTPS requests and expect none.

The live VFS, complete Markdown artifact, workbook models, source PDF/image assets, Office assets and sanitized HTML strings, spreadsheet/Office previews, and final documents PDF bytes remain outside serializable React state. UI state contains metadata, progress, validation summaries, part sizes, spreadsheet counts, preview-page counts, and an explicitly limited text preview. Text adapters use `readPrefix`; the OOXML adapter performs a policy-bounded workbook read and selectively inflates only approved XML parts. Original bytes are never changed; derived text normalizes line endings to LF and records that transformation.

## Repository structure

```text
.github/workflows/       CI and manually triggered Pages build
src/app/                 Application composition and active artifact ownership
src/core/vfs/            Paths, lazy byte sources, ZIP inventory, tree, snapshots
src/core/preflight/      Signatures, text detection, capability, risks, estimates, globs
src/core/manifest/       Manifest v1 types, IDs, generator, serializer, validator
src/core/markdown/       Encoding, adapters, anchors, fences, sharding, validation
src/core/spreadsheet/    Defensive OOXML parser, workbook model, Markdown and PDF preview
src/core/pdf/            Local PDF.js inspection and semantic extraction
src/core/image/          Header inspection, image limits, browser decode/downsampling
src/core/office/         DOCX sanitization, PresentationML extraction, Office previews
src/core/output/         Documents PDF assembly, page mappings and validation
src/core/security/       Bounded secret scanning, redaction, exclusion and summaries
src/core/hash/           Portable deterministic SHA-256 baseline
src/core/adapters/       Common adapter contracts
src/core/pipeline/       Phase/progress/cancellation boundaries
src/features/            Import, preflight, configuration, processing, results UI
src/ui/                  Accessible reusable UI components and design tokens
src/schemas/             Versioned JSON interoperability schemas
src/workers/             Future worker entry points
spikes/browser/          Disposable format feasibility harness
tests/                   Unit, integration, benchmark, and compiled-browser E2E
docs/                    Product, architecture, decisions, reports, screenshots
scripts/                 Repeatable engineering and E2E helpers
```

## Prerequisites

- Node.js `>=22.13.0 <23`
- npm `>=10`

## Development

```bash
npm ci
npm run dev
```

## Quality commands

```bash
npm run lint
npm run typecheck
npm run quality
npm test
npm run benchmark:all
npm run test:e2e

# Optional focused commands
npm run test:pdf
npm run benchmark:preflight
npm run benchmark:manifest
npm run benchmark:markdown
npm run benchmark:spreadsheet
npm run benchmark:pdf-images
npm run benchmark:office
npm run audit:runtime
```

The complete gate is intentionally split into isolated commands: `npm run quality` covers lint, strict typecheck, format probes, production build, PDF read/write verification, and dependency audits; `npm test`, `npm run benchmark:all`, and `npm run test:e2e` run in separate processes. CI executes all four commands. The regression runner uses three concurrent single-worker Vitest processes with authoritative reports, isolating parser-heavy JSDOM tests from the core group. The E2E script builds directly and then replaces its shell with the controlled Playwright runner, preventing build/test process teardown from blocking a later phase while preserving every assertion.

The local container Chromium blocks localhost and file navigation through administrative policy. Playwright therefore injects the compiled application entry bundle into a blank browser page. The compiled workflow, local file acquisition, preflight, manifest, Markdown generation, responsive layout, and network posture are still exercised in a real Chromium process.

## Format feasibility

- **Text/code/configuration:** production Markdown extraction is active with encoding, limits, safe fences, deterministic anchors, sharding, and manifest updates.
- **ZIP:** production input baseline with safe inventory and lazy entry-prefix reads; nested recursion remains disabled.
- **PDF:** production A-level local extraction and original-page import are active, with password/corruption isolation, limits, Markdown text, and manifest page mappings.
- **DOCX/DOCM:** production B/C semantic extraction is active with strict allowlist sanitization, metadata, tables, inert links, supported images, macro/external-relationship warnings, and derived PDF pages. Fidelity with Microsoft Word is not claimed.
- **PPTX/PPTM:** production B/C fallback is active for slide order, text, notes, tables, safe image inventory, macro/external/feature warnings, and one simplified derived page per slide. Faithful PowerPoint layout, animation, SmartArt, charts, and embedded objects are not claimed.
- **XLSX/XLSM:** production B-level OOXML extraction is active with formulas as text, cached values, sheet metadata, limits, Markdown tables, and derived PDF preview. Macros are detected but never opened.
- **Images:** production C-level metadata and visual representation are active for PNG/JPEG/GIF/WebP/BMP/TIFF when browser decoding is safe; SVG remains inert until sanitization.
- **XLS/ODS:** inventory level D until a tested safe production parser is approved.
- **Executables:** known signatures are level E and excluded by default; they are never executed.
- **Unknown content:** safely degrades to generic text B or binary inventory D rather than receiving a false conversion claim.

See [`docs/FILE_SUPPORT_MATRIX.md`](docs/FILE_SUPPORT_MATRIX.md) for the authoritative status.

## Build and static hosting

```bash
npm run build
```

The output is written to `dist/`. `VITE_BASE_PATH` configures a GitHub Pages repository path:

```bash
VITE_BASE_PATH=/ai-bundle-studio/ npm run build
```

The Pages workflow remains manual during development. No repository has been published and no deployment has been triggered.

## Benchmarks

```bash
npm run benchmark
npm run benchmark:preflight
npm run benchmark:manifest
npm run benchmark:markdown
npm run benchmark:spreadsheet
npm run benchmark:office
npm run benchmark:all
```

Recorded baselines live under [`docs/benchmarks`](docs/benchmarks). They are single-host diagnostics, not product performance promises.

## Current limitations

- Text, spreadsheet, PDF, image, Office, and PDF assembly work currently runs cooperatively on the main thread; typed workers, queueing, backpressure, watchdogs, and recovery arrive in STEP-010.
- Sequential reads favor deterministic progress and bounded memory over throughput in this baseline.
- Hashes are computed only for files fully read within the configured text limit; truncated files correctly remain `pending`.
- Windows-1252 is a controlled fallback, not universal encoding detection.
- XLSX/XLSM support is intentionally limited to bounded OOXML parts. XLS, ODS, charts, pivots, conditional formatting, embedded objects, and exact Excel layout are not converted.
- Spreadsheet formulas are never recalculated; displayed values are cache values already stored in the workbook and may be stale.
- Spreadsheet pages remain simplified derived previews inside the generated `<project>-documents.pdf`; they are not a fidelity claim.
- Line-ending normalization changes the derived representation only and is declared in every record.
- Markdown and documents artifacts remain in session memory; download and final output hashes arrive in STEP-011.
- Signature coverage is intentionally finite and estimates remain heuristic ranges.
- ZIP inventory reads the compressed archive into memory once; nested archives are not recursively expanded.
- Secret scanning/redaction, SVG sanitization, worker watchdogs, and a broader adversarial parser corpus arrive in later security steps. DOCX HTML sanitization is active, but sanitized HTML is retained only as an inert derived artifact and is not injected into the UI.
- Firefox and WebKit behavior remains unverified locally.
- The large format-probe bundle is intentionally separate from production.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Decisions](docs/DECISIONS.md)
- [Dependency decisions](docs/DEPENDENCY_DECISIONS.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Security baseline](docs/SECURITY.md)
- [File support matrix](docs/FILE_SUPPORT_MATRIX.md)
- [Test matrix](docs/TEST_MATRIX.md)
- [Roadmap](docs/ROADMAP.md)
- [STEP-008 report](docs/STEP-008_REPORT.md)

## License

MIT. Third-party dependencies retain their respective licenses.
