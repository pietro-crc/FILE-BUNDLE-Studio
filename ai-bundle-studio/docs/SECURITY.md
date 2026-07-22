# Security and Privacy Baseline

## Security posture

AI Bundle Studio treats every selected file, archive entry, document relationship, filename, metadata value, and embedded resource as untrusted.

## Controls through STEP-008

- No backend, upload endpoint, telemetry, analytics, remote font, runtime CDN module, or document-resource fetch.
- Runtime dependencies are pinned and bundled; close-out requires zero known runtime vulnerabilities.
- CSP blocks remote connections, objects, forms, embedding, and non-self scripts.
- E2E observes the compiled application for HTTP/HTTPS requests and expects none.
- File bytes remain behind disposable lazy sources outside React state; UI snapshots contain metadata only.
- Blob reads accept `AbortSignal`; ZIP decompression can be terminated once extraction begins.
- Paths are NFC-normalized and separator-canonicalized before tree construction.
- Absolute paths, traversal, control characters, excessive depth/length, duplicate normalized paths, and hierarchy conflicts are excluded.
- ZIP compressed size, entry count, per-entry size, cumulative uncompressed size, compression ratio, encryption, compression method, ZIP64, multi-volume, central-directory, and local-header checks run before an entry enters the VFS.
- Nested archives are inventoried as files and are not recursively opened.
- Replacing or clearing a project disposes all active byte sources.
- User content is not written to console or persistent browser storage.
- Preflight reads a configurable prefix only; the default is 16 KiB with four concurrent reads.
- ZIP entry prefix reads use central-directory offsets and ordered incremental inflation instead of loading the complete archive or complete logical entry.
- Executable signatures override misleading names and are excluded at capability E.
- Text extensions are not trusted when the bounded sample is binary.
- Browser-declared MIME is untrusted and mismatches are surfaced.
- Active HTML/SVG, Office macro formats, nested archives, suspicious filenames, large files, high ratios, and ambiguous binaries receive explicit risk records.
- Glob exclusions use a non-evaluated subset with pattern count/length limits and a bounded regex cache.
- Preflight classification, estimates, and selection are metadata-only and do not mutate original paths or byte sources.
- Manifest generation reads no file bytes and exports no content samples.
- Manifest node IDs are path-derived SHA-256 values with separate file/directory namespaces; session sequence IDs are not exported.
- Project names are NFC-normalized, length-bounded, and stripped of control/reserved filename characters.
- Canonical JSON is rendered as escaped React text, never as active HTML.
- Pending original hashes, output mappings, and conversion states are explicit rather than guessed.
- Manifest validation checks parent/child references, tree coverage, counts, byte totals, inclusion reasons, integrity states, and output-family coherence.
- Text extraction uses bounded `readPrefix` calls and supports `AbortSignal`; it never requires the unbounded reader.
- UTF decoding fallback, replacement characters, BOM removal, LF normalization, and truncation are explicitly recorded.
- User paths and metadata are escaped before entering Markdown syntax. File content is isolated in a fence longer than any matching delimiter run in that content.
- Markdown anchors are deterministic inert comments and are never interpreted as HTML by the application preview.
- The complete Markdown artifact remains outside React state; only a 6,000-character preview and metadata snapshot are rendered.
- Original hashes are computed only after complete reads. Prefix hashes are never presented as hashes of the original file.
- Every part, anchor, status, truncation flag, and sharding reference is cross-validated against Manifest v1.
- XLSX/XLSM parsing applies workbook, archive-entry, XML-part, XML-total, sheet, row, column, cell, cell-text, merge, comment, defined-name, Markdown, and preview limits.
- Only an allowlisted subset of OOXML parts is inflated; package paths are validated before selection.
- Spreadsheet XML must be valid UTF-8 and DTD/entity declarations are rejected before DOM parsing.
- External relationships, data connections, macros, charts, pivots, calculation chains, and embedded features are inventoried but never fetched, refreshed, opened, or executed.
- Formulas remain inert source strings and cached results remain separate; no calculation engine is present. Formula-like literal text is protected in derived output without modifying the original workbook.
- Workbook models and PDF preview bytes remain outside React state; the PDF generator is loaded lazily.
- PDF.js receives local byte arrays only, with worker fetch and eval support disabled; no URL or remote document resource is supplied.
- Password-protected PDFs trigger task termination and a per-file failure message; no password guessing or bypass is attempted.
- PDF file size, page count, per-page text, total text, and final output page ceilings are configurable and validated.
- Original PDF pages are copied without script execution or rendering when possible; embedded JavaScript presence is inventoried and warned.
- PNG/JPEG/GIF/WebP/BMP/TIFF dimensions are parsed before decode. Byte, maximum-dimension, and megapixel ceilings reject oversized headers before bitmap/canvas allocation.
- Direct embedding is limited to safe PNG/JPEG cases. Orientation correction/downsampling uses browser-native decoding, and unavailable decoders produce a partial metadata result rather than a false visual claim.
- SVG is not visually rendered before sanitization; it remains inert source text with an active-content risk.
- Source PDF/image assets and the generated documents PDF remain outside React state.

