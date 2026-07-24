#!/usr/bin/env bash
set -euo pipefail

printf '\n[quality] Lint\n'
./node_modules/.bin/oxlint .

printf '\n[quality] TypeScript strict\n'
./node_modules/.bin/tsc -b --pretty false

printf '\n[quality] Format probe build\n'
./node_modules/.bin/vite build --config vite.spikes.config.ts

printf '\n[quality] PDF read/write probe\n'
node scripts/check-pdf-probe.mjs

printf '\n[quality] Production build\n'
./node_modules/.bin/tsc -b
./node_modules/.bin/vite build


printf '\n[quality] Runtime audit\n'
npm audit --omit=dev --audit-level=low --fetch-timeout=30000 --fetch-retries=1

printf '\n[quality] Full dependency audit\n'
npm audit --audit-level=low --fetch-timeout=30000 --fetch-retries=1
