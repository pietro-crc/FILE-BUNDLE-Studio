# STEP-006 Report — Spreadsheet pipeline

## Scope

STEP-006 adds a production, browser-only spreadsheet baseline for XLSX and XLSM. It does not add a universal spreadsheet library, execute formulas or macros, refresh external data, reproduce Excel layout, or implement final downloads.

## Implemented architecture

- `src/core/spreadsheet/package.ts`: bounded OOXML ZIP inventory and selected-part inflation.
- `src/core/spreadsheet/xml.ts`: UTF-8 XML parsing with DTD/entity rejection and namespace-local helpers.
- `src/core/spreadsheet/address.ts`: cell/range coordinate validation and conversion.
- `src/core/spreadsheet/ooxml.ts`: workbook, relationships, styles/dates, shared strings, comments, sheets, cells, formulas/cache, names, ranges and features.
- `src/core/spreadsheet/render.ts`: bounded semantic Markdown representation.
- `src/core/spreadsheet/preview.ts`: paginated portrait/landscape PDF preview using lazy `pdf-lib`.
- `src/core/spreadsheet/adapter.ts`: common Markdown-pipeline integration and manifest evidence.

## Security properties

- Whole-workbook byte ceiling before parsing.
- Archive-entry, XML-part and cumulative XML ceilings before inflation.
- Safe package paths and selected OOXML allowlist.
- DTD and XML entity rejection.
- External relationships are never resolved or fetched.
- Formulas are never evaluated. Cached values remain separate and may be stale.
- VBA is detected only; `vbaProject.bin` is never opened.
- Connections, charts, pivots, tables and calculation chains are inventoried as fidelity warnings.
- Formula-like literal strings are prefixed in derived output only; originals remain unchanged.
- Workbook models and PDF bytes stay outside React state.

## Capability decision

| Format | Level | Result |
|---|---:|---|
| XLSX | B | Production structured extraction + derived PDF preview |
| XLSM | B | Same extraction, with macro warning and no VBA access |
| XLS | D | Inventory only |
| ODS | D | Inventory only |
| CSV/TSV | B | Existing text pipeline; dedicated tabular adapter remains future work |

## Output behavior

Markdown includes workbook metadata, sheet order and visibility, used ranges, extracted cells, formulas as source text, cached values, comments, merges, hidden rows/columns, defined names, detected unsupported features, and explicit omission counts. Tables are capped by configured row/column budgets.

The spreadsheet PDF is a local derived preview, split into row/column windows. It is not the final `<project>-documents.pdf` and does not claim fidelity with Excel.

## Benchmark

A synthetic 100×20 XLSX containing 2,000 cells and 100 formulas produced 19,502 Markdown bytes and a ten-page 117,483-byte PDF preview in 3,961.61 ms in the container JSDOM benchmark. This is diagnostic data only.

## Verification summary

- Lint: 0 warning, 0 errori.
- TypeScript strict: superato.
- Regressioni: 13 file, 61 test superati.
- Benchmark: 4 file, 4 test superati.
- E2E Chromium compilati: 5 superati, 0 inattesi, 0 flaky.
- Build produzione e base path GitHub Pages: riuscite.
- Audit runtime e completo: 0 vulnerabilità note.
- Unit fixtures cover semantics, macro detection, limits, DTD/entity rejection and external-link non-resolution.
- Integration verifies Markdown, manifest mapping, complete-read hash and PDF reopening.
- Compiled Chromium E2E covers XLSX import through results with no HTTP/HTTPS requests.
- Desktop light and mobile dark screenshots were reviewed.
- No runtime dependency was added.

## Residual risks

- Parsing and preview generation remain on the main thread until STEP-010.
- The bounded workbook is still read into memory once.
- Browser `DOMParser` behavior and malformed-package coverage require broader cross-browser/adversarial testing.
- Charts, pivots, conditional formatting, drawings, images, page setup, embedded objects and exact formatting are not rendered.
- Cached formula values may be stale.
- XLS and ODS are not converted.

## Next step

STEP-007 adds production PDF and image handling with page/text mappings, image limits, downsampling, and integration into the document-output model.
