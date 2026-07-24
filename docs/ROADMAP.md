# Roadmap

| Step | Status | Objective | Entry dependencies | Acceptance summary |
|---|---|---|---|---|
| STEP-000 | Complete | Bootstrap, research, feasibility, baseline | Master prompt | Repository, docs, probes, benchmarks, quality gate, commit |
| STEP-001 | Complete | Design system and application shell | STEP-000 | Accessible responsive shell, themes, screen placeholders, tests |
| STEP-002 | Complete | Input and virtual filesystem | STEP-001 | Files/directories/ZIP, lazy bytes, normalized tree, traversal and limit tests |
| STEP-003 | Complete | Preflight and capability engine | STEP-002 | MIME/signature, support levels, estimates, filters, risk UI |
| STEP-004 | Complete | Manifest v1 | STEP-003 | Versioned schema, validator, deterministic IDs/tree, consistency tests |
| STEP-005 | Complete | Text and Markdown pipeline | STEP-004 | Encoding, text/code adapters, anchors, safe fences, truncation/sharding |
| STEP-006 | Complete | Spreadsheet pipeline | STEP-005 | Defensive OOXML parser, formulas/values/sheets, bounded Markdown/PDF previews |
| STEP-007 | Complete | PDF and images | STEP-006 | Original PDF page import/text, bounded images, visual index and manifest page mappings |
| STEP-008 | Complete | DOCX and Office extraction | STEP-007 | Semantic extraction, sanitization, derived rendering, PPTX fallback |
| STEP-009 | Implemented · official npm gate blocked by registry 503 | Security, secrets, resilience | STEP-008 | Bounded secret scanner, report/redact/exclude policies, defensive fixtures, error boundaries |
| STEP-010 | Next | Worker orchestration | STEP-009 | Typed queue, concurrency, progress, abort, cleanup, recovery |
| STEP-011 | Planned | Outputs, sharding, download | STEP-010 | Three-file/multipart, hashes, naming, cross-validation, optional archive |
| STEP-012 | Planned | Complete UX and AI prompt | STEP-011 | Configuration, results, reports, onboarding, prompt copy |
| STEP-013 | Planned | PWA, offline, Pages | STEP-012 | Safe service worker, installability, offline, base-path/deploy tests |
| STEP-014 | Planned | Final QA | STEP-013 | Browser matrix, accessibility, performance, security and bundle audits |
| STEP-015 | Planned | 1.0 release | STEP-014 | Version, notes, SBOM/dependency list, tag and authorized deploy |

## STEP-002 close-out

- File, directory, drag-and-drop, and explicit ZIP acquisition are active; explicit empty directories are retained when exposed by the browser API or ZIP.
- Browser `File`/`Blob` objects and ZIP-entry readers remain behind disposable lazy byte sources held outside React state.
- Paths are normalized to NFC with canonical separators; absolute, traversal, control-character, overlong, overdeep, duplicate, and hierarchy-conflicting paths are excluded with explicit issues.
- ZIP inventory applies compressed-size, file-count, per-entry, cumulative-uncompressed, compression-ratio, encryption, method, ZIP64, multi-volume, and structural checks before an entry becomes a VFS file.
- The UI renders a bounded metadata-only tree and replaces/disposes the previous import session when a new one starts.

## STEP-003 entry risks

- MIME declared by the browser is untrusted and must not determine support alone.
- Signature sniffing must be bounded and must not read whole large files.
- Capability levels are not yet assigned; STEP-002 files remain `pending` without a capability claim.
- Preflight estimates must distinguish compressed bytes, logical bytes, and projected output size.
- Filtering must never mutate original paths or byte sources.

## STEP-003 close-out

- Every VFS file is classified from a bounded prefix, extension/name registry, browser-declared MIME, and conservative text heuristic; executable signatures override misleading extensions.
- Capability levels A–E, adapter ownership, support reason, risk signals, and output ranges are recorded in a metadata-only preflight report.
- Blob sources read only the requested prefix. ZIP entry sources read the compressed entry range directly and stop prefix inflation after the requested sample.
- The UI exposes progress, cancellation, input/logical bytes, capability/risk counts, projected Markdown/PDF/manifest ranges, estimated working memory, and a non-authoritative mode recommendation.
- Search, capability/risk filters, manual file inclusion, and bounded `*`/`**`/`?` exclusion globs operate on a separate selection model and never mutate the VFS.
- High-risk names, active content, macros, executables, nested archives, MIME mismatches, large files, high compression ratios, binary ambiguity, and decoding warnings are visible without logging user content.

## STEP-004 entry risks

