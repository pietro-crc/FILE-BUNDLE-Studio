# Architecture

## Architectural style

AI Bundle Studio uses a local-first, ports-and-adapters architecture inside a React application. React owns interaction state and presentation; file bytes, parsers, and expensive processing remain outside component state.

## Layer boundaries

### Application and UI

- `src/app`: composition, typed workflow model, top-level focus/title handling, and ownership of the active VFS reference.
- `src/ui`: CSS design tokens and reusable accessible components.
- `src/features/import`: browser acquisition adapters, import UI, bounded tree preview, and metadata snapshot rendering.
- `src/features/preflight`: bounded analysis runner, progress/cancel UI, estimates, filters, inclusion state, and risk/capability inventory.
- `src/features/*`: later preflight, configuration, processing, and results slices with narrow public APIs.

The application stores the live `VirtualFileSystem` in a ref. React state receives an immutable snapshot containing paths, counts, sizes, issues, and tree metadata only. Clearing, replacing, or unmounting the app disposes byte sources.

### Domain/core

- `core/vfs/path.ts`: Unicode/separator normalization and path-policy enforcement.
- `core/vfs/byte-sources.ts`: disposable lazy readers for browser blobs and ZIP entries.
- `core/vfs/import.ts`: file/directory-candidate validation and VFS construction.
- `core/vfs/zip.ts`: ZIP inventory, structural validation, safety limits, and lazy entry sources.
- `core/vfs/tree.ts`: deterministic directory-first tree construction.
- `core/vfs/snapshot.ts`: metadata-only React projection.
- `core/preflight`: local format registry, signatures, text heuristic, capability/risk policy, estimates, safe globs, filtering, and bounded concurrent analysis.
- `core/adapters`: parser capability negotiation and common adapter contracts.
- `core/pipeline`: explicit phase model, progress events, cancellation, and orchestration boundaries.
- `core/security`: content, limit, and privacy policy checks that expand in later steps.
- `core/hash`: portable path-identity SHA-256 now; full-byte streaming/incremental hashing boundary later.
- `core/manifest`: schema-v1 generator, deterministic IDs, canonical serializer, and cross-consistency validator.
- `core/output`: PDF, Markdown, sharding, download, and final cross-reference boundaries.

### Infrastructure

- `workers`: typed worker entry points and transferable messages.
- `schemas`: versioned JSON schemas and validators.
- Browser APIs: File API, drag-and-drop entries, optional File System Access API, Web Crypto, streams, workers, and optional OPFS.

## STEP-002 acquisition flow

```text
File input / directory picker / drag-and-drop / ZIP input
        ↓
FileCandidate/DirectoryCandidate records or ZIP central-directory inventory
        ↓
NFC + separator normalization + structural safety policy
        ↓
Disposable BlobByteSource / ZipEntryByteSource
        ↓
Validated flat VirtualFile collection
        ↓
Directory-first immutable VFS tree
        ↓
Metadata-only ImportSessionSnapshot for React
```

## Path contract

The normalized path is relative to the virtual root and uses `/` separators. The importer:

- normalizes Unicode to NFC;
- treats `\\` as a separator;
- removes empty and `.` segments;
- rejects Unix, drive-letter, and UNC absolute paths;
- rejects every `..` segment rather than resolving it;
- rejects control characters, excessive depth, and excessive length;
- rejects exact normalized duplicates and file/directory prefix conflicts.

The original path remains on each file for traceability. No normalized path is written to the host filesystem.

## ZIP memory and security model

- Compressed archive size is checked before reading.
- The central directory is validated before tree construction.
- Entry count, per-entry logical bytes, cumulative logical bytes, and compression ratio are bounded.
- Encryption, unsupported methods, ZIP64, and multi-volume archives are blocked with explicit issues.
- Explicit ZIP directory entries are retained, including empty directories, after the same path validation.
- Approved file entries retain the original archive `File` and decompress only when their byte source is read.
- Nested archives are ordinary files in STEP-002 and are not recursively expanded.

Default limits are configuration constants, not universal product promises. User-facing configuration and preflight estimates arrive in STEP-003/009.

## Adapter contract

The baseline adapter contract separates support decision, inspection, extraction, optional rendering, progress, abort, and disposal. STEP-003 assigns preflight capability levels without claiming that a production conversion adapter has completed work.

## STEP-003 preflight flow

```text
VirtualFileSystem + import issues
        ↓
up to 4 bounded readPrefix() operations
        ↓
signature + container extension + local registry + text heuristic
        ↓
capability A–E + adapter owner + risk signals
        ↓
per-file PDF/Markdown/manifest estimate ranges
        ↓
project totals + advisory output-mode recommendation
        ↓
metadata-only PreflightReport
        ↓
separate manual/glob selection state for UI and later manifest input
```

Classification precedence is conservative: known executable signatures override extensions; Office ZIP/OLE containers may be refined by an expected extension; a text extension is rejected when the sample is binary; declared browser MIME is only a fallback and is never authoritative.

