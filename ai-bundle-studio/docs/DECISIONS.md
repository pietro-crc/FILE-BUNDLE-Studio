# Architecture Decision Record Log

## ADR-0001 — Repository and product name

**Status:** Accepted, 2026-07-20
**Decision:** Use `ai-bundle-studio` as the package and repository directory name and “AI Bundle Studio” as the product name.
**Reason:** Clear purpose, stable naming, and GitHub Pages-friendly slug.

## ADR-0002 — Browser-only static architecture

**Status:** Accepted
**Decision:** No backend, database, account, analytics, cloud conversion, or server secret.
**Consequences:** Processing is constrained by browser memory and APIs; the UX must expose those limits rather than hiding them.

## ADR-0003 — Strict TypeScript with exact versions

**Status:** Accepted
**Decision:** Pin production and development dependencies exactly. Use TypeScript 6.0.3, not TypeScript 7.0.2, because the selected TypeScript lint ecosystem declares support below 6.1.
**Consequences:** Updates are deliberate and reviewed; Dependabot-style automation can be added later.

## ADR-0004 — Parser probes remain outside production source

**Status:** Accepted
**Decision:** Keep STEP-000 proof code under `spikes/browser` and build it separately.
**Reason:** Establish feasibility without accidentally presenting incomplete conversion code as product behavior.

## ADR-0005 — Observable adapter lifecycle

**Status:** Accepted
**Decision:** Use distinct support, inspect, extract, optional render, progress, abort, and dispose concepts.
**Reason:** Partial conversion, security warnings, and cleanup cannot be modeled honestly by one opaque conversion call.

## ADR-0006 — XLSX dependency not yet approved

**Status:** Accepted
**Decision:** Use a minimal direct OOXML probe for STEP-000 only. Do not ship it as the spreadsheet adapter.
**Reason:** The authoritative SheetJS CE package is distributed from its own CDN; the environment could not fetch the tarball. ExcelJS 4.4.0 was tested and removed because the runtime audit reported two moderate vulnerabilities and multiple deprecated transitive packages.

## ADR-0007 — E2E workaround is environment-specific

**Status:** Accepted
**Decision:** In this container, inject the compiled bundle into a blank Chromium page because browser policy blocks localhost and file navigation.
**Consequences:** The test still exercises the minified artifact and verifies no network requests, but full navigation and GitHub Pages base-path behavior must run in CI with Playwright-managed browsers.

## ADR-0008 — No routing dependency for the initial shell

**Status:** Accepted, 2026-07-20
**Decision:** Use a typed local workflow state for STEP-001 navigation instead of adding a client router.
**Reason:** The shell has no deep-link or browser-history requirement yet, and routing should not be coupled prematurely to unfinished processing state.
**Revisit:** Add routing only when a real static-host-compatible URL requirement exists.

## ADR-0009 — CSS-token design system without a UI framework

**Status:** Accepted, 2026-07-20
**Decision:** Build semantic components on native HTML and CSS custom properties.
**Reason:** This keeps the initial bundle small, avoids styling lock-in, and provides direct control over accessibility and GitHub Pages behavior.

## ADR-0010 — Unfinished features are disabled, not simulated

**Status:** Accepted, 2026-07-20
**Decision:** Render future controls as disabled and identify their owning roadmap step.
**Reason:** The product must never imply that import, processing, or downloads work before their implementation and tests exist.

## ADR-0011 — Theme state is session-local in STEP-001

**Status:** Accepted, 2026-07-20
**Decision:** Support system, light, and dark themes without persistence.
**Reason:** Persistence is not needed to validate the design system and should be considered with PWA/storage policy rather than introduced incidentally.

## ADR-0012 — Lazy byte sources remain outside React state

**Status:** Accepted, 2026-07-20
**Decision:** Keep the active `VirtualFileSystem` in an application ref and expose only a metadata-only snapshot to React rendering.
**Reason:** Browser `File`, `Blob`, archive bytes, and future parser buffers must not be duplicated through component state or serialization.
**Consequences:** Replacing or clearing an import explicitly disposes every byte source. Session IDs are internal and are not the deterministic manifest IDs planned for STEP-004.

