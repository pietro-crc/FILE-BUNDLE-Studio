# STEP-003 Report — Preflight and capability engine

Date: 2026-07-20

## Scope completed

STEP-003 adds bounded, local preflight analysis over the STEP-002 virtual filesystem. It predicts support and risk without parsing complete documents or claiming that conversion has occurred.

Implemented:

- bounded prefix reads for browser blobs and ZIP entries;
- signature detection, local extension/name registry, declared-MIME fallback, and text/binary heuristic;
- capability levels A–E, adapter ownership, detection evidence, and readable reasons;
- risk records and per-file warnings;
- project/file estimate ranges for Markdown, PDF, manifest, and working memory;
- advisory three-file, multipart, or quick-preview recommendation;
- cancellable concurrent analysis with per-file failure isolation;
- search, capability/risk filters, manual inclusion, and safe glob exclusions;
- responsive desktop/mobile preflight UI;
- unit, integration, synthetic benchmark, E2E, visual, security, build, and audit coverage.

No production content adapter, hashing, manifest generator, output file, or download path was introduced.

## Classification policy

The default analysis reads at most 16 KiB per file with four concurrent readers. Classification precedence is conservative:

1. known executable signatures override filenames and declared MIME;
2. ZIP and OLE containers may be refined to expected Office families from their extension;
3. known signatures establish detected MIME/category;
4. the focused local registry maps supported names and extensions;
5. a bounded text heuristic identifies generic text or binary content;
6. browser-declared MIME is used only as a fallback;
7. unknown content degrades to generic text B or binary inventory D.

A text-like extension does not override a binary sample. Read failures create an isolated E record instead of failing the project.

## Capability and risk model

Each preflight record contains:

- detected and declared MIME;
- detection method and confidence;
- category and capability level A–E;
- intended adapter owner and logical adapter version;
- support reason;
- encoding result when applicable;
- projected output ranges;
- warnings and security risks.

Current risk coverage includes active HTML/SVG, macro-enabled Office files, executable content, nested archives, sensitive filenames, MIME mismatch, large files, abnormal ZIP ratios, binary ambiguity, and decoding warnings. Content-based secret scanning and redaction remain STEP-009 work.

## Selection model

Preflight selection is deliberately separate from the VFS:

- original paths and byte sources are immutable;
- capability E files are excluded by default;
- manual inclusion/exclusion stores only file IDs;
- glob rules use a bounded subset of `*`, `**`, and `?`;
- pattern count, pattern length, and compiled-regex cache are bounded;
- a glob-excluded file cannot be accidentally re-enabled until the matching rule is removed;
- selection resets when a new VFS replaces the active project.

The current IDs are session identifiers, not deterministic manifest IDs.

## Memory and cancellation

- Normal files use `Blob.slice()` for prefix reads.
- ZIP files retain the archive and central-directory offset; stored entries read only the requested range.
- Deflated ZIP entries are inflated incrementally and stop after the requested prefix.
- Preflight stores metadata only in React.
- `AbortSignal` cancels the run without converting cancellation into a file-level error.
- The ZIP central-directory inventory still reads the compressed archive once; worker-backed orchestration remains STEP-010.

## UX and accessibility

The preflight screen provides:

- a clear empty state when no project exists;
- progress, current file, processed count, and cancel control;
- textual metrics and risk/capability counts;
- estimate ranges with visible units and confidence;
- an advisory recommendation rather than a forced mode;
- native labeled search/select/checkbox/textarea controls;
- status and error live regions;
- local table scrolling on narrow screens without page-level overflow;
- information conveyed by labels and text, not color alone.

Visual artifacts:

- `docs/screenshots/STEP-003-preflight-desktop.png`
- `docs/screenshots/STEP-003-preflight-mobile-dark.png`

## Synthetic benchmark

A controlled fixture of 1,000 small TypeScript files was analyzed with the default 16 KiB prefix budget and concurrency 4:

- files: 1,000;
- logical bytes: 28,780;
- elapsed time: 23.80 ms on the development container.

The result is diagnostic only. It excludes real storage latency, ZIP-heavy workloads, Office parsers, hashing, worker transfer, and output generation. The machine-readable record is `docs/benchmarks/STEP-003.json`.

## Dependency decision

No new runtime or development dependency was added. Signature recognition and glob matching use small auditable local modules. This avoids adding a MIME database or glob package before measured need while keeping the registry extensible.

## Final quality gate

`npm run quality` completed successfully:

- lint: 0 warnings and 0 errors;
- strict TypeScript: passed;
- Vitest: 12 files and 43 tests passed;
- format spike build: passed with the known parser-only large-chunk warning;
- production build: passed;
- Playwright Chromium: 3 E2E tests passed;
- runtime audit: 0 known vulnerabilities.

Production bundle after STEP-003:

- CSS: 31.04 kB minified / 5.89 kB gzip;
- application JavaScript: 265.21 kB minified / 81.06 kB gzip;
- lazy `fflate` browser chunk: 7.92 kB minified / 3.83 kB gzip.

No HTTP or HTTPS request was observed during compiled-app E2E. The known chunks above 500 kB remain confined to the disposable PDF/DOCX/XLSX feasibility build, not the production application. No new dependency was added.

The closing review also verified:

- no production use of `fetch`, XHR, WebSocket, `sendBeacon`, persistent browser storage, `eval`, dynamic function construction, unsafe HTML insertion, or user-content logging;
- no `.env`, private-key, PEM, or credential file in the repository;
- only `fflate` is imported by production file-processing code, and it remains dynamically loaded;
- GitHub Pages asset paths build correctly under `/ai-bundle-studio/`;
- full and runtime-only npm audits report zero known vulnerabilities.

## Deferred work

- Versioned manifest schema, deterministic file IDs, stable serialization, and validation: STEP-004.
- Text decoding, safe Markdown anchors/fences, truncation, and sharding: STEP-005.
- Real spreadsheet, PDF/image, and Office adapters: STEP-006 through STEP-008.
- Secret scanning, redaction, expanded malicious fixtures, parser limits, and sanitization: STEP-009.
- Worker queue, backpressure, watchdogs, and full cleanup orchestration: STEP-010.
- Firefox/WebKit and large real-world corpus calibration: STEP-014.