The current signature budget is 16 KiB per file with four concurrent reads. Both are configurable policy values. A failed sample becomes an isolated E record rather than aborting the report. `AbortSignal` stops the run without converting cancellation into a file error.

Selection rules do not modify `VirtualFile`. Unsupported E records are excluded by default. Manual exclusion IDs and validated glob patterns are React metadata only and are reset when a new project replaces the VFS.

## Memory model

- VFS nodes share lazy byte-source references; they do not duplicate file buffers.
- React stores identifiers, metadata, issues, and bounded render snapshots only.
- Large parsing will run in workers with transferable buffers and concurrency limits.
- ZIP inventory currently reads one compressed archive into memory; approved entries are not retained decompressed.
- Preflight reads at most a configured prefix per file. ZIP prefix inflation is incremental; later full parsing remains worker work.
- Object URLs, workers, temporary canvases, and future buffers require explicit cleanup.

## Static hosting and network posture

Vite emits static assets and `VITE_BASE_PATH` supports GitHub Pages. Runtime dependencies are bundled. The application does not fetch document resources, remote fonts, telemetry, or parser code. CSP permits only self-hosted assets plus local blob/data resources where later required.

## Planned architecture gates

- STEP-004: deterministic manifest file IDs and versioned schema validation.
- STEP-010: worker queue, backpressure, cancellation, and cleanup.
- STEP-011: cross-output consistency and sharding.


## STEP-004 manifest flow

```text
VirtualFileSystem + PreflightReport + PreflightSelection
        ↓
path-sorted file/directory records
        ↓
SHA-256(namespace + node kind + normalized path)
        ↓
authoritative tree + parent/child maps + inclusion reasons
        ↓
pending integrity/conversion/output reference fields
        ↓
ManifestV1 object
        ↓
product-specific structural/cross-reference validation
        ↓
canonical recursively key-sorted JSON + byte count
```

Manifest creation is metadata-only. It reads no `ByteSource`, computes no original content hash, and retains no user bytes. React may hold the resulting JSON metadata artifact, but never browser `File`, archive buffers, or extracted content.

`generatedAt` is the only generator-created volatile field and is injectable. Browser-supplied `lastModified` remains source metadata. Canonical equality therefore means the same normalized paths, metadata, preflight facts, selection, settings, app/schema version, and timestamp.

## STEP-005 Markdown flow

```text
Validated Manifest v1 + live VFS
        ↓
Included text-capable records ordered by normalized path
        ↓
Bounded ByteSource.readPrefix(maxBytesPerFile, AbortSignal)
        ↓
Declared decoding (UTF-8/BOM/UTF-16 or controlled Windows-1252 fallback)
        ↓
LF normalization + optional line numbering + explicit truncation record
        ↓
Deterministic inert anchor + collision-safe Markdown fence
        ↓
UTF-8 byte-aware file sections and part grouping
        ↓
Manifest representation/output/sharding enrichment
        ↓
Cross-validation of anchors, parts, bytes, statuses, and references
```

`src/core/markdown` owns this flow. The text adapter never calls the unbounded `ByteSource.read()` path. It hashes original bytes only when the bounded read returned the complete file. Truncated files preserve `pending` integrity rather than hashing a prefix as if it were the original.

The generator currently processes files sequentially and yields cooperatively between reads. This is an explicit STEP-005 baseline for deterministic progress and bounded memory; STEP-010 will move costly work behind typed workers and a limited-concurrency queue.

## Markdown artifact ownership

The complete `MarkdownBundle` is held in an application ref alongside the live VFS. React state receives only `MarkdownArtifactSnapshot`, containing counts, part metadata, validation state, and at most 6,000 preview characters. Re-import, preflight changes, or manifest regeneration invalidate the downstream artifact.

Anchors are serialized as inert HTML comments in the downloadable Markdown source. They are never inserted into the application DOM as HTML: the preview uses React text content inside `<pre>`. User paths and metadata are Markdown-escaped, while file content is isolated inside dynamically sized fenced blocks.


## STEP-006 spreadsheet flow

```text
Validated Manifest v1 + live XLSX/XLSM VirtualFile
        ↓
whole-workbook byte ceiling + AbortSignal
        ↓
ZIP inventory with safe OOXML paths and entry/XML budgets
        ↓
selected package parts only; no external relationships
        ↓
UTF-8 XML parser with DTD/entity rejection
        ↓
Workbook model: sheets, cells, formulas/cache, styles/dates, comments, merges, names, feature flags
        ↓
bounded semantic Markdown + deterministic file anchors/parts
        ↓
lazy bounded pdf-lib spreadsheet preview
        ↓
Manifest adapter/integrity/representation enrichment and cross-validation
```

`src/core/spreadsheet` owns package filtering, XML safety, coordinate parsing, workbook extraction, semantic rendering, and preview-page generation. The adapter supports only XLSX/XLSM packages selected by preflight. XLS and ODS do not enter this parser.

Formulas and cached values are separate fields. AI Bundle Studio never evaluates formulas, opens VBA, follows workbook external relationships, refreshes connections, or recalculates a workbook. Formula-like literal strings are prefixed in the derived representation and flagged; original bytes remain unchanged.

