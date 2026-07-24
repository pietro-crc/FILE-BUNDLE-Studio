#!/usr/bin/env bash
set -euo pipefail

mode="${1:-regression}"
case "$mode" in
  regression|quality)
    label="VITEST_REGRESSION"
    groups=(
      "tests/unit/App.test.tsx tests/unit/spreadsheet.test.ts tests/integration/format-probes.test.ts tests/integration/zip-import.test.ts tests/unit/manifest.test.ts tests/unit/markdown.test.ts tests/unit/pdf-image.test.ts"
      "tests/unit/acquisition.test.ts tests/unit/glob.test.ts tests/unit/path-normalization.test.ts tests/unit/pipeline-contract.test.ts tests/unit/preflight-classification.test.ts tests/unit/virtual-filesystem.test.ts tests/integration/preflight-analysis.test.ts"
      "tests/unit/office.test.ts tests/unit/security.test.ts tests/unit/error-boundary.test.tsx"
    )
    ;;
  benchmarks)
    label="VITEST_BENCHMARKS"
    groups=(
      "tests/benchmarks/preflight.benchmark.test.ts tests/benchmarks/manifest.benchmark.test.ts tests/benchmarks/markdown.benchmark.test.ts"
      "tests/benchmarks/spreadsheet.benchmark.test.ts tests/benchmarks/pdf-image.benchmark.test.ts"
      "tests/benchmarks/office.benchmark.test.ts tests/benchmarks/security.benchmark.test.ts"
    )
    ;;
  *)
    printf 'Unknown Vitest suite: %s\n' "$mode" >&2
    exit 2
    ;;
esac

reports=()
logs=()
pids=()
cleanup() {
  rm -f "${reports[@]}" "${logs[@]}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for group in "${groups[@]}"; do
  report="$(mktemp -t ai-bundle-studio-vitest.XXXXXX.json)"
  log="$(mktemp -t ai-bundle-studio-vitest.XXXXXX.log)"
  reports+=("$report")
  logs+=("$log")
  # shellcheck disable=SC2206 -- groups are repository-owned paths without spaces.
  targets=($group)
  ./node_modules/.bin/vitest run "${targets[@]}" \
    --pool=threads \
    --maxWorkers=1 \
    --no-file-parallelism \
    --reporter=json \
    "--outputFile=$report" >"$log" 2>&1 &
  pids+=("$!")
done

failed=0
for index in "${!pids[@]}"; do
  if ! wait "${pids[$index]}"; then
    failed=1
    printf '%s process %s failed.\n' "$label" "$((index + 1))" >&2
    cat "${logs[$index]}" >&2
  fi
done
if [[ $failed -ne 0 ]]; then exit 1; fi

total_tests=0
passed_tests=0
failed_tests=0
test_files=0
for index in "${!reports[@]}"; do
  report="${reports[$index]}"
  if [[ ! -s "$report" ]]; then
    printf '%s process %s produced no report.\n' "$label" "$((index + 1))" >&2
    cat "${logs[$index]}" >&2
    exit 1
  fi
  summary="$(node - "$report" <<'NODE'
const fs = require('node:fs')
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const total = Number(report.numTotalTests ?? 0)
const passed = Number(report.numPassedTests ?? 0)
const failed = Number(report.numFailedTests ?? 0)
const files = Array.isArray(report.testResults) ? report.testResults.length : 0
if (report.success !== true || total < 1 || failed !== 0 || passed !== total || files < 1) process.exit(1)
process.stdout.write(`${files} ${total} ${passed} ${failed}`)
NODE
)" || {
    printf '%s process %s produced an invalid report.\n' "$label" "$((index + 1))" >&2
    cat "$report" >&2
    exit 1
  }
  read -r group_files group_total group_passed group_failed <<<"$summary"
  test_files=$((test_files + group_files))
  total_tests=$((total_tests + group_total))
  passed_tests=$((passed_tests + group_passed))
  failed_tests=$((failed_tests + group_failed))
  printf '%s process=%s files=%s tests=%s passed\n' "$label" "$((index + 1))" "$group_files" "$group_total"
done

printf '%s {"success":true,"testFiles":%s,"totalTests":%s,"passedTests":%s,"failedTests":%s}\n' \
  "$label" "$test_files" "$total_tests" "$passed_tests" "$failed_tests"
