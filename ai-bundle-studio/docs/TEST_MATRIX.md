# Test Matrix

## Current coverage through STEP-009

| Area | Test | Environment | Status |
|---|---|---|---|
| Application shell | Privacy, skip link, six destinations, active preflight | Vitest + Testing Library/JSDOM | Passing |
| File acquisition UI | Multiple file/ZIP upload, status, summary, metadata tree, continue to preflight | Testing Library/JSDOM and compiled Chromium E2E | Passing |
| Directory acquisition | File System Access and legacy dropped-directory traversal, including observable empty directories | Vitest/JSDOM mocks | Passing |
| Workflow navigation | Active step, focus transfer, document title | Vitest + user-event/JSDOM | Passing |
| Theme and responsive layout | System/light/dark, 390 px viewport, no horizontal overflow | Vitest + Playwright Chromium + screenshot review | Passing |
| Path normalization | NFC, separators, dot segments, extension, depth, length | Vitest | Passing |
| Traversal defenses | `..`, Unix absolute, drive path, UNC, control characters | Vitest | Passing |
| VFS construction | Sorted directories/files, empty directories, source/logical bytes, lazy sources, disposal | Vitest | Passing |
| Collision defenses | Duplicate normalized path and file-directory hierarchy conflict | Vitest | Passing |
| Bounded byte reads | Blob prefixes, ZIP entry prefix/full reads, abort | Vitest integration | Passing |
| ZIP safe import | Central inventory, empty directories, traversal exclusion, lazy direct entry range | Vitest + fflate | Passing |
| ZIP encryption/resource/structure | Flags, size/count/ratio, central/local consistency, unsupported containers | Vitest | Passing baseline; expand adversarial corpus in STEP-009 |
| Signature detection | PDF, PNG, ZIP/OOXML, OLE, SQLite, media, PE/ELF/Mach-O/WASM baseline | Vitest | Passing for covered signatures |
| Text/binary detection | UTF-8, BOM, UTF-16, null/binary, invalid UTF-8 warning | Vitest | Passing baseline |
| Capability engine | A–E assignment, container refinement, executable override, unknown degradation | Vitest | Passing |
| Risk engine | Sensitive names, active content, macros, executables, nested archives, mismatch, size/ratio | Vitest integration and UI | Passing baseline |
| Preflight concurrency/cancel | Four-reader bounded queue, progress and AbortSignal | Vitest integration | Passing |
| Estimates/recommendation | File/project ranges, source/logical distinction, advisory mode | Vitest integration | Passing baseline; calibrate with real adapters |
| Glob/filter selection | Safe `*`, `**`, `?`, limits, cache, search/capability/risk/manual inclusion | Vitest + Testing Library | Passing |
| Compiled preflight flow | Import → analyze → risk filter with zero HTTP/HTTPS requests | Playwright Chromium | Passing with container navigation workaround |
| Synthetic performance | 1,000 small TypeScript files, 16 KiB budget, concurrency 4 | Vitest/JSDOM single-host benchmark | 23.80 ms diagnostic baseline |
| Manifest identity | SHA-256 standard vectors, kind/path namespace, acquisition-order independence | Vitest | Passing |
| Manifest generation | VFS/preflight/selection mapping, explicit exclusion reasons, pending hashes | Vitest | Passing |
| Manifest schema/golden | Schema version/media alignment and canonical golden JSON | Vitest snapshot | Passing |
| Manifest mutation validation | Counts, parents, inclusion, integrity, tree/output consistency | Vitest | Passing |
| Compiled manifest flow | Import → preflight → configuration → valid manifest, no content leak/network | Playwright Chromium | Passing |
| Manifest performance | 1,000 TypeScript files, 1.98 MB canonical JSON | Vitest/JSDOM single-host benchmark | 92.78 ms diagnostic baseline |
| Text decoding | UTF-8/BOM, UTF-16, controlled Windows-1252 fallback, CRLF/CR → LF | Vitest | Passing |
| Markdown delimiter safety | Content containing backtick and tilde runs receives a longer safe fence | Vitest | Passing |
| Text adapter limits | Bounded `readPrefix`, byte/character truncation, optional line numbers, complete-read hashing | Vitest | Passing |
| Markdown generation | AI instructions, tree, index, file metadata, deterministic anchors, per-file isolation | Vitest integration | Passing |
| Markdown sharding | UTF-8 byte ceiling, multipart naming/order, section splitting, part-size validation | Vitest integration | Passing |
| Manifest Markdown mapping | Adapter/version, encoding, status, anchors, parts, integrity and sharding consistency | Vitest integration and manifest validator | Passing |
| Cancellation/privacy | Abort propagation, no unbounded byte read, bounded React snapshot | Vitest + Testing Library | Passing |
| Compiled Markdown flow | Import → preflight → manifest → Markdown → results at 390 px, zero network/page overflow | Playwright Chromium | Passing |
| Markdown performance | 500 TypeScript files, 2 parts, 465,944-byte Markdown | Vitest/JSDOM single-host benchmark | 113.58 ms diagnostic baseline |
| Runtime dependency audit | Production dependency tree | npm audit | Zero known vulnerabilities |
| Spreadsheet package limits | Workbook bytes, archive entries, XML part/total bytes, safe package paths | Vitest + synthetic OOXML | Passing |
| Spreadsheet XML defenses | UTF-8-only parts, DTD/entity rejection, no external relationship fetch | Vitest + harmless hostile fixture | Passing |
| Workbook semantics | Sheet order/visibility, range, values, cached formulas, dates, comments, merges, hidden rows/columns, defined names | Vitest | Passing |
| Spreadsheet active features | Macro, external-link, chart, pivot, table, connection and calc-chain inventory without execution | Vitest | Passing |
| Spreadsheet limits | Sheet, row, column, cell, text, merge, comment and defined-name budgets with explicit truncation | Vitest | Passing |
| Spreadsheet Markdown | Formula-as-text, cached value separation, formula-like literal protection, bounded tables, omissions | Vitest integration | Passing |
| Spreadsheet PDF preview | Multipage portrait/landscape derived preview, lazy PDF chunk, page/byte snapshot | Vitest + pdf-lib | Passing |
| Spreadsheet manifest mapping | Adapter/version, complete-read hash, LF-derived Markdown, anchors, parts and validation | Vitest integration | Passing |
| Compiled spreadsheet flow | XLSX import → preflight → manifest → Markdown/PDF preview → results; zero network | Playwright Chromium | Passing |
| Spreadsheet performance | One 100×20 XLSX, 2,000 cells, 100 formulas, 10 preview pages | Vitest/JSDOM single-host benchmark | 3,961.61 ms diagnostic baseline |
| PDF text extraction | Local two-page PDF, dimensions, rotation, text, hash and warning model | Compiled Playwright Chromium with PDF.js worker bundle | Passing |
| PDF password handling | Harmless encrypted one-page fixture; task terminated, no bypass, per-file failure isolated | Compiled Playwright Chromium | Passing |
| PDF page import/mapping | Original source pages copied through pdf-lib with source/output mapping | Vitest + pdf-lib | Passing |
| Documents page ceiling | Cover/index/separators/content/report stay at or below configured total; truncation explicit | Vitest | Passing |
| Image header inspection | PNG, WebP lossless dimensions, transparency and format metadata | Vitest | Passing |
| Image bomb defense | 50,000×50,000 PNG header rejected before decoder invocation | Vitest spy + harmless header fixture | Passing |
| Image embedding | Lossless direct PNG embed and derived page/manifest mapping | Vitest + pdf-lib | Passing |
| Compiled PDF/image flow | PDF + PNG import → preflight → manifest → Markdown/documents → results; zero network | Playwright Chromium | Passing |
| Visual output performance | One 25-page PDF plus eight PNG images, 46 output pages | Vitest/JSDOM single-host benchmark | 63.75 ms diagnostic baseline |
| Office package limits | DOCX/PPTX document, entry, uncompressed XML/media, image, slide, text, note, table and preview budgets | Vitest + synthetic OOXML | Passing |
| DOCX semantic extraction | Heading, paragraph, table, metadata, parser messages, macro and external relationship reporting | Vitest + Mammoth browser | Passing |
| Office HTML sanitization | Script/iframe/object/form/SVG/MathML removal, event/style stripping, inert link destinations, no active UI injection | Vitest/JSDOM | Passing |
| DOCX hostile XML | Harmless DTD/entity fixture rejected before Mammoth conversion | Vitest | Passing |
| PPTX semantic fallback | Slide order, text, speaker notes, tables, safe images, metadata, macro/chart/object/A-V/external inventory | Vitest + synthetic PresentationML | Passing |
| Office preview and mapping | DOCX semantic/image pages, one derived page per PPTX slide, global cap, Manifest/Documents cross-validation | Vitest + pdf-lib | Passing |
| Compiled Office flow | DOCM + PPTM import → preflight → manifest → Markdown/documents → results; no active link or network | Playwright Chromium | Passing |
| Office performance | One macro DOCM plus one feature-rich PPTM, 2 slides and 4 preview pages | Vitest/JSDOM single-host benchmark | 338.41 ms diagnostic baseline |

