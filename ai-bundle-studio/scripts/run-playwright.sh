#!/usr/bin/env bash
set -euo pipefail

attempt_timeout=75
max_attempts=2
playwright_cli="node_modules/@playwright/test/cli.js"

run_attempt() {
  local attempt="$1"
  local report_file log_file pid_file summary_file pid deadline
  report_file="$(mktemp -t ai-bundle-studio-playwright.XXXXXX.json)"
  log_file="$(mktemp -t ai-bundle-studio-playwright.XXXXXX.log)"
  pid_file="$(mktemp -t ai-bundle-studio-playwright.XXXXXX.pid)"
  summary_file="$(mktemp -t ai-bundle-studio-playwright.XXXXXX.summary)"

  cleanup_attempt() {
    if [[ -n "${pid:-}" ]]; then
      if command -v setsid >/dev/null 2>&1; then
        kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
      else
        kill -KILL "$pid" 2>/dev/null || true
      fi
    fi
    rm -f "$report_file" "$log_file" "$pid_file" "$summary_file"
  }

  if command -v setsid >/dev/null 2>&1; then
    bash -c '
      report_file="$1"
      log_file="$2"
      pid_file="$3"
      cli="$4"
      nohup setsid env PLAYWRIGHT_JSON_OUTPUT_FILE="$report_file" \
        node "$cli" test --workers=1 --timeout=30000 --global-timeout=60000 --reporter=json \
        >"$log_file" 2>&1 </dev/null &
      printf "%s\n" "$!" >"$pid_file"
    ' _ "$report_file" "$log_file" "$pid_file" "$playwright_cli"
  else
    bash -c '
      report_file="$1"
      log_file="$2"
      pid_file="$3"
      cli="$4"
      nohup env PLAYWRIGHT_JSON_OUTPUT_FILE="$report_file" \
        node "$cli" test --workers=1 --timeout=30000 --global-timeout=60000 --reporter=json \
        >"$log_file" 2>&1 </dev/null &
      printf "%s\n" "$!" >"$pid_file"
    ' _ "$report_file" "$log_file" "$pid_file" "$playwright_cli"
  fi

  pid="$(cat "$pid_file")"
  deadline=$((SECONDS + attempt_timeout))

  while (( SECONDS < deadline )); do
    if [[ -s "$report_file" ]]; then
      break
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 0.25
  done

  if [[ ! -s "$report_file" ]]; then
    printf 'Playwright attempt %s produced no complete report.\n' "$attempt" >&2
    cat "$log_file" >&2
    cleanup_attempt
    return 2
  fi

  if ! node scripts/summarize-test-report.mjs playwright "$report_file" "$summary_file"
  then
    cat "$log_file" >&2
    cleanup_attempt
    return 1
  fi

  printf 'PLAYWRIGHT_E2E %s\n' "$(cat "$summary_file")"
  cleanup_attempt
  return 0
}

for attempt in $(seq 1 "$max_attempts"); do
  set +e
  run_attempt "$attempt"
  status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    exit 0
  fi
  if [[ "$status" -eq 1 ]]; then
    exit 1
  fi
  if [[ "$attempt" -lt "$max_attempts" ]]; then
    printf 'Retrying Playwright once after an infrastructure timeout.\n' >&2
  fi
done

exit 1
