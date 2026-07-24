# Contributing

AI Bundle Studio uses step-scoped development, Conventional Commits, exact dependency versions, and a mandatory local quality gate.

## Local workflow

1. Use Node 22.13 or newer within the Node 22 line.
2. Install with `npm ci`.
3. Keep user file bytes out of React state and logs.
4. Add fixtures and tests before claiming support for a format.
5. Run `npm run quality` before committing.
6. Update `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/FILE_SUPPORT_MATRIX.md`, and `CHANGELOG.md` when behavior changes.

Never commit real credentials, private user documents, generated output bundles, or large binary fixtures without an explicit review.
