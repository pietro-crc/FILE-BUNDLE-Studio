import type { CapabilityLevel } from '../vfs/types'
import type {
  FileCategory,
  FileOutputEstimate,
  PreflightEstimateRange,
  PreflightFileRecord,
  PreflightPolicy,
  PreflightRecommendation,
  PreflightTotals,
} from './types'

function range(minBytes: number, maxBytes: number): PreflightEstimateRange {
  return { minBytes: Math.max(0, Math.round(minBytes)), maxBytes: Math.max(0, Math.round(maxBytes)) }
}

function factor(size: number, min: number, max: number): PreflightEstimateRange {
  return range(size * min, size * max)
}

function estimateByCategory(size: number, category: FileCategory, level: CapabilityLevel): FileOutputEstimate {
  const manifest = range(700, 1800)
  if (level === 'E') {
    return { markdown: range(400, 1200), pdf: range(0, 900), manifest }
  }
  switch (category) {
    case 'text':
    case 'code':
      return { markdown: factor(size, 1.03, 1.35), pdf: factor(size, 0.15, 0.8), manifest }
    case 'document':
      return { markdown: factor(size, 0.08, 1.1), pdf: factor(size, 0.9, 1.7), manifest }
    case 'spreadsheet':
      return { markdown: factor(size, 0.2, 2.2), pdf: factor(size, 0.3, 2.5), manifest }
    case 'presentation':
      return { markdown: factor(size, 0.08, 0.9), pdf: factor(size, 0.4, 2.2), manifest }
    case 'image':
      return { markdown: range(500, 2200), pdf: factor(size, 0.25, 1.25), manifest }
    default:
      return { markdown: range(400, 1400), pdf: range(0, 1200), manifest }
  }
}

export function estimateFileOutput(size: number, category: FileCategory, level: CapabilityLevel): FileOutputEstimate {
  return estimateByCategory(size, category, level)
}

function sumRange(records: readonly PreflightFileRecord[], key: keyof FileOutputEstimate): PreflightEstimateRange {
  return records.reduce<PreflightEstimateRange>((total, record) => ({
    minBytes: total.minBytes + record.estimate[key].minBytes,
    maxBytes: total.maxBytes + record.estimate[key].maxBytes,
  }), { minBytes: 0, maxBytes: 0 })
}

export function buildPreflightTotals(
  records: readonly PreflightFileRecord[],
  sourceBytes: number,
  logicalBytes: number,
  directoryCount: number,
): PreflightTotals {
  const capabilityCounts = { A: 0, B: 0, C: 0, D: 0, E: 0 }
  const riskCounts = { low: 0, medium: 0, high: 0 }
  records.forEach((record) => {
    capabilityCounts[record.capabilityLevel] += 1
    riskCounts[record.riskLevel] += 1
  })
  const largestFile = records.reduce((largest, record) => Math.max(largest, record.size), 0)
  const compressedPayloadBytes = records.reduce((total, record) => total + record.compressedSize, 0)
  const distinctMimeCount = new Set(records.map((record) => record.mimeDetected)).size
  return {
    sourceBytes,
    compressedPayloadBytes,
    logicalBytes,
    fileCount: records.length,
    directoryCount,
    distinctMimeCount,
    capabilityCounts,
    riskCounts,
    markdown: sumRange(records, 'markdown'),
    pdf: sumRange(records, 'pdf'),
    manifest: sumRange(records, 'manifest'),
    estimatedPeakMemory: range(
      sourceBytes + Math.min(largestFile, 16 * 1024 * 1024),
      sourceBytes + Math.min(logicalBytes, Math.max(largestFile * 3, 64 * 1024 * 1024)),
    ),
  }
}

export function recommendOutputMode(totals: PreflightTotals, policy: PreflightPolicy): PreflightRecommendation {
  if (totals.logicalBytes >= policy.quickPreviewLogicalBytes || totals.fileCount >= policy.quickPreviewFileCount || totals.riskCounts.high > 0) {
    return {
      mode: 'quick-preview',
      reason: 'Volume o rischi elevati: iniziare da manifest, documentazione principale e campioni riduce allocazioni premature.',
      confidence: 'medium',
    }
  }
  if (totals.markdown.maxBytes + totals.pdf.maxBytes >= policy.multipartOutputBytes) {
    return {
      mode: 'multipart',
      reason: 'La stima superiore degli output supera la soglia prudente per la modalità a tre file.',
      confidence: 'low',
    }
  }
  return {
    mode: 'three-files',
    reason: 'Le stime correnti rientrano nella baseline prudente della modalità principale a tre file.',
    confidence: 'low',
  }
}
