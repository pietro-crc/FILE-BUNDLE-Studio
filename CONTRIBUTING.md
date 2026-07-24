# Contributing to AI Bundle Studio

Thank you for your interest in contributing to **AI Bundle Studio**! We welcome contributions that align with our core principles: **strict browser-only execution, zero telemetry, local privacy, and production-grade code quality**.

---

## 🛡️ Core Contribution Principles

Before writing code, please keep these mandatory architectural rules in mind:

1. **Zero External Requests & Zero Telemetry:**
   Never introduce network calls, analytics, remote logging, tracking scripts, or CDN dependencies. All processing must occur strictly inside the user's browser.
2. **Untrusted Input Security Model:**
   Treat every file, directory name, archive entry, metadata field, and embedded stream as untrusted input. Apply sanitization, bounded reads, and per-file error isolation.
3. **No Monolithic Files (Single Responsibility Principle):**
   Divide functionality into modular, decoupled files. Keep UI components separate from core processing logic (`src/core/` vs `src/ui/` / `src/features/`).
4. **State & Memory Discipline:**
   Never store raw file bytes or full document contents in React state. Keep heavy buffers in disposable local variables or virtual file system instances.
5. **No Destructive Operations:**
   Redaction and sanitization apply only to derived outputs (Markdown/PDF/Manifest). Never mutate the user's original files or byte sources.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `>=22.13.0 <23`
- **npm**: `>=10.0.0`
- **Git**: `>=2.30`

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/pietro-crc/FILE-BUNDLE-Studio.git
   cd FILE-BUNDLE-Studio
   ```

2. **Install exact dependencies:**
   ```bash
   npm ci
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open the local URL printed by Vite (typically `http://localhost:5173`).

---

## 🧪 Quality Gate & Testing

All pull requests must pass the complete local quality gate without warnings or errors.

### Local Quality Commands

```bash
# Run ESLint static analysis
npm run lint

# Run strict TypeScript type checks
npm run typecheck

# Run unit and integration regression test suite
npm test

# Run compiled Chromium E2E workflow tests
npm run test:e2e

# Run the complete mandatory quality gate
npm run quality
```

> **Note:** Before pushing code or opening a PR, always run:
> ```bash
> npm run quality && npm test && npm run test:e2e
> ```

---

## 📐 Code Style & Conventions

- **Language:** Strict TypeScript. Do not use `any` unless absolutely necessary and documented.
- **Components:** Functional React components with strong props typing (`readonly` fields).
- **Naming Conventions:**
  - `camelCase` for variables, functions, and properties.
  - `PascalCase` for React components, interfaces, and types.
  - `kebab-case` for file names and CSS classes.
- **Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat: add support for XYZ format`
  - `fix: resolve dynamic import retry on stale cache`
  - `docs: update security baseline documentation`
  - `test: add unit test for secret redaction scanner`
  - `refactor: extract spreadsheet preview builder`

---

## 📋 Pull Request Process

1. **Create a Feature Branch:**
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. **Implement Changes & Add Tests:**
   Ensure new features or bug fixes include corresponding unit tests in `tests/unit/` or `tests/integration/`.
3. **Update Documentation:**
   If your changes alter format capabilities, architectural decisions, or security rules, update `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/FILE_SUPPORT_MATRIX.md`, and `CHANGELOG.md`.
4. **Submit PR:**
   Provide a clear summary of changes, rationale, test results, and any relevant visual updates or screenshots.

---

## 🔐 Reporting Security Vulnerabilities

If you discover a potential security vulnerability, please do **not** open a public issue. Review our [Security Baseline](docs/SECURITY.md) and [Threat Model](docs/THREAT_MODEL.md) or submit a private security report.
