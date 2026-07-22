# STEP-007 Report — PDF and images

## Scope

STEP-007 activates production PDF and image processing and assembles the first validated `<project>-documents.pdf` artifact. It does not implement download, output hashing, PDF multipart sharding, worker orchestration, OCR, SVG sanitization, DOCX rendering, or faithful Office layout.

## Implementation

### PDF adapter

`src/core/pdf` reads only local VFS bytes and uses PDF.js to record:

- page count;
- imported-page count after policy limits;
- page width, height, and rotation;
- per-page text;
- page/total text truncation;
- embedded JavaScript presence;
- SHA-256 after a complete read;
- warnings and per-file failure.

The parser receives no URL. Worker fetch and eval support are disabled. A password callback terminates the task and returns an explicit protected-document error; the application never asks for, guesses, or bypasses a password.

### Image adapter

`src/core/image` inspects format headers before decode for:

- PNG;
- JPEG with EXIF orientation;
- GIF;
- WebP VP8X, VP8L, and VP8;
- BMP;
- TIFF.

Before `createImageBitmap` or canvas, the adapter enforces maximum compressed bytes, dimensions, and megapixels. Normal PNG/JPEG assets are embedded directly when orientation/downsampling is unnecessary. Other browser-decodable images are orientation-corrected and converted to a bounded PNG representation. Animated images declare that only the first frame is represented. SVG is not rendered before sanitization.

### Documents PDF

`src/core/output` creates a standard multipage PDF containing:

1. cover;
2. concise instructions for the AI assistant;
3. a textual index with output page numbers;
4. a separator page for every represented file;
5. original PDF pages copied through `pdf-lib` when possible;
6. derived image pages;
7. bounded spreadsheet preview pages from STEP-006;
8. isolated error pages;
9. a final completeness report.

An absolute page ceiling includes every page category. Entries are accepted in normalized-path order. The final accepted entry can be truncated, and later entries can be omitted, but the artifact cannot exceed the configured ceiling.

### Manifest and ownership

Manifest v1 records:

- adapter ID/version;
- visual conversion status;
- output part name;
- actual output page numbers;
- source PDF/preview page to output-page mappings;
- warnings and errors;
- generated documents-family status.

A separate validator checks page sequence, page count, byte length, page limit, file existence, record/manifest status, page references, part references, and manifest validity.

Source PDF/image assets and the final `Uint8Array` remain in the application artifact ref. React state receives only counts, bytes, validation status, and a bounded Markdown preview.

## Dependency decision

No package was added. STEP-007 activates the already pinned:

- `pdfjs-dist` for local PDF inspection and text extraction;
- `pdf-lib` for original-page copying and visual PDF assembly.

Image format inspection is local application code. Browser-native bitmap/canvas APIs are progressive enhancements, not the sole inventory path.

## Security review

Verified controls:

- no document URLs or remote resource fetch;
- no password bypass;
- PDF file/page/text limits;
- image byte/dimension/megapixel checks before decode;
- SVG visual rendering disabled;
- per-file parser failure isolation;
- JavaScript inventory without execution;
- direct image embedding restricted to PNG/JPEG;
- final PDF page ceiling;
- no user bytes in React state;
- no runtime network request in compiled Chromium E2E;
- runtime and full dependency audit with zero known vulnerabilities.

Residual risks remain browser/parser vulnerabilities, cooperative main-thread execution, limited image-codec coverage, lack of parser watchdogs, and incomplete adversarial corpus. STEP-009, STEP-010, and STEP-014 own those controls.

## Tests

The final regression set includes:

- harmless PNG and WebP header fixtures;
- a harmless 50,000 × 50,000 PNG header rejected before decoder invocation;
- direct PNG embedding and manifest page mapping;
- six-page source PDF truncated to a strict eight-page final artifact;
- source/output page mapping validation;
- compiled two-page PDF text extraction plus PNG representation;
- harmless password-protected PDF isolation;
- zero observed HTTP/HTTPS requests;
- mobile-width no-overflow coverage retained from earlier steps.

## Benchmark

Synthetic fixture:

| Metric | Value |
|---|---:|
| Source PDF | 25 pages, 11,845 bytes |
| PNG images | 8 |
| Output PDF | 46 pages, 28,585 bytes |
| Assembly time | 63.75 ms |

This is a single-container diagnostic. It excludes PDF.js semantic extraction, real photographs, large images, slow storage, and worker transfer cost.

## Build result

Production code splitting after STEP-007:

- application entry: approximately 370.76 kB, 113.23 kB gzip;
- lazy spreadsheet preview support: approximately 420.07 kB;
- lazy PDF.js parser: approximately 425.28 kB;
- bundled PDF.js worker: approximately 1.17 MB;
- lazy `fflate`: approximately 7.92 kB.

The PDF parser/worker warning is expected and documented. These chunks do not enter the initial application entry until their capability is used.

## Open items

- PDF/image work still runs cooperatively on the main thread.
- OCR is not implemented.
- GIF/WebP animation is represented by one frame only.
- TIFF/GIF/WebP/BMP visual decode depends on the browser.
- SVG remains source-only until sanitization.
- final PDF byte sharding and output SHA-256 are STEP-011.
- download remains disabled until STEP-011.
