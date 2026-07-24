import type { SecretFileReport, SecretFinding } from './types'

interface Interval {
  readonly start: number
  readonly end: number
  readonly categories: readonly string[]
}

function mergeIntervals(findings: readonly SecretFinding[]): Interval[] {
  const sorted = findings
    .filter((finding): finding is SecretFinding & { start: number; end: number } => finding.source === 'content' && finding.start !== null && finding.end !== null && finding.end > finding.start)
    .map((finding) => ({ start: finding.start, end: finding.end, categories: [finding.category] }))
    .sort((left, right) => left.start - right.start || left.end - right.end)
  const merged: Interval[] = []
  for (const interval of sorted) {
    const previous = merged.at(-1)
    if (!previous || interval.start > previous.end) {
      merged.push(interval)
      continue
    }
    merged[merged.length - 1] = {
      start: previous.start,
      end: Math.max(previous.end, interval.end),
      categories: [...new Set([...previous.categories, ...interval.categories])],
    }
  }
  return merged
}

function placeholder(interval: Interval): string {
  return `[REDACTED:${interval.categories.join('+')}]`
}

export function redactSecretFindings(content: string, report: SecretFileReport): { readonly content: string; readonly report: SecretFileReport } {
  const intervals = mergeIntervals(report.findings)
  if (intervals.length === 0) return { content, report }
  let cursor = 0
  const output: string[] = []
  for (const interval of intervals) {
    output.push(content.slice(cursor, interval.start), placeholder(interval))
    const removed = content.slice(interval.start, interval.end)
    const lineBreaks = removed.match(/\n/gu)?.length ?? 0
    if (lineBreaks > 0) output.push('\n'.repeat(lineBreaks))
    cursor = interval.end
  }
  output.push(content.slice(cursor))
  return {
    content: output.join(''),
    report: {
      ...report,
      status: 'redacted',
      redactionCount: intervals.length,
    },
  }
}
