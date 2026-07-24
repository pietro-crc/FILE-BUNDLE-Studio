# STEP-004 Report — Manifest v1

## Scope

STEP-004 implements the first authoritative, machine-readable manifest contract. It does not generate PDF or Markdown content, compute original-byte hashes, shard outputs, or expose downloads.

## Delivered

- JSON Schema Draft 2020-12 document at `src/schemas/manifest-v1.schema.json`.
- Typed manifest model with schema version `1.0.0` and dedicated media type.
- Deterministic SHA-256 node IDs derived from node kind and normalized path, independent of VFS session IDs and acquisition order.
- Portable local SHA-256 implementation verified against standard empty-string and `abc` vectors, including non-secure browser contexts.
- Generator mapping VFS, preflight, import issues, risks, selection, estimates, limits, tree, directories, files, output placeholders, and sharding plan.
- Explicit inclusion reasons: selected, manually excluded, glob-excluded, or blocked by capability E.
- Original hashes represented honestly as SHA-256 `pending`; adapter versions, Markdown anchors, PDF pages, output parts, and output hashes remain unassigned.
- Canonical JSON serialization with recursively sorted object keys, stable sorted records, and trailing newline.
- Browser-side structural and cross-consistency validation.
- Configuration-screen manifest builder, validation result, bounded metadata-only JSON preview, and handoff from preflight.
- Golden, mutation, determinism, UI, E2E, and 1,000-file benchmark coverage.

## Manifest authority boundaries

The v1 baseline is authoritative for:

- original and normalized paths;
- deterministic node identity;
- input source and import issues;
- preflight type/capability/risk assessment;
- current inclusion decision and reason;
- project totals and configured policy;
- planned output mode and unassigned representation placeholders.

It is not yet authoritative for:

- original-file SHA-256 values;
- completed conversion status;
- Markdown anchors or output parts;
- PDF pages or output parts;
- final output hashes;
- parser/adapter implementation versions;
- applied sharding.

Those fields remain explicitly pending, not fabricated.

## Determinism

With identical normalized paths, metadata, preflight records, selection, settings, application version, and caller-supplied `generatedAt`, canonical JSON is byte-identical regardless of acquisition order or sequence-based VFS IDs.

Volatile boundaries are explicit:

- `generatedAt` defaults to the current UTC instant but is injectable for golden tests;
- `lastModified` is preserved from browser input and therefore participates in logical equality;
- original content hashes are pending until a later full-byte processing phase.

## Validation coverage

The local validator checks:

- schema and media versions;
- canonical UTC date and project-name bounds;
- instructions, settings, preflight policy, ranges, recommendation, and sharding state;
- unique file and directory IDs and paths;
- parent/child references and tree path identity;
- exact tree coverage;
- file metadata, capability, risk, adapter, representations, integrity, and inclusion state;
- file/directory/byte/capability/risk summary totals;
- output family uniqueness, kind, status, parts, and hashes.

## Benchmark

Synthetic fixture: 1,000 small TypeScript files in 20 source folders.

- Directories including virtual root: 21 non-root directories reported by the summary.
- Canonical JSON: 1,983,086 bytes.
- Deterministic ID creation, generation, validation, and serialization: 92.78 ms on the recorded container host.

This excludes original-byte hashing and every production parser.

## Security and privacy review

- No file content enters the manifest.
- No full byte read is triggered by manifest generation.
- No network request, storage write, telemetry, or logging was added.
- Project names are NFC-normalized, bounded, and stripped of control/reserved filename characters.
- User paths remain data fields and are never executed or written to the host filesystem.
- The JSON preview is rendered as React text in `<pre>`, not inserted as HTML.
- No new runtime dependency was added.

## Known limits

- The local validator is product-specific and intentionally small; the JSON Schema remains the interoperability document.
- Original hashes remain pending until processing can read full bytes with worker orchestration.
- Manifest creation currently runs on the main thread; the 1,000-file baseline is acceptable, but large-project orchestration belongs to STEP-010.
- The manifest builder offers only the minimal settings needed to exercise v1. Complete configuration UX remains STEP-012.
- Download and final self/output hash handling remain STEP-011.

## Quality gate

- Oxlint: 0 warnings and 0 errors.
- TypeScript strict: passed.
- Vitest: 14 files and 50 tests passed.
- Spike build: passed; only the already isolated research parser chunks exceed 500 kB.
- Production build: 35.54 kB CSS, 292.74 kB application JavaScript, and 7.92 kB lazy `fflate` chunk.
- Playwright Chromium: 3 compiled-bundle E2E tests passed, including import → preflight → Manifest v1 and zero HTTP/HTTPS requests. A controlled runner retries once only if the system Chromium process exceeds the infrastructure timeout; test failures are never retried.
- Runtime audit: 0 known vulnerabilities.
- GitHub Pages base-path build and repository integrity are checked during close-out.
