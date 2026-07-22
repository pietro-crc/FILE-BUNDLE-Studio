import type { SecretCategoryCounts, SecretFileReport, SecuritySummary, SecretHandlingMode, SecretScanPolicy } from './types'

type MutableSecretCategoryCounts = { -readonly [Key in keyof SecretCategoryCounts]: number }

function emptyCounts(): MutableSecretCategoryCounts {
  return {
    'sensitive-filename': 0,
    'private-key': 0,
    'cloud-credential': 0,
    'access-token': 0,
    jwt: 0,
    'connection-string': 0,
    'password-assignment': 0,
    'high-entropy': 0,
  }
}

export function summarizeSecurity(reports: readonly SecretFileReport[], mode: SecretHandlingMode, policy: SecretScanPolicy): SecuritySummary {
  const categoryCounts = emptyCounts()
  for (const report of reports) {
    for (const category of new Set(report.findings.map((finding) => finding.category))) categoryCounts[category] += 1
  }
  return {
    mode,
    policy,
    scannedFileCount: reports.filter((report) => report.status !== 'not-scanned').length,
    flaggedFileCount: reports.filter((report) => report.findings.length > 0).length,
    findingCount: reports.reduce((total, report) => total + report.findings.length, 0),
    redactionCount: reports.reduce((total, report) => total + report.redactionCount, 0),
    excludedFileCount: reports.filter((report) => report.excluded).length,
    visualOmittedFileCount: reports.filter((report) => report.visualOmitted).length,
    truncatedScanCount: reports.filter((report) => report.scanTruncated).length,
    failedScanCount: reports.filter((report) => report.status === 'failed').length,
    categoryCounts,
  }
}