| Secret pattern scanner | Sensitive names, private keys, cloud/token prefixes, JWT, connection strings, assignments, entropy warning, scan/finding limits | Vitest prepared + independent Node assertions | Implemented; independent runtime checks passed, official Vitest blocked by registry 503 |
| Secret redaction/exclusion | Overlap merge, line preservation, immutable originals, report/redact/exclude, no matched values in manifest | Vitest prepared + compiled core integration | Implemented; all three modes passed independent integration |
| Security cross-validation | Per-file report/manifest status, summaries, exclusion totals, visual omission/page references | Vitest prepared + compiled mutation check | Implemented; inconsistent page references rejected |
| Error isolation | Generic no-detail error boundary and local-session reset | Testing Library/JSDOM prepared + substitute full-source typecheck | Implemented; official browser runner blocked by registry 503 |
| Compiled security flow | `.env` import → redact policy → derived output without fake secret; zero network | Playwright Chromium prepared | Not executed in this environment because npm dependency restore was blocked by registry 503 |
| Security performance | 300 text files, 60 flagged/redacted | Isolated compiled-core benchmark | 59.76 ms diagnostic baseline |

## Browser matrix target

| Browser | Priority | Current result | Planned |
|---|---|---|---|
| Chromium desktop | Primary | Compiled import and bounded preflight E2E passed | HTTP-hosted ZIP/directory and large fixture E2E in CI |
| Firefox desktop | Primary fallback | Not tested locally | Input fallback, TextDecoder and directory differences by STEP-014 |
| WebKit desktop | Primary fallback | Not tested locally | File/directory fallback and table controls by STEP-014 |
| Mobile browsers | Secondary | 390 px compiled Markdown workflow and no-page-overflow baseline | Broader input/browser smoke tests after UX completion |