## Current limits and residual risk

- ZIP inventory reads the compressed archive into browser memory once. The compressed-size limit reduces but does not eliminate memory pressure.
- Lazy ZIP entry reads may decompress an entry again on repeated access until worker/cache policy is implemented.
- Browser file and directory APIs vary; Firefox/WebKit verification remains pending.
- Signature coverage is intentionally finite; unknown content degrades safely but may require future registry entries.
- Risky filenames remain heuristic warnings; STEP-009 adds bounded content-based scanning and derived-output report/redact/exclude policies, with false positives and scan limits declared.
- Worker isolation and parser timeouts remain STEP-010. PDF/image and Office limits plus STEP-009 secret-scan ceilings are active, while the broader adversarial corpus remains STEP-014.
- Original hashes are computed for fully read text files only; large/truncated files remain pending until full-byte worker hashing is available.
- STEP-008 runs text, spreadsheet, PDF, image, Office, and PDF assembly cooperatively on the main thread; resource isolation and watchdogs remain STEP-010 controls.
- OOXML parsing currently reads the bounded compressed workbook once and uses browser `DOMParser`; malformed-package coverage is finite.
- Cached formula values may be stale because the application intentionally does not recalculate workbooks.
- The derived PDF preview does not preserve full Excel layout, charts, pivots, conditional formatting, or embedded objects.
- Windows-1252 fallback is controlled but not universal charset detection.

## Required future controls

- Parser-time watchdogs and final output byte/sharding limits. Existing format and secret-scan limits will be stress-tested further in STEP-010/014.
- Sanitized Office/HTML/SVG derived content before DOM insertion.
- No formula, macro, script, template, or executable evaluation.
- Worker watchdogs, queue limits, cancellation, and cleanup.
- Secret redaction only in derived outputs, never in originals.
- No user content in service-worker caches.

## Dependency response policy

A new runtime vulnerability blocks a step unless it is proven non-reachable and documented with a time-bounded remediation plan. `npm audit fix --force` is not run blindly.

- DOCX/DOCM and PPTX/PPTM OOXML packages apply document, archive-entry, entry-byte, cumulative-uncompressed, XML, image-count, single-image, total-image, slide, text, notes, table-cell, HTML, and preview-page limits.
- Office XML is decoded as UTF-8 and rejected when it contains DTD or entity declarations before DOM parsing or Mammoth conversion.
- Mammoth external file access is disabled; its HTML is never trusted or mounted directly. A new inert document is rebuilt from a narrow semantic allowlist, while scripts, event handlers, styles, forms, objects, iframe/embed, SVG/MathML, active links, and remote resources are removed or flattened.
- DOCX image extraction accepts only bounded local package bytes. Unsupported or oversized images are inventoried with an omission reason rather than passed to the PDF renderer.
- PPTX external relationships are counted but never resolved. Macro binaries, charts, embedded objects, and audio/video are detected/inventoried without opening, executing, fetching, or playback.
- Office preview pages carry explicit fidelity warnings and a global page ceiling. Complete sanitized HTML, Office assets, and preview bytes remain outside React state.


## STEP-009 secret handling

The scanner operates only on derived text already produced by a supported adapter. It never uploads content and never mutates the original source. Default limits are 2,000,000 characters and 100 findings per file. Known-pattern checks cover private-key blocks, selected cloud/token prefixes, JWTs, credential-bearing connection strings, password-like assignments, and sensitive filenames. The optional entropy heuristic is explicitly marked as false-positive-prone.

Modes:

- `report-only`: preserve derived content and report category/count metadata;
- `redact`: replace detected content intervals with typed placeholders while preserving removed line breaks;
- `exclude`: remove the flagged file from derived outputs and record `excluded-secret-policy`.

For PDF, image, spreadsheet, DOCX, and PPTX visual assets, a content secret found during derived-text extraction causes the visual representation to be omitted in redact mode. The application does not claim to redact pixels, original PDF page objects, or Office layout reliably.

Security reports and the manifest never contain matched values. The React error boundary deliberately does not log exception objects or component stacks because parser errors may contain sensitive paths or excerpts.