- STEP-002 session IDs include acquisition sequence and are not stable manifest identifiers.
- Preflight estimates and selections must be represented without becoming authoritative conversion results.
- The manifest schema needs a version, deterministic serialization rules, and validation that works in the browser without inflating the initial bundle.
- Directory records, excluded files, import issues, risk signals, and output placeholders must remain cross-consistent.
- Timestamps must not undermine deterministic golden tests; volatile metadata needs explicit boundaries.


## STEP-004 close-out

- Manifest schema `1.0.0` defines a JSON-only authoritative index and explicit placeholders for work not yet performed.
- Stable file/directory IDs use SHA-256 of schema namespace, node kind, and normalized path; sequence-based VFS IDs never leave the session model.
- Canonical serialization sorts object keys and path-ordered record arrays; `generatedAt` is injectable so golden tests isolate the volatile timestamp boundary.
- The generator records VFS structure, import issues, preflight policy, capability/risk evidence, selection reasons, estimates, output plan, and sharding plan without reading full file bytes.
- Original hashes, adapter versions, Markdown anchors, PDF pages, output parts, and output hashes are explicitly pending or empty.
- The validator checks structure plus cross-consistency among tree, directories, files, parents, counts, sizes, inclusion, capability/risk totals, representations, and output families.

## STEP-005 entry risks

- Text decoding must preserve byte-origin evidence and declare fallback or replacement characters.
- Markdown anchors must be deterministic and must match manifest references exactly.
- Code fences must exceed every backtick run in content or use a safe alternate delimiter.
- Truncation, line numbering, redaction placeholders, and sharding must be explicit and testable.
- Text extraction must not insert active HTML, execute templates, evaluate formulas, or duplicate full content in React state.


## STEP-005 close-out

- Text/code files selected by preflight are extracted through a production adapter using bounded lazy reads and per-file error isolation.
- UTF-8/BOM/UTF-16 decoding and a controlled Windows-1252 fallback record encoding evidence, replacements, BOM removal, and LF normalization.
- Every file section receives deterministic inert anchors and a fence longer than any matching delimiter run in its content.
- Byte and character truncation are configurable and recorded in both the Markdown artifact and Manifest v1; full original SHA-256 is stored only when every original byte was read.
- Markdown parts respect a configurable UTF-8 byte ceiling, declare multipart ordering, and are cross-validated against manifest output and sharding references.
- The complete artifact remains outside React state; the UI exposes progress, cancellation, metadata, validation, and a bounded text preview only.

## STEP-006 entry risks

- Workbook libraries must not evaluate formulas, macros, external links, or embedded code.
- Values, formatted values, formulas, dates, hidden sheets, merged ranges, comments, defined names, and unsupported features must remain distinguishable.
- Very wide or long sheets require row, column, cell, string, and output budgets before parser allocation.
- Spreadsheet-derived Markdown must avoid formula/CSV injection and must state every omitted row, column, and feature.
- The parser choice must be revalidated for browser/worker compatibility, licensing, distribution integrity, bundle impact, and current vulnerabilities.


## STEP-006 close-out

- XLSX and XLSM packages are parsed locally through a bounded OOXML adapter using the existing ZIP engine; no formula, macro, connection, or external relationship is evaluated or fetched.
- Workbook metadata distinguishes visible, hidden, and very-hidden sheets, formulas from cached values, dates, comments, merged ranges, hidden rows/columns, defined names, and detected unsupported features.
- Workbook, package-entry, XML-part, XML-total, sheet, row, column, cell, string, merge, comment, defined-name, Markdown, and preview budgets are validated before or during allocation.
- Spreadsheet Markdown reports formulas as inert text, preserves cached values separately, prefixes formula-like literal strings in derived output, and declares every omission or fidelity warning.
- A lazy `pdf-lib` chunk creates a bounded multipage spreadsheet preview PDF. It is explicitly a derived preview, not the final document output or a faithful Excel rendering.
- XLS and ODS remain inventory level D because STEP-006 has no tested safe production parser for those containers.

## STEP-007 entry risks

- PDF files can be encrypted, malformed, page-count abusive, or crafted to exhaust parser/rendering resources.
- Original PDF pages should be copied without rasterization when safe, while extracted text and page mappings must remain independently verifiable.
- Image dimensions, megapixels, decoded memory, color spaces, transparency, orientation, and animated formats require limits before decode.
- Browser-native image support differs by engine; unsupported formats must degrade to inventory rather than being claimed converted.
- PDF and image operations must remain lazy and cancellation-aware before worker orchestration arrives in STEP-010.


## STEP-007 close-out

