# STEP-002 Report — Input and virtual filesystem

Date: 2026-07-20

## Scope completed

STEP-002 activates local acquisition and builds the first production virtual filesystem. It does not classify MIME signatures, assign support levels, parse document content, or generate outputs.

Implemented:

- explicit ZIP picker;
- multiple-file picker;
- directory picker through File System Access API with `webkitdirectory` fallback;
- drag-and-drop for files and directory entries when the browser exposes the legacy entry API;
- preservation of explicit empty directories when File System Access, legacy directory entries, or ZIP expose them;
- automatic expansion of a single explicitly dropped/selected ZIP;
- lazy disposable byte sources for `Blob` and ZIP entries;
- path normalization and structural collision checks;
- immutable directory-first VFS tree;
- metadata-only React snapshot and bounded 300-node preview;
- acquisition summary, live status, issues, clear/replace behavior;
- ZIP central-directory inventory and safety limits;
- unit, integration, E2E, responsive, visual, audit, and build coverage.

## Security controls

Path handling rejects:

- `..` traversal at any depth;
- Unix absolute, drive-letter, and UNC paths;
- null and other control characters;
- overlong and overdeep paths;
- duplicate paths after NFC/separator normalization;
- file/directory hierarchy collisions such as `a` plus `a/b.txt`.

ZIP handling rejects or excludes:

- archives above the compressed-size policy;
- excessive entry counts;
- oversized individual entries;
- cumulative uncompressed size above policy;
- anomalous compression ratios;
- encrypted entries;
- unsupported compression methods;
- ZIP64 and multi-volume archives;
- malformed EOCD, central-directory, or local-header structures;
- unsafe entry paths.

No archive path is written to disk. Nested archives remain ordinary VFS files.

## Memory model

- The live VFS is stored in a React ref, not serializable component state.
- React receives a metadata-only snapshot without byte readers.
- `BlobByteSource` reads on demand and honors an already-aborted signal or stream cancellation.
- `ZipEntryByteSource` retains the compressed browser `File` and extracts only the requested entry.
- Replacing, clearing, or unmounting disposes every active source.
- ZIP inventory still reads the compressed archive once; worker-backed inventory remains future optimization.

## UX and accessibility

- Import controls are native buttons and hidden native file inputs with accessible labels.
- Import status uses a polite live region.
- The drop area is a labeled region and provides picker alternatives.
- Summary metrics and issues are textual, not color-only.
- The tree uses native `details`/`summary` and is bounded to protect rendering.
- Desktop light and mobile dark compiled screenshots were reviewed.

Visual artifacts:

- `docs/screenshots/STEP-002-import-desktop.png`
- `docs/screenshots/STEP-002-import-mobile-dark.png`

## Final quality gate

`npm run quality` completed successfully:

- lint: 0 warnings and 0 errors;
- strict TypeScript: passed;
- Vitest: 8 files and 32 tests passed;
- format spike build: passed with the known parser-only large-chunk warning;
- production build: passed;
- Playwright Chromium: 2 E2E tests passed;
- runtime audit: 0 known vulnerabilities.

Production bundle after STEP-002:

- CSS: 22.10 kB minified / 4.51 kB gzip;
- application JavaScript: 232.59 kB minified / 72.28 kB gzip;
- lazy `fflate` browser chunk: 8.24 kB minified / 3.96 kB gzip.

No HTTP or HTTPS request was observed during compiled-app E2E. No new dependency was added.

## Deferred work

- MIME/signature classification, capability levels, estimates, filters, and risk UI: STEP-003.
- Manifest-stable deterministic IDs: STEP-004.
- Content decoding and adapters: STEP-005 onward.
- Recursive nested archives and expanded adversarial ZIP corpus: STEP-009.
- Worker-backed ZIP inventory/extraction queue and live cancellation UX: STEP-010.
- Full Firefox/WebKit directory behavior: STEP-014.
- Empty directories cannot be recovered from the `webkitdirectory` fallback because that API exposes files only.
