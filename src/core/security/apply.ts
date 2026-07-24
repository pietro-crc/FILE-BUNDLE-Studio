import { redactSecretFindings } from './redact'
import { scanSecrets } from './scanner'
import type { SecuredContent, SecretHandlingMode, SecretScanPolicy } from './types'

export function secureDerivedContent(
  fileId: string,
  path: string,
  content: string,
  mode: SecretHandlingMode,
  policy?: Partial<SecretScanPolicy>,
): SecuredContent {
  const scanned = scanSecrets(fileId, path, content, mode, policy)
  if (scanned.findings.length === 0 || mode === 'report-only') return { content, report: scanned }
  if (mode === 'exclude') {
    return {
      content: '',
      report: { ...scanned, status: 'excluded', excluded: true, visualOmitted: true },
    }
  }
  const redacted = redactSecretFindings(content, scanned)
  return { content: redacted.content, report: redacted.report }
}
