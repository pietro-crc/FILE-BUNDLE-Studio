# Dependency Decisions

Research date: 2026-07-21. Versions are exact in `package.json` and `package-lock.json`. STEP-001 through STEP-008 added no dependencies.

## Evaluation criteria

Each candidate is reviewed for official documentation, maintenance, license, browser operation, worker/build compatibility, bundle impact, and known vulnerabilities. Runtime audit must pass before a step closes.

## Accepted baseline dependencies

| Dependency | Version | License | Role | Decision and constraints |
|---|---:|---|---|---|
| React / React DOM | 19.2.7 | MIT | UI runtime | Accepted. No user file bytes in React state. |
| Vite | 8.1.5 | MIT | Build/static assets | Accepted. Supports TypeScript, workers, and configurable base path. |
| TypeScript | 6.0.3 | Apache-2.0 | Strict typing | Accepted below 6.1 for current lint compatibility. |
| Oxlint | 1.71.0 | MIT | Fast correctness lint | Accepted from current Vite scaffold. Revisit rules as source volume grows. |
| Vitest | 4.1.10 | MIT | Unit/integration tests | Accepted and Vite-aligned. |
| Playwright Test | 1.61.1 | Apache-2.0 | Browser E2E | Accepted. Chromium baseline local; Chromium/Firefox/WebKit planned in CI. |
| fflate | 0.8.3 | MIT | ZIP/deflate engine | Accepted for STEP-002 production input. Loaded as a lazy chunk; application code owns path validation, central-directory checks, encryption/method policy, and resource limits. |
| pdf-lib | 1.17.1 | MIT | PDF creation/import candidate | Accepted for generation and page-copy feasibility. Not a text extractor. |
| pdfjs-dist | 6.1.200 | Apache-2.0 | PDF parsing/text/rendering | Accepted with worker and lazy-loading requirements. Large assets must not enter the initial application chunk. |
| Mammoth | 1.12.0 | BSD-2-Clause | DOCX semantic extraction | Accepted for semantic HTML/text only. Output must be sanitized before preview; fidelity warnings are mandatory. |
| Testing Library packages | pinned | MIT | Component behavior tests | Accepted. |

## Deferred candidates

| Candidate | Target step | Reason |
|---|---|---|
| DOMPurify | Reconsider for a future rendered HTML/SVG boundary | STEP-008 stores and transforms Office HTML but never injects it into the UI. A strict local semantic allowlist is smaller and sufficient for this non-rendering use case. |
| Zod or equivalent | Not adopted in STEP-004 | The versioned JSON Schema plus a focused local cross-consistency validator met the current contract without adding runtime weight. Reconsider if schema breadth or migration complexity justifies it. |
| vite-plugin-pwa | STEP-013 | PWA caching rules require explicit user-content exclusions and update behavior design. |
| UI virtualization | STEP-014 or evidence-driven earlier step | The STEP-003 UI bounds rendered rows to 300 and remains responsive; add a library only after measured need. |

## Rejected or not adopted

### ExcelJS 4.4.0

Rejected for production baseline. Installation produced deprecated transitive-package warnings and `npm audit --omit=dev` reported two moderate vulnerabilities through `uuid`. It was removed and the audit returned to zero known vulnerabilities.

### npm `xlsx` 0.18.5

Not adopted. Official SheetJS documentation identifies the public npm registry package as outdated and points to its CDN as authoritative.

### JSZip as the primary ZIP engine

Not selected. `fflate` provides a smaller focused browser implementation for the initial use case. Mammoth may use JSZip internally, but AI Bundle Studio will not expose that transitive dependency as its archive security boundary.

### General MIME/file-signature runtime library

Not adopted for STEP-003. A focused local registry and bounded signature detector cover the declared baseline with transparent tests and no bundle dependency. Unknown or ambiguous formats degrade to text-generic, inventory, or blocked status rather than being guessed. Reconsider only when a new tested format demonstrates a concrete coverage gap.

## Official research sources