The complete workbook models and `Uint8Array` PDF preview stay in the same application ref as the Markdown bundle. React receives counts and byte/page metadata only. `pdf-lib` is dynamically imported when at least one workbook requires a preview, so the initial application chunk does not include the PDF generator.


## STEP-007 PDF, image, and documents flow

```text
Validated Manifest v1 + live VFS
        ↓
selected PDF/image/spreadsheet records in normalized-path order
        ↓
PDF: bounded local byte read → PDF.js page/text inspection → original bytes retained
Image: bounded byte read → header dimensions/orientation/animation → pre-decode limits
        ↓
semantic Markdown records + SHA-256 for complete reads
        ↓
visual preparation
  PDF: pdf-lib copyPages from original document
  image: direct PNG/JPEG embed or bounded browser-native PNG derivation
  spreadsheet: reuse bounded STEP-006 preview pages
        ↓
cover + instructions + index + separators + content + final report
        ↓
strict global page-budget fitting
        ↓
Manifest PDF page/part enrichment + cross-validation
```

`src/core/pdf` owns PDF.js inspection and text extraction. Parser configuration receives local `Uint8Array` data only, disables worker fetch and eval support, and never provides a URL. Password callbacks terminate the task and return an explicit per-file error.

`src/core/image` owns header parsing, dimension policy, orientation-aware sizing, direct embedding decisions, and browser-native PNG derivation. Dimensions and megapixels are validated before `createImageBitmap` or canvas allocation. SVG remains inert source text and is not visually rendered before the sanitization steps.

`src/core/output` owns the visual documents artifact, page records, file records, page-budget fitting, manifest enrichment, and cross-validation. The complete `Uint8Array` remains in the application artifact ref. React state contains only page counts, byte counts, validation state, file totals, and a bounded Markdown preview.

The output PDF is generated in memory and is not downloadable until STEP-011. Its SHA-256 therefore remains `null`, while per-file original hashes are computed only after complete local reads.


## STEP-008 Office document flow

```text
Validated Manifest v1 + live DOCX/DOCM/PPTX/PPTM VirtualFile
        ↓
whole-document ceiling + AbortSignal
        ↓
OOXML ZIP inventory: safe paths, entry count, entry bytes, total uncompressed bytes, selected XML/media budgets
        ↓
DOCX                                  PPTX
Mammoth browser conversion            PresentationML relationship graph
externalFileAccess=false              slide order + slide/notes XML
inert image converter                 text + tables + safe media inventory
        ↓                              ↓
strict semantic HTML allowlist         explicit unsupported-feature inventory
        ↓                              ↓
semantic Markdown + metadata + macro/external warnings
        ↓
bounded Office preview PDF
  DOCX: text windows + supported images
  PPTX: one simplified landscape page per slide
        ↓
visual documents PDF + Manifest page/part/status enrichment
```

`src/core/office` owns OOXML package safety, metadata, DOCX extraction, HTML sanitization, PPTX fallback, and Office preview generation. The sanitizer reconstructs a new inert document from an allowlist and never mutates or mounts Mammoth output. Link targets remain plain textual metadata; scripts, event handlers, style, forms, objects, SVG/MathML, unknown elements, and remote resource URLs are not preserved as active markup.

PPTX relationships marked external are counted but never resolved. Macro binaries, charts, embedded objects, audio/video, transitions, and animations are identified from package inventory where possible and never opened or executed. The complete assets, source bytes, sanitized HTML string, and preview PDF stay outside React state; the UI receives only a bounded snapshot.

## STEP-009 security and resilience flow

```text
Extracted local representation + normalized path
        ↓
bounded file-name and content scanner
        ↓
category-only findings with offsets, line/column, severity and confidence
        ↓
selected policy
  report-only → preserve derived content and report findings
  redact      → replace merged content intervals with typed placeholders
  exclude     → remove the file from Markdown and visual output
        ↓
security summary + per-file manifest record
        ↓
manifest/Markdown/PDF cross-validation
```

`src/core/security` owns the scanner, policy validation, overlap merging, redaction and aggregate summaries. The scanner retains no matched value: findings contain only deterministic local IDs, categories, positions, severity, confidence and a generic description. File-name findings never fabricate content intervals.

Scanning is bounded by character, finding and candidate-length limits. High-entropy matching is optional and explicitly described as heuristic because false positives are possible. The original `ByteSource` is never mutated; redaction applies only to derived text.

Visual redaction is deliberately conservative. When a non-text representation contains a secret that cannot be reliably redacted at the visual layer, the corresponding visual representation is omitted and the manifest records that omission. Excluded files use the explicit `excluded-secret-policy` inclusion reason and cannot retain Markdown anchors or PDF page references.

The React shell is wrapped by a privacy-preserving error boundary. It never logs exception details, releases the current in-memory import session on reset and returns to the introduction screen. STEP-010 will move expensive scanners and parsers behind typed workers and enforce execution-time budgets in addition to the current input/result limits.
