import { createSecretScanPolicy } from './policy'
import type {
  SecretFinding,
  SecretFindingCategory,
  SecretFindingConfidence,
  SecretFindingSeverity,
  SecretFileReport,
  SecretHandlingMode,
  SecretScanPolicy,
} from './types'

interface PatternDefinition {
  readonly category: SecretFindingCategory
  readonly severity: SecretFindingSeverity
  readonly confidence: SecretFindingConfidence
  readonly description: string
  readonly expression: RegExp
  readonly captureGroup?: number
}

const CONTENT_PATTERNS: readonly PatternDefinition[] = [
  {
    category: 'private-key',
    severity: 'high',
    confidence: 'high',
    description: 'Blocco di chiave privata rilevato.',
    expression: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]{0,200000}?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/gu,
  },
  {
    category: 'cloud-credential',
    severity: 'high',
    confidence: 'high',
    description: 'Identificatore di credenziale cloud rilevato.',
    expression: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu,
  },
  {
    category: 'access-token',
    severity: 'high',
    confidence: 'high',
    description: 'Token di accesso con prefisso noto rilevato.',
    expression: /\b(?:gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}|xox[baprs]-[A-Za-z0-9-]{10,255})\b/gu,
  },
  {
    category: 'jwt',
    severity: 'high',
    confidence: 'high',
    description: 'JSON Web Token rilevato.',
    expression: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu,
  },
  {
    category: 'connection-string',
    severity: 'high',
    confidence: 'high',
    description: 'Connection string con credenziali incorporate rilevata.',
    expression: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?):\/\/[^\s:@/]{1,128}:[^\s@/]{1,256}@[^\s"'<>]{1,512}/giu,
  },
  {
    category: 'password-assignment',
    severity: 'high',
    confidence: 'medium',
    description: 'Valore sensibile assegnato a una chiave nota.',
    expression: /\b(?:password|passwd|pwd|secret|token|api[_-]?key|client[_-]?secret|access[_-]?key)\b\s*[:=]\s*["']?([^\s"'#,;]{4,512})/giu,
    captureGroup: 1,
  },
]

const SENSITIVE_FILE_PATTERNS: readonly RegExp[] = [
  /(?:^|\/)\.env(?:\.[^/]+)?$/iu,
  /(?:^|\/)(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)(?:\.pub)?$/iu,
  /(?:^|\/)(?:credentials|service[-_]?account|secrets?|auth|tokens?)\.(?:json|ya?ml|toml|ini|properties|txt)$/iu,
  /(?:^|\/)(?:\.npmrc|\.pypirc|\.netrc|kubeconfig|wallet\.dat)$/iu,
  /\.(?:pem|p12|pfx|key|keystore|jks)$/iu,
]

function findingId(category: SecretFindingCategory, source: 'filename' | 'content', ordinal: number): string {
  return `secret-${source}-${category}-${String(ordinal).padStart(3, '0')}`
}

function createLineStarts(content: string): number[] {
  const starts = [0]
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10) starts.push(index + 1)
  }
  return starts
}

function lineAndColumn(lineStarts: readonly number[], offset: number): { line: number; column: number } {
  let low = 0
  let high = lineStarts.length - 1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if ((lineStarts[middle] ?? 0) <= offset) low = middle + 1
    else high = middle - 1
  }
  const lineIndex = Math.max(0, high)
  return { line: lineIndex + 1, column: offset - (lineStarts[lineIndex] ?? 0) + 1 }
}

function createContentFinding(
  definition: PatternDefinition,
  content: string,
  match: RegExpExecArray,
  ordinal: number,
  lineStarts: readonly number[],
): SecretFinding | null {
  const matched = definition.captureGroup ? match[definition.captureGroup] : match[0]
  if (!matched || match.index === undefined) return null
  const relative = definition.captureGroup ? match[0].indexOf(matched) : 0
  if (relative < 0) return null
  const start = match.index + relative
  const end = start + matched.length
  const position = lineAndColumn(lineStarts, start)
  return {
    id: findingId(definition.category, 'content', ordinal),
    category: definition.category,
    severity: definition.severity,
    source: 'content',
    confidence: definition.confidence,
    description: definition.description,
    start,
    end,
    line: position.line,
    column: position.column,
  }
}

function entropy(value: string): number {
  const counts = new Map<string, number>()
  for (const character of value) counts.set(character, (counts.get(character) ?? 0) + 1)
  let result = 0
  for (const count of counts.values()) {
    const probability = count / value.length
    result -= probability * Math.log2(probability)
  }
  return result
}