## ADR-0013 — Defensive path normalization precedes tree construction

**Status:** Accepted, 2026-07-20
**Decision:** Normalize Unicode to NFC, canonicalize backslashes, remove empty and `.` segments, and reject absolute paths, `..`, control characters, excessive depth/length, duplicate normalized paths, and file-directory hierarchy conflicts.
**Reason:** The VFS must never silently overwrite or reinterpret attacker-controlled names.
**Consequences:** Rejected entries remain visible as issues but do not enter the tree. No filesystem write is performed.

## ADR-0014 — ZIP inventory first, lazy entry extraction second

**Status:** Accepted, 2026-07-20
**Decision:** Read the compressed archive once for central-directory inventory and policy checks, then represent approved entries with `ZipEntryByteSource` objects that decompress only the requested entry on `read()`.
**Reason:** Eagerly retaining every uncompressed entry would violate the memory model. Inventory metadata is sufficient for the STEP-002 tree.
**Consequences:** Repeated reads can decompress the same entry more than once until worker/cache policy is designed. ZIP64, multi-volume archives, encryption, and unsupported compression methods are blocked rather than guessed.

## ADR-0015 — Progressive directory acquisition

**Status:** Accepted, 2026-07-20
**Decision:** Prefer `showDirectoryPicker()` when available, retain a `webkitdirectory` input fallback, and traverse dropped directory entries through the legacy drag-and-drop entry API when exposed.
**Reason:** No single directory API is portable across all target desktop browsers.
**Consequences:** File System Access and legacy dropped-directory traversal preserve explicit empty directories. The `webkitdirectory` fallback exposes files only and therefore cannot preserve empty directories. Feature detection and full browser-matrix verification remain required and are deferred to STEP-014.

## ADR-0016 — One active import session

**Status:** Accepted, 2026-07-20
**Decision:** A new acquisition replaces and disposes the current project rather than merging implicitly.
**Reason:** Merge semantics create unresolved path collisions and provenance questions that belong in a later explicit UX decision.
**Consequences:** The UI states this behavior before selection and offers a clear-project action.

## ADR-0017 — Bounded prefix reads are part of the byte-source contract

**Status:** Accepted, 2026-07-20
**Decision:** Every `ByteSource` implements `readPrefix(maxBytes, signal)` in addition to a full read.
**Reason:** MIME/signature preflight must not allocate an entire large file merely to inspect a header.
**Consequences:** Browser blobs use `Blob.slice`. ZIP entries retain central-directory offsets and read only their compressed range; deflated entries stream ordered compressed chunks and stop once the requested output prefix is available. Full reads remain explicit adapter operations.

## ADR-0018 — Focused local capability registry instead of a MIME runtime dependency

**Status:** Accepted, 2026-07-20
**Decision:** Use a reviewed local registry plus bounded magic-number and text heuristics for STEP-003; add no MIME library.
**Reason:** The required baseline formats can be classified with a small transparent implementation, while a general signature package would add bundle weight and still require product-specific capability and risk policy.
**Consequences:** Coverage is intentionally finite and tested. Unknown text degrades to B, unknown binary to D, and executable signatures to E. The support matrix is the product truth, not the file extension.

## ADR-0019 — Preflight report and selection do not mutate the VFS

**Status:** Accepted, 2026-07-20
**Decision:** Keep classification records and user exclusions in separate metadata-only state keyed by the current session file IDs.
**Reason:** Filtering and configuration must not rewrite original paths, status, byte sources, or archive metadata.
**Consequences:** Re-import resets report and selection. STEP-004 will map this session state into deterministic manifest IDs without reusing sequence-based VFS IDs as authoritative identifiers.

## ADR-0020 — Estimates are ranges and recommendations are advisory