## Required fixture categories by release

- Mixed ZIP, nested ZIP, local/central disagreement, corrupt central directory, ZIP64, traversal, duplicates and hierarchy conflicts.
- Text encodings, binary/text ambiguity, misleading extensions, MIME disagreement, long backtick runs.
- Multi-page, encrypted, corrupt, rotated, and image-heavy PDFs. Basic multipage/password/page-map fixtures are active; expand malformed corpus in STEP-009/014.
- DOCX headings, paragraphs, lists, tables, hyperlinks, images, macros, hostile XML and external relationships. Baseline active; expand corrupt/pathological corpus in STEP-009/014.
- PPTX slide order, notes, tables, images, macros, charts, embedded objects, audio/video and external relationships. Baseline active; expand malformed package corpus in STEP-009/014.
- XLSX formulas, hidden sheets, merged cells, dates, comments, defined names, large ranges.
- Oversized images and active SVG/HTML. PNG header bomb coverage is active; broader codec/animation/SVG corpus remains STEP-009/014.
- Secret patterns and false-positive controls.
- Cancellation and cleanup under load.
- Golden manifest/Markdown/PDF page mappings; manifest, Markdown, visual page mappings, and source-page references are active. Output hashes/multipart parts remain STEP-011.

## Quality gate commands

The intended STEP-009 gate remains four isolated commands: `npm run quality`, `npm test`, `npm run benchmark:all`, and `npm run test:e2e`. The suite now includes the security and error-boundary tests plus the security benchmark/E2E flow. In this workspace the internal npm registry repeatedly returned HTTP 503 during `npm ci`, so the official Vite/Vitest/Playwright/audit gate could not be reproduced. The repository records the independent strict core compile, substitute full-source typecheck, three-mode compiled-core integration, mutation validation, static privacy scan, JSON validation, and isolated benchmark that were actually executed; CI must rerun the official commands when package restore is available.
