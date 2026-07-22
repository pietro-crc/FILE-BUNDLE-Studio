#!/usr/bin/env bash
set -euo pipefail

VITE_BASE_PATH=./ VITE_INLINE_DYNAMIC_IMPORTS=true ./node_modules/.bin/vite build --outDir dist-e2e
exec bash scripts/run-playwright.sh