**Status:** Accepted, 2026-07-20
**Decision:** Estimate PDF, Markdown, manifest, and peak working memory as min/max ranges with low or medium confidence.
**Reason:** Output size depends on later adapters, rendering, images, tables, truncation, and sharding; a single precise number would be misleading.
**Consequences:** Thresholds are policy inputs rather than universal promises. High-risk or very large projects may receive an “Anteprima rapida” recommendation, but the recommendation is not a completed conversion decision.


## ADR-0021 — Manifest IDs are path-derived SHA-256 values

**Status:** Accepted, 2026-07-20
**Decision:** Derive each manifest file/directory ID from a fixed schema namespace, node kind, and NFC-normalized relative path using SHA-256.
**Reason:** VFS IDs contain acquisition sequence and source details and are not stable across equivalent imports. Full original-byte hashes are not available during metadata-only manifest construction.
**Consequences:** Renaming a path intentionally changes the ID. File and directory namespaces cannot collide. A later original-byte hash remains a separate integrity field.

## ADR-0022 — Portable local SHA-256 for deterministic node identity

**Status:** Accepted, 2026-07-20
**Decision:** Use a small reviewed SHA-256 implementation for short identifier inputs rather than requiring `crypto.subtle`.
**Reason:** The compiled E2E environment correctly exposed that Web Crypto may be unavailable on non-secure `about:blank` or `file:` contexts. Deterministic identity must not vary with browser security context.
**Consequences:** Standard vectors are tested. Large original-file hashing will use the dedicated hashing/worker design and is not performed by this identifier helper.

## ADR-0023 — Product-specific manifest validator without a runtime schema dependency

**Status:** Accepted, 2026-07-20
**Decision:** Publish JSON Schema Draft 2020-12 for interoperability and ship a focused local validator for runtime structure and cross-reference invariants.
**Reason:** A general schema engine would increase the initial bundle while still requiring custom checks for tree coverage, parents, counts, output mappings, and inclusion consistency.
**Consequences:** Schema and validator version alignment is tested. Revisit a standards-complete validator if external manifest import or third-party schemas become a product requirement.

## ADR-0024 — Pending fields are explicit, never fabricated

**Status:** Accepted, 2026-07-20
**Decision:** Represent original hashes, adapter versions, Markdown anchors, PDF pages, output parts/hashes, conversion results, and applied sharding as pending, null, empty, planned, or not-started until their owning steps run.
**Reason:** Manifest v1 must be authoritative without falsely claiming work that has not occurred.
**Consequences:** STEP-005 onward enrich the same contract and must preserve validator compatibility or version the schema.

## ADR-0025 — No new runtime dependency for text and Markdown

**Status:** Accepted, 2026-07-21
**Decision:** Implement decoding, safe fences, UTF-8 byte chunking, anchors, sharding, and cross-validation as small local modules using browser standards.
**Reason:** The required behavior is product-specific and compact; a Markdown renderer or generator library would not remove the need for delimiter, metadata, byte-budget, and manifest-reference policy.
**Consequences:** The implementation is intentionally narrow and fixture-driven. It produces source Markdown but does not render untrusted Markdown or HTML in the browser.

## ADR-0026 — Derived text normalizes line endings and declares the change

**Status:** Accepted, 2026-07-21
**Decision:** Normalize CRLF and CR to LF in the semantic Markdown representation while preserving original bytes untouched.
**Reason:** Stable logical output and deterministic line counting are more useful for AI analysis than retaining platform-specific terminators.
**Consequences:** Every extracted record declares `newlineNormalization: lf`; BOM removal, fallback, replacement characters, and truncation are recorded separately.

## ADR-0027 — Hash only complete original reads

**Status:** Accepted, 2026-07-21
**Decision:** Populate an original SHA-256 during STEP-005 only when the adapter read all original bytes; never hash a truncated prefix as the original file.
**Reason:** The manifest integrity field must remain authoritative.
**Consequences:** Small complete text files receive a computed hash. Files truncated by the configured byte limit remain pending until a later full-byte hashing pipeline runs under worker/resource controls.

## ADR-0028 — Inert deterministic anchors and byte-bounded sharding

