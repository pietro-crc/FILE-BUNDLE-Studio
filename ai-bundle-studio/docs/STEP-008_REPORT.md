# STEP-008 Report — DOCX and Office documents

## Scope

STEP-008 activates bounded DOCX/DOCM semantic extraction, strict HTML sanitization, supported document images, derived Word pages, and a PresentationML fallback for PPTX/PPTM. It does not implement faithful Word/PowerPoint layout, macro execution, external resource loading, secret redaction, worker watchdogs, or final downloads.

## Architecture

- `src/core/office/package.ts` validates OOXML paths, entry methods, entry counts, per-entry bytes, cumulative uncompressed bytes, UTF-8 XML, and DTD/entity absence.
- `docx.ts` uses the pinned Mammoth browser build with `externalFileAccess: false`, an inert image converter, complete-read SHA-256, explicit macro/external relationship inventory, and mandatory fidelity warnings.
- `sanitize.ts` reconstructs a new semantic document from an allowlist. It never mounts source or Mammoth HTML and removes active elements, event/style attributes, active links, forms, objects, SVG/MathML, and remote resource URLs.
- `pptx.ts` follows only internal PresentationML relationships to preserve slide order, text, speaker notes, tables, safe image inventory, and metadata. External relationships are counted but never resolved.
- `preview.ts` creates bounded semantic DOCX pages and one simplified landscape page per PPTX slide; pages are merged into the existing visual output with manifest mappings.

## Fidelity and safety

DOCX output is semantic rather than a Word replica. PPTX output is a text/notes/media fallback rather than a PowerPoint renderer. Macros, charts, SmartArt, animations, transitions, embedded objects, audio/video, and external links are never executed, fetched, opened, or played. Unsupported features and omissions make a record partial and remain visible in Markdown and Manifest v1.

## Default limits

| Limit | Default |
|---|---:|
| Office document | 64 MiB |
| Archive entries | 4,000 |
| Single entry | 32 MiB |
| Total uncompressed | 192 MiB |
| Text | 1,000,000 characters |
| Sanitized HTML | 2,000,000 characters |
| Images | 100 |
| Single image | 16 MiB |
| Total images | 64 MiB |
| Slides | 500 |
| Text per slide | 50,000 characters |
| Notes per slide | 20,000 characters |
| Table cells | 50,000 |
| Office preview pages | 1,000 |

## Tests

The final STEP-008 gate covers sanitizer XSS cases, DTD/entity rejection, DOCM and PPTM macro inventory, external relationships, headings, tables, notes, media, feature flags, image limits, preview truncation, Markdown/Manifest/Documents cross-validation, and a compiled DOCM/PPTM browser flow with zero observed network requests.

Final gate: 72 unit/integration regressions, six benchmarks, eight Chromium E2E flows, production/probe builds, PDF probe, runtime/full audits, Pages base-path verification, and clean Git state.

## Benchmark

One macro-enabled DOCM plus one feature-rich PPTM produced two Office assets, two slides, 4,850 Markdown bytes, four Office preview pages, and a ten-page 9,524-byte visual PDF in 338.41 ms in the local diagnostic environment. This is not a product performance promise.

## Remaining risks

- Mammoth and XML/PDF parsers still execute cooperatively on the main thread; worker isolation and watchdogs belong to STEP-010.
- Sanitized HTML is retained only as inert derived data. A future rendered HTML/SVG surface requires a fresh sanitizer/CSP decision.
- DOC, RTF, ODT, binary PPT, exact Office layout, charts, SmartArt, animation, and embedded-object rendering remain degraded or unsupported.
- Secret scanning/redaction and broader harmless adversarial Office fixtures belong to STEP-009.

## Handoff

STEP-009 adds security scanning, redaction, resilience limits, error boundaries, and expanded adversarial fixtures without changing original bytes or leaking detected secrets.


## Production bundle

| Asset | Minified | Gzip |
|---|---:|---:|
| Initial application JS | 400.33 kB | 120.72 kB |
| Mammoth lazy chunk | 491.75 kB | 118.77 kB |
| pdf-lib lazy chunk | 420.07 kB | 175.61 kB |
| PDF.js lazy chunk | 425.28 kB | 126.76 kB |
| PDF.js worker | 1,167.02 kB | 365.53 kB |
| CSS | 38.82 kB | 6.75 kB |

The Mammoth, PDF, and worker assets remain separate from the initial application entry. The worker-size warning is documented and will be addressed through orchestration and loading policy rather than by hiding the dependency.