- Vite guide: https://vite.dev/guide/
- Vite features: https://vite.dev/guide/features
- Vitest browser guide: https://vitest.dev/guide/browser/
- Playwright browsers: https://playwright.dev/docs/browsers
- Vite PWA guide: https://vite-pwa-org.netlify.app/guide/
- fflate repository: https://github.com/101arrowz/fflate
- pdf-lib repository: https://github.com/Hopding/pdf-lib
- PDF.js documentation: https://mozilla.github.io/pdf.js/
- Mammoth repository: https://github.com/mwilliamson/mammoth.js/
- SheetJS installation: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
- SheetJS formats: https://docs.sheetjs.com/docs/miscellany/formats/
- DOMPurify repository: https://github.com/cure53/DOMPurify
- Zod documentation: https://zod.dev/

## STEP-004 manifest validation decision

No schema-validation dependency was added. `src/schemas/manifest-v1.schema.json` is the interoperability contract, while the bundled validator checks both structure and product-specific relationships such as tree coverage, parent links, totals, inclusion reasons, representation states, and output families. This split keeps the initial application bundle small and makes cross-record invariants explicit. A standards-complete JSON Schema engine can be reconsidered when external schema ingestion, migrations, or broader schema composition create a measured need.


## STEP-005 text/Markdown decision

No text-decoding, Markdown-rendering, slugging, or sharding dependency was added. Browser `TextDecoder`, local deterministic helpers, and the existing SHA-256 module cover the required source-generation contract without executing or rendering untrusted Markdown. This avoids a parser/rendering surface in a step that only needs safe artifact production.


## STEP-006 spreadsheet dependency decision

No dependency was added. The official SheetJS documentation currently identifies its own CDN tarball as the authoritative distribution and provides version 0.20.3, while the public npm `xlsx` package remains obsolete. SheetJS was not rejected for technical capability; it was not adopted because installing a runtime parser outside the normal registry/lockfile provenance path would require a separate vendoring, checksum, update, license, vulnerability, and reproducibility policy.

The STEP-006 baseline instead reuses `fflate` for selected OOXML package parts and `pdf-lib` for a lazy derived preview. The parser is deliberately limited to tested XLSX/XLSM structures. XLS and ODS remain inventory level D. Reconsider SheetJS or another parser only when broader format support justifies the additional supply-chain controls and a fixture-backed bundle/security evaluation.


## STEP-007 PDF and image dependency decision

No dependency was added. The production path activates the already pinned `pdfjs-dist` and `pdf-lib` packages that were approved during STEP-000 feasibility research. PDF.js is used only with local byte arrays and bundled worker code; no document URL, remote resource, or runtime CDN import is supplied. `pdf-lib` copies original pages and embeds PNG/JPEG assets into the derived visual PDF.

Image metadata and bomb defenses are implemented with small local header readers for PNG, JPEG/EXIF, GIF, WebP, BMP, and TIFF. Browser-standard `createImageBitmap`, `OffscreenCanvas`, and canvas are progressive enhancements for orientation correction and downsampling. No general image codec dependency was added; formats the browser cannot safely decode degrade to metadata/partial representation.


## STEP-008 Office dependency decision

No package was added. The already pinned `mammoth` browser build is activated for DOCX semantic conversion with `externalFileAccess: false`; its own documentation explicitly warns that it performs no sanitization, so its result is never trusted or rendered directly. A local allowlist transformer reconstructs only semantic elements and inert metadata.

DOMPurify was re-evaluated but not adopted because STEP-008 does not create a general HTML preview surface. This is not a rejection of DOMPurify: it must be reconsidered if a later feature renders sanitized HTML or SVG. PPTX/PPTM extraction uses the standardized OOXML/PresentationML package parts through the already approved `fflate` dependency. No browser office suite, macro runtime, remote converter, CDN parser, or external rendering service is introduced.


## STEP-009 security dependency decision

No dependency was added. The secret scanner, entropy estimator, overlap merger, redaction placeholders, summaries, and validators are implemented as small bounded local modules. This avoids sending content to a cloud scanning service and avoids adding a large signature database or regex engine with its own supply-chain and update surface.

The tradeoff is deliberate: this is a transparent baseline, not a guarantee that every credential is detected. Pattern coverage and false-positive behavior are fixture-backed and documented. A future ruleset dependency may be considered only if it is browser-local, auditable, license-compatible, size-bounded, deterministic, and incapable of network access.