function characterClassCount(value: string): number {
  return [/[a-z]/u, /[A-Z]/u, /[0-9]/u, /[_+/=-]/u].filter((expression) => expression.test(value)).length
}

function overlapsExisting(start: number, end: number, findings: readonly SecretFinding[]): boolean {
  return findings.some((finding) => finding.start !== null && finding.end !== null && start < finding.end && end > finding.start)
}

function highEntropyFindings(
  content: string,
  policy: SecretScanPolicy,
  existing: readonly SecretFinding[],
  startOrdinal: number,
  lineStarts: readonly number[],
): SecretFinding[] {
  if (!policy.scanHighEntropy) return []
  const expression = new RegExp(`[A-Za-z0-9_+/=-]{${policy.minHighEntropyLength},${policy.maxCandidateLength}}`, 'gu')
  const findings: SecretFinding[] = []
  for (const match of content.matchAll(expression)) {
    if (match.index === undefined || !match[0]) continue
    const value = match[0]
    if (characterClassCount(value) < 3 || new Set(value).size < 12 || entropy(value) < policy.highEntropyThreshold) continue
    const start = match.index
    const end = start + value.length
    if (overlapsExisting(start, end, [...existing, ...findings])) continue
    const position = lineAndColumn(lineStarts, start)
    findings.push({
      id: findingId('high-entropy', 'content', startOrdinal + findings.length),
      category: 'high-entropy',
      severity: 'medium',
      source: 'content',
      confidence: 'medium',
      description: 'Sequenza ad alta entropia rilevata; possibile falso positivo.',
      start,
      end,
      line: position.line,
      column: position.column,
    })
    if (existing.length + findings.length >= policy.maxFindingsPerFile) break
  }
  return findings
}

export function scanSecrets(
  fileId: string,
  path: string,
  content: string,
  mode: SecretHandlingMode,
  overrides?: Partial<SecretScanPolicy>,
): SecretFileReport {
  const policy = createSecretScanPolicy(overrides)
  const scanText = content.slice(0, policy.maxCharactersPerFile)
  const findings: SecretFinding[] = []
  const warnings: string[] = []
  const lineStarts = createLineStarts(scanText)

  if (SENSITIVE_FILE_PATTERNS.some((expression) => expression.test(path))) {
    findings.push({
      id: findingId('sensitive-filename', 'filename', findings.length + 1),
      category: 'sensitive-filename',
      severity: 'medium',
      source: 'filename',
      confidence: 'medium',
      description: 'Nome file comunemente associato a credenziali o materiale sensibile.',
      start: null,
      end: null,
      line: null,
      column: null,
    })
  }

  for (const definition of CONTENT_PATTERNS) {
    definition.expression.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = definition.expression.exec(scanText)) !== null) {
      const finding = createContentFinding(definition, scanText, match, findings.length + 1, lineStarts)
      if (finding && !overlapsExisting(finding.start ?? 0, finding.end ?? 0, findings)) findings.push(finding)
      if (findings.length >= policy.maxFindingsPerFile) break
      if (match[0].length === 0) definition.expression.lastIndex += 1
    }
    if (findings.length >= policy.maxFindingsPerFile) break
  }

  if (findings.length < policy.maxFindingsPerFile) {
    findings.push(...highEntropyFindings(scanText, policy, findings, findings.length + 1, lineStarts))
  }

  const limited = findings.slice(0, policy.maxFindingsPerFile)
  const findingLimitReached = limited.length >= policy.maxFindingsPerFile
  const scanTruncated = content.length > scanText.length || findings.length > limited.length || findingLimitReached
  if (content.length > scanText.length) warnings.push(`Scansione limitata ai primi ${policy.maxCharactersPerFile} caratteri.`)
  if (findings.length > limited.length || findingLimitReached) warnings.push(`Risultati limitati a ${policy.maxFindingsPerFile} segnalazioni.`)
  if (limited.some((finding) => finding.category === 'high-entropy')) warnings.push('Le segnalazioni ad alta entropia possono includere falsi positivi.')

  return {
    fileId,
    path,
    mode,
    status: limited.length > 0 ? 'flagged' : 'clean',
    scannedCharacters: scanText.length,
    scanTruncated,
    findings: limited,
    redactionCount: 0,
    excluded: false,
    visualOmitted: false,
    warnings,
    error: null,
  }
}

export function notScannedSecretReport(fileId: string, path: string, mode: SecretHandlingMode): SecretFileReport {
  return {
    fileId,
    path,
    mode,
    status: 'not-scanned',
    scannedCharacters: 0,
    scanTruncated: false,
    findings: [],
    redactionCount: 0,
    excluded: false,
    visualOmitted: false,
    warnings: [],
    error: null,
  }
}