- PDF.js extracts page text, dimensions, rotation, page count, and embedded JavaScript presence from local bytes only; password-protected PDFs fail per file without bypass attempts.
- `pdf-lib` copies original PDF pages into the visual output without rasterization when loading succeeds, preserving page geometry and source-to-output mappings.
- PNG, JPEG, GIF, WebP, BMP, and TIFF headers are inspected before browser decoding; byte, dimension, and megapixel ceilings reject decompression-bomb candidates before canvas allocation.
- PNG/JPEG files that require no orientation correction or downsampling are embedded directly. Other browser-decodable images are converted to bounded PNG representations; unavailable decoders degrade transparently to metadata/partial output.
- The documents PDF now contains cover, AI instructions, text index, file separators, original PDF pages, derived image pages, spreadsheet preview pages, isolated error pages, and a final completeness report.
- A strict global page budget may truncate a file or omit later visual entries, but the artifact never exceeds the configured ceiling and records a global warning.
- Manifest v1 now records generated document parts, per-file output pages, conversion status, adapter versions, and source-page mappings validated against the actual PDF artifact.
- Complete PDF/image bytes and the generated documents PDF remain outside React state; the UI receives only bounded metrics and Markdown preview text.


## STEP-008 close-out

- DOCX/DOCM files are parsed through the pinned browser Mammoth build only after OOXML path, entry, uncompressed-byte, XML, media-count, and media-byte checks.
- Mammoth external file access is disabled. Its HTML is passed through a local semantic allowlist that removes active elements, event/style attributes, active links, SVG/MathML, forms, embedded objects, and remote resource URLs.
- DOCX output preserves headings, paragraphs, lists, tables, metadata, inert link destinations, supported images, parser messages, macro flags, external relationship counts, and explicit fidelity warnings.
- PPTX/PPTM is parsed directly from PresentationML. Slide order, text, speaker notes, tables, safe image inventory, metadata, and slide numbering are preserved; charts, objects, audio/video, macros, and external relationships are only inventoried.
- Office preview pages are derived and bounded: semantic Word pages plus supported images, and one simplified landscape page per PowerPoint slide. They are merged into the visual PDF with manifest mappings and no fidelity claim.
- Complete Office assets and PDF bytes stay outside React state. UI snapshots expose counts, validation state, bounded Markdown, and page/byte metrics only.

## STEP-009 entry risks

- Secret scanning and redaction must never copy a detected secret into logs, warnings, or the manifest.
- Sanitized Office HTML is currently not rendered; any future HTML/SVG preview requires an independently tested rendering boundary and CSP review.
- Parser timeouts, worker termination, and memory recovery remain incomplete until STEP-010; STEP-009 must add harmless adversarial fixtures and fail-closed limits without pretending full isolation.
- Redaction must alter derived representations only, preserve original hashes, record exact counts and locations without secret values, and remain reversible before generation.
- CSV/formula injection, dangerous filenames, macro-enabled containers, active SVG/HTML, embedded Office objects, and false-positive secret patterns need explicit regression fixtures.


## STEP-009 close-out

- A bounded browser-local scanner detects sensitive filenames, private-key markers, known cloud/token prefixes, JWTs, credential-bearing connection strings, password assignments, and optional high-entropy candidates.
- Reports contain only category, severity, confidence, offsets and counts; matched values are never copied into the manifest, logs, error boundary, or security summary.
- The user can choose report-only, redact, or exclude. Redaction changes derived representations only; exclusion removes flagged files from Markdown/PDF and recomputes manifest totals while leaving source bytes untouched.
- Non-text visual assets with detected content secrets are omitted in redact mode because reliable visual redaction is not yet available. The omission and reason are recorded explicitly.
- Manifest v1 and Markdown/Documents validators cross-check security reports, summaries, exclusion reasons, redaction counts, and forbidden PDF page references.
- The application shell includes a privacy-preserving error boundary that releases the current session without logging exception details.
- Existing ZIP, XML/HTML/Office, formula-injection, image-bomb, password-protected PDF, cancellation, and resource-limit fixtures remain part of the regression gate.

## STEP-010 entry risks

- Parser work still executes cooperatively on the main thread and can monopolize the UI on large projects.
- Worker messages must never serialize full project state accidentally or duplicate large byte buffers without transfer.
- Cancellation must terminate workers, queues, streams, object URLs, and partially generated assets deterministically.
- Concurrency and backpressure must respect memory estimates and avoid concurrent decompression/parser amplification.
- Recovery must distinguish per-file parser failure, worker crash, user cancellation, and global resource exhaustion.