**Status:** Accepted, 2026-07-21
**Decision:** Derive section anchors from stable manifest file IDs, serialize them as inert comments, and split output by UTF-8 byte ceilings without splitting metadata from its fenced content.
**Reason:** AI uploads need stable cross-references and safe multipart boundaries. Heading slugs are renderer-dependent and character counts do not equal uploaded byte sizes.
**Consequences:** The manifest declares every part and anchor. Validation requires each anchor exactly once, part sizes within policy, and record/output/sharding mappings to agree.


## ADR-0029 — Focused OOXML spreadsheet adapter without a new dependency

**Status:** Accepted, 2026-07-21
**Decision:** Implement the STEP-006 production baseline for XLSX/XLSM as a narrow local parser over selected SpreadsheetML parts, using the already pinned `fflate` dependency.
**Reason:** Official SpreadsheetML defines the required workbook/cell/formula structures. SheetJS remains technically capable, but its authoritative tarball distribution outside the public npm registry complicates lockfile provenance, integrity verification, auditing, and bundle governance for this step. XLS/ODS breadth does not justify weakening the supply-chain gate.
**Consequences:** XLSX/XLSM receive tested level B extraction. XLS and ODS remain level D. The parser must not grow into a universal office implementation; unsupported features remain inventory/warnings and new parts require fixtures plus security review.

## ADR-0030 — Formula source and cached value remain separate and inert

**Status:** Accepted, 2026-07-21
**Decision:** Store formula text separately from the cached value present in the workbook, never calculate it, and never refresh external data or connections.
**Reason:** SpreadsheetML can contain formula source and a previously calculated cached value. Evaluating formulas would create code-like behavior, nondeterminism, external-data risk, and false confidence in workbook freshness.
**Consequences:** Markdown labels formulas and cache values independently. The UI warns that caches may be stale. Macro-enabled packages are detected, but VBA is never opened or executed.

## ADR-0031 — Derived spreadsheet preview is bounded and explicitly non-fidelity

**Status:** Accepted, 2026-07-21
**Decision:** Build a paginated table preview from the extracted workbook model with row/column windows and lazy `pdf-lib`, rather than attempting an Excel-compatible renderer.
**Reason:** Browser-only faithful spreadsheet rendering would add substantial complexity and still fail on charts, pivots, conditional formatting, embedded objects, page setup, and proprietary behavior. The product contract prioritizes AI readability and transparent degradation.
**Consequences:** The preview records page windows and warnings, uses portrait or landscape according to width, and stays separate from the final document PDF until STEP-007/011.


## ADR-0032 — Separate PDF inspection from original-page import

**Status:** Accepted, 2026-07-21
**Decision:** Use PDF.js for local page/text/security inspection and `pdf-lib` for original-page copying and final PDF assembly.
**Reason:** Text extraction and page copying are different capabilities. Rasterizing all PDFs would lose vector text, enlarge outputs, and reduce fidelity, while `pdf-lib` alone does not provide semantic text extraction.
**Consequences:** Both libraries remain lazy chunks. Source PDF bytes are retained only in the active artifact, page text and page geometry are recorded separately, and malformed/encrypted documents fail per file.

## ADR-0033 — Validate image dimensions before browser decode

**Status:** Accepted, 2026-07-21
**Decision:** Parse dimensions, orientation, animation, and basic transparency from bounded format headers before invoking `createImageBitmap` or canvas.
**Reason:** Browser decoding can allocate large surfaces before application code can react. Extension or MIME checks alone do not defend against decompression bombs.
**Consequences:** Oversized or malformed images are rejected before decode. Direct PNG/JPEG embedding avoids unnecessary canvas work; other supported browser formats may degrade to metadata when decoding is unavailable.

## ADR-0034 — The documents PDF has an absolute page ceiling

**Status:** Accepted, 2026-07-21
**Decision:** Fit visual entries sequentially within a configurable global page budget that includes cover, instructions, index, separators, content, and report pages.
**Reason:** A per-file limit alone cannot prevent a project with many acceptable files from producing an impractically large PDF.
**Consequences:** A final file may be partially represented and later entries may be omitted. The PDF never exceeds the ceiling; warnings and manifest mappings reflect exactly what was included.

