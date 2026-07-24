import type { VirtualFile } from '../vfs/types'
import type { FormatDescriptor } from './registry'
import type { DetectionMethod, PreflightPolicy, PreflightRisk, RiskLevel } from './types'
import { isMeaningfulMimeMismatch } from './classify'

const SENSITIVE_NAMES = [
  /^\.env(?:\.|$)/iu,
  /(?:^|\/)(?:id_rsa|id_ed25519|credentials|secrets?|passwords?)(?:\.|$)/iu,
  /\.(?:pem|key|p12|pfx|keystore)$/iu,
  /(?:^|\/)(?:service-account|firebase-adminsdk)[^/]*\.json$/iu,
]

const RISK_RANK: Readonly<Record<RiskLevel, number>> = { low: 0, medium: 1, high: 2 }

export function highestRisk(risks: readonly PreflightRisk[]): RiskLevel {
  return risks.reduce<RiskLevel>((level, risk) => RISK_RANK[risk.level] > RISK_RANK[level] ? risk.level : level, 'low')
}

export function assessFileRisks(
  file: VirtualFile,
  descriptor: FormatDescriptor,
  mimeDetected: string,
  detectionMethod: DetectionMethod,
  policy: PreflightPolicy,
  textWarning?: string,
): readonly PreflightRisk[] {
  const risks: PreflightRisk[] = []
  const path = file.normalizedPath

  if (descriptor.executable) {
    risks.push({ code: 'executable-content', level: 'high', message: 'Contenuto eseguibile: conversione bloccata.' })
  }
  if (descriptor.macroEnabled) {
    risks.push({ code: 'office-macro', level: 'high', message: 'Formato Office macro-enabled: le macro non verranno mai eseguite.' })
  }
  if (descriptor.activeContent) {
    risks.push({ code: 'active-content', level: 'medium', message: 'Il formato può contenere contenuto attivo e richiede sanitizzazione.' })
  }
  if (descriptor.nestedArchive) {
    risks.push({ code: 'archive-nested', level: 'medium', message: 'Archivio annidato inventariato senza estrazione ricorsiva automatica.' })
  }
  if (SENSITIVE_NAMES.some((pattern) => pattern.test(path))) {
    risks.push({ code: 'sensitive-name', level: 'high', message: 'Il nome indica un possibile file sensibile; il contenuto non è stato registrato.' })
  }
  if (file.size >= policy.highFileBytes) {
    risks.push({ code: 'large-file', level: 'high', message: 'File molto grande: può richiedere campionamento o multipart.' })
  } else if (file.size >= policy.mediumFileBytes) {
    risks.push({ code: 'large-file', level: 'medium', message: 'File grande: stimare memoria e output prima dell’elaborazione.' })
  }

  const compressedSize = file.archive?.compressedSize
  if (compressedSize !== undefined && compressedSize > 0 && file.size / compressedSize >= policy.mediumCompressionRatio) {
    risks.push({ code: 'compression-ratio', level: 'medium', message: `Rapporto di compressione elevato: ${(file.size / compressedSize).toFixed(1)}×.` })
  }
  if (isMeaningfulMimeMismatch(file.mimeDeclared, mimeDetected, detectionMethod)) {
    risks.push({ code: 'mime-mismatch', level: 'medium', message: `MIME dichiarato ${file.mimeDeclared} diverso dal tipo rilevato ${mimeDetected}.` })
  }
  if (descriptor.adapterId === 'inventory' && descriptor.category === 'binary') {
    risks.push({ code: 'binary-unknown', level: 'medium', message: 'Binario non riconosciuto: nessuna interpretazione del contenuto.' })
  }
  if (textWarning) {
    risks.push({ code: 'text-decoding', level: 'medium', message: textWarning })
  }
  return risks
}
