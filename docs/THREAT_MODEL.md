# Threat Model

## Assets

- Original user file bytes and names.
- Directory structure and metadata.
- Extracted text, formulas, document images, and hashes.
- Generated PDF, Markdown, manifest, and optional preservation ZIP.
- Browser availability and memory.
- Trust in the manifest's completeness and references.

## Trust boundaries

1. User-selected browser `File`/directory handles enter the application.
2. ZIP and Office containers expose attacker-controlled paths and structures.
3. Parser libraries process hostile binary and structured input.
4. Derived HTML/images cross into browser rendering.
5. Workers communicate with the UI thread through typed messages.
6. Generated artifacts leave the application through downloads.
7. A service worker will later cache only the app shell.

## Threats and mitigations

| Threat | Impact | Current mitigation / owner |
|---|---|---|
| Zip Slip, absolute paths, backslash traversal | Misleading tree, collisions, unsafe future writes | NFC and separator normalization; reject Unix/drive/UNC absolute paths and every `..`; implemented STEP-002 |
| Unicode equivalence and duplicate normalized paths | File confusion/overwrite | NFC normalization and duplicate rejection; implemented STEP-002; case policy metadata remains STEP-003/004 |
| File-directory hierarchy collision | Silent node replacement | Reject prefix conflicts such as `a` and `a/b`; implemented STEP-002 |
| Null bytes and control characters | Parser/path confusion | Reject C0 and DEL controls; implemented STEP-002; reserved platform names remain later hardening |
| Excessive path depth/length | UI and algorithmic abuse | Configurable depth and length policy; implemented STEP-002 |
| Zip bomb and file-count bomb | Memory/CPU denial of service | Compressed size, count, per-entry, cumulative logical bytes, and compression-ratio caps before VFS inclusion; implemented STEP-002; worker watchdog STEP-009/010 |
| Encrypted archive entries | Password bypass attempt/error cascade | Detect encryption flags in central and local headers, exclude, never bypass; implemented STEP-002 |
| Corrupt, ZIP64, multi-volume, unsupported-method archives | Crash or incorrect extraction | Validate EOCD, central directory, local headers; block unsupported containers/methods; implemented STEP-002 |
| Nested archive recursion | Exponential resource use | Nested archives remain ordinary files; recursion disabled by default; implemented STEP-002, optional bounded mode later |
| Misleading extension or declared MIME | Unsafe parser selection or false support claim | Bounded signatures and text heuristic outrank declared MIME; binary text-spoofing degrades; executable signatures force E; implemented STEP-003 |
| Signature sniffing of huge files | Memory exhaustion before preflight | `readPrefix` budget, four-reader concurrency, incremental ZIP prefix inflation, cancellation; implemented STEP-003; worker isolation STEP-010 |
| Pathological glob patterns | UI CPU denial of service | Safe generated regex subset, maximum 100 patterns/256 characters, bounded cache; implemented STEP-003 |
| Stale byte references | Retained sensitive memory | Dispose sources on replace, clear, and unmount; implemented STEP-002 |
| Malformed PDF/XML/Office packages | Parser crash or resource exhaustion | PDF file/page/text budgets active STEP-007; XLSX/XLSM package/XML limits active STEP-006; DOCX/PPTX package/XML/media/text/slide limits and per-file isolation active STEP-008; worker timeouts and wider corpus STEP-009/010 |
| XML entity expansion | CPU/memory/network access | Spreadsheet DTD/entity rejection active STEP-006; DOCX/PPTX DTD/entity rejection before parsing/conversion active STEP-008 |
| Active HTML/SVG/XSS | Code execution in preview | DOCX HTML is rebuilt through a strict inert allowlist and never mounted; active elements/attributes/links/remote resources removed STEP-008; SVG rendering remains deferred until a sanitizer-backed rendering boundary is implemented |
| Office macros and OLE objects | Code execution/social engineering | DOCM/PPTM/vbaProject plus PPTX embedded-object inventory; never open or execute STEP-008; expand OLE corpus STEP-014 |
| Formula/CSV injection | Dangerous downstream spreadsheet opening | Spreadsheet formulas are labeled inert text, cached values are separate, formula-like literals are prefixed only in derived output; implemented STEP-006, expanded corpus STEP-014 |
| Huge images/decompression bombs | Memory exhaustion | Header dimensions parsed before decode, byte/dimension/megapixel caps, bounded downsampling and direct-embed policy active STEP-007; worker rendering/adversarial corpus STEP-010/014 |
| Executable binary disguised as document/text | Arbitrary code execution or misleading output | PE/ELF/Mach-O/WASM signatures override extension, E and excluded by default; never execute; implemented STEP-003 |
| Worker denial of service | Frozen app/resource leak | Queue limits, abort, terminate, watchdog, cleanup; STEP-010 |
| Secret leakage in generated output | Credential exposure to AI | Optional scanner, exclude/redact preview, no secret values in manifest/log; STEP-009 |
| Remote document relationships | Network leakage | Spreadsheet external relationships blocked STEP-006; DOCX/PPTX external relationships counted and never resolved/fetched STEP-008 |
| Dependency compromise | Supply-chain compromise | Exact pins, lockfile, official sources, audit, license record, CI review; ongoing |
| Service worker stale or caching user content | Privacy/stale-code risk | App-shell allowlist, no user blobs in Cache Storage, update/reset; STEP-013 |
| Console/log leakage | Privacy loss | No user-content logging; metadata-only diagnostics policy; ongoing; STEP-009 error boundary and no-content-log checks active |
| Markdown delimiter/anchor injection | Broken sections or misleading references | Dynamic fences, inert deterministic anchors, escaped metadata, exact-occurrence validation; implemented STEP-005 |
| Output reference inconsistency | AI misinterpretation | Versioned manifest plus Markdown and documents page/part/status cross-validation; active STEP-004/005/007, output hashes and multipart validation STEP-011 |

