import { readFileSync, writeFileSync } from 'node:fs'

const [mode, reportPath, summaryPath] = process.argv.slice(2)
if (!mode || !reportPath || !summaryPath) {
  throw new Error('Usage: summarize-test-report.mjs <playwright|vitest> <report> <summary>')
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'))

if (mode === 'playwright') {
  const stats = report.stats ?? {}
  const errors = Array.isArray(report.errors) ? report.errors : []
  if (typeof stats.expected !== 'number') throw new Error('Incomplete Playwright report.')
  if ((stats.unexpected ?? 0) > 0 || errors.length > 0) {
    console.error(JSON.stringify(report, null, 2))
    process.exit(1)
  }
  writeFileSync(summaryPath, JSON.stringify({
    passed: stats.expected,
    unexpected: stats.unexpected ?? 0,
    flaky: stats.flaky ?? 0,
    skipped: stats.skipped ?? 0,
    durationMs: Math.round(stats.duration ?? 0),
    teardownTerminated: true,
  }))
  process.exit(0)
}

if (mode === 'vitest') {
  if (!Array.isArray(report.testResults) || typeof report.numTotalTests !== 'number') {
    throw new Error('Incomplete Vitest report.')
  }
  if (!report.success || report.numFailedTests > 0 || report.numFailedTestSuites > 0) {
    console.error(JSON.stringify(report, null, 2))
    process.exit(1)
  }
  writeFileSync(summaryPath, JSON.stringify({
    files: report.testResults.length,
    tests: report.numTotalTests,
    passed: report.numPassedTests,
    snapshots: report.snapshot?.total ?? 0,
    teardownTerminated: true,
  }))
  process.exit(0)
}

throw new Error(`Unknown report mode: ${mode}`)