## ADR-0035 — Keep complete visual artifacts outside React state

**Status:** Accepted, 2026-07-21
**Decision:** Store source PDF/image assets and the final documents `Uint8Array` in the existing application artifact ref, exposing only bounded snapshots to React.
**Reason:** Large binary buffers in component state increase retention, copying, rerender cost, and accidental disclosure risk.
**Consequences:** Re-import or upstream configuration invalidates the ref. Download and output hashing will consume the same artifact in STEP-011 without duplicating it into serializable UI state.


## ADR-0036 — Mammoth is a semantic DOCX parser, not a trust boundary

**Decision:** Use the already pinned Mammoth browser build for DOCX semantic conversion only after local OOXML resource checks. Set `externalFileAccess: false`, supply an inert image converter, and pass every HTML result through AI Bundle Studio’s strict allowlist sanitizer before storage or transformation.

**Consequences:** Headings, paragraphs, lists, tables, links, images, and parser messages are available without claiming Word fidelity. Mammoth output is never inserted as application HTML. Pathological documents remain bounded by package, XML, text, HTML, image, and total-uncompressed limits; worker watchdogs remain STEP-010.

## ADR-0037 — Office HTML uses a purpose-built semantic allowlist in STEP-008

**Decision:** Do not add DOMPurify in STEP-008 because the application does not render arbitrary sanitized HTML. Build a narrow transformer that recreates only known semantic elements, copies only table spans, inert image references, and textual link destinations, and drops active/unknown content.

**Consequences:** The sanitizer is smaller, auditable, fixture-backed, and intentionally unsuitable as a general HTML rendering library. If a future UI renders Office HTML or SVG, DOMPurify or an equivalent maintained sanitizer must be reconsidered with browser/security tests.

## ADR-0038 — PPTX fidelity degrades to PresentationML semantics

**Decision:** Parse PPTX/PPTM package relationships directly to preserve slide order, DrawingML text, speaker notes, tables, safe image inventory, and metadata. Produce one simplified derived page per slide; never imply faithful PowerPoint rendering.

**Consequences:** Macros, external links, charts, SmartArt, animations, transitions, embedded objects, and audio/video are detected or inventoried but never executed, fetched, opened, or played. Unsupported features make the result partial and remain visible in Markdown and Manifest v1.


## ADR-020 — Bounded local secret scanning with explicit handling modes

**Decision.** Implement a dependency-free scanner over derived text with three user-visible modes: `report-only`, `redact`, and `exclude`. The scanner uses bounded known-pattern checks plus an optional entropy heuristic. A finding stores only category, severity, confidence, offsets, line/column, and a generic description. It never stores the matched value.

**Rationale.** Secret scanning is heuristic and must remain transparent. Report-only preserves complete derived content, redact removes matched intervals only from derived text, and exclude removes the entire flagged file from derived outputs. The original `File`/ZIP bytes are immutable.

**Consequences.** False positives remain possible, especially for entropy signals. The UI exposes mode, counts, truncation, and warnings. A filename-only signal cannot redact content. Non-text visual representations are omitted only when a content finding was actually redacted, because trustworthy region-level redaction is outside this step.

## ADR-021 — Security evidence is aggregate and non-secret

**Decision.** Extend Manifest v1 with per-file security state and a project summary, but never include raw matches, excerpts, hashes of matches, or exception payloads. Category counts represent the number of files containing each category, not occurrence counts.

**Rationale.** The manifest must explain exclusions and redactions without becoming another secret-bearing artifact. Exact occurrence metadata remains only in the in-memory report used to apply redaction and is discarded with the session.

## ADR-022 — Privacy-preserving error isolation

**Decision.** Add a React error boundary that shows a generic recovery screen, logs no exception details, disposes the current VFS/artifacts through the existing reset path, and returns to the introduction.

**Rationale.** Parser exceptions can include file paths or extracted text. A conventional console log would violate the project’s no-leak posture. Detailed diagnostics can be added later only through an explicit user-controlled redacted export.