## Abuse cases

- Archive with one million empty entries.
- Highly compressible multi-gigabyte logical payload.
- Central/local encryption-flag disagreement.
- Two visually identical Unicode paths.
- A file named `folder` combined with `folder/file.txt`.
- Office document containing external image relationships.
- SVG containing scripts, event attributes, and remote links.
- Spreadsheet cells beginning with `=`, `+`, `-`, or `@`.
- PDF with malformed cross-reference tables or password protection.
- Nested archives designed to exceed cumulative limits.

## Residual risks

Browser parser vulnerabilities and memory limits cannot be eliminated. ZIP inventory still reads a compressed archive once, preflight signature coverage is finite, recommendations are heuristic, browser directory APIs differ, and session IDs are not export-authoritative. STEP-008 text, spreadsheet, PDF, image, Office, and visual assembly work still runs cooperatively on the main thread; format limits reduce but cannot eliminate parser, decompressor, decoder, or pathological-document risk. Mammoth remains a third-party semantic parser and is not a security boundary. Windows-1252 fallback is not general charset detection, and cached spreadsheet formula values may be stale because no recalculation occurs. The product must communicate limits and degrade to inventory or exclusion when safe extraction is not possible.


## STEP-009 implemented mitigations

| Threat | Mitigation now active | Residual risk |
|---|---|---|
| Secrets in supported text/derived semantic output | Bounded local patterns, sensitive-name signals, optional entropy heuristic, report/redact/exclude modes | Unknown formats, obfuscated values, split tokens, and content beyond configured scan limits can be missed |
| Secret leakage through manifest/logs | Category/count-only manifest records; no matched values or excerpts; no production content logging | Paths are intentionally retained by the product contract and can themselves be sensitive |
| Overlapping findings and malformed redaction | Sorted interval merge, deterministic placeholders, preserved removed line breaks, fixture tests | Redaction changes semantic content and is not reversible from the artifact |
| Secrets in visual representations | Omit non-text visual asset after a content finding is redacted | No pixel/region redaction; metadata-only filename findings do not imply visual omission |
| Scanner denial of service | Character, candidate-length, finding-count, entropy, and regex-span limits; binary content is not scanned as text | Main-thread CPU contention remains until STEP-010 workers/watchdogs |
| UI/parser crash leaks | Generic error boundary, no exception logging, session disposal on recovery | Browser developer tooling or extensions remain outside the application trust boundary |
| CSV/formula injection | Formula-like spreadsheet literals are prefixed in derived output; formulas remain inert labelled text | A downstream tool that intentionally evaluates pasted content remains outside the browser app |
| XSS/active Office/SVG | Existing allowlist sanitizer and inert `<pre>` previews; active SVG remains non-rendered | General SVG rendering remains deferred |
