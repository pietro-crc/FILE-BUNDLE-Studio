import { useEffect, useMemo, useRef, useState } from 'react'
import { analyzeVirtualFileSystem, DEFAULT_PREFLIGHT_POLICY } from '../../core/preflight/analyze'
import { filterPreflightFiles, isFileSelected } from '../../core/preflight/filter'
import { matchesAnyGlob, parseGlobInput } from '../../core/preflight/glob'
import type {
  PreflightProgress,
  PreflightReport,
  PreflightSelection,
  RiskLevel,
} from '../../core/preflight/types'
import type { CapabilityLevel, VirtualFileSystem } from '../../core/vfs/types'
import { Button } from '../../ui/Button'
import { SectionIntro } from '../../ui/SectionIntro'
import type { WorkflowStepId } from '../../app/workflow'

interface PreflightScreenProps {
  readonly fileSystem: VirtualFileSystem | null
  readonly importIssues: PreflightReport['importIssues']
  readonly report: PreflightReport | null
  readonly selection: PreflightSelection
  readonly onNavigate: (step: WorkflowStepId) => void
  readonly onReport: (report: PreflightReport) => void
  readonly onSelectionChange: (selection: PreflightSelection) => void
}

const CAPABILITY_LABELS: Readonly<Record<CapabilityLevel, string>> = {
  A: 'A · completa',
  B: 'B · strutturata',
  C: 'C · visuale',
  D: 'D · inventario',
  E: 'E · bloccato',
}

const RISK_LABELS: Readonly<Record<RiskLevel, string>> = {
  low: 'Basso',
  medium: 'Medio',
  high: 'Alto',
}

const MODE_LABELS = {
  'three-files': 'Tre file',
  multipart: 'Multipart sicura',
  'quick-preview': 'Anteprima rapida',
} as const

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = -1
  do {
    value /= 1024
    unitIndex += 1
  } while (value >= 1024 && unitIndex < units.length - 1)
  return `${value.toLocaleString('it-IT', { maximumFractionDigits: value >= 10 ? 1 : 2 })} ${units[unitIndex]}`
}

function formatRange(minBytes: number, maxBytes: number): string {
  return `${formatBytes(minBytes)}–${formatBytes(maxBytes)}`
}

export function PreflightScreen({
  fileSystem,
  importIssues,
  onNavigate,
  onReport,
  onSelectionChange,
  report,
  selection,
}: PreflightScreenProps) {
  const controller = useRef<AbortController | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState<PreflightProgress | null>(null)
  const [statusMessage, setStatusMessage] = useState('Preflight non ancora eseguito.')
  const [query, setQuery] = useState('')
  const [capability, setCapability] = useState<CapabilityLevel | 'all'>('all')
  const [risk, setRisk] = useState<RiskLevel | 'all'>('all')
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [globInput, setGlobInput] = useState(selection.exclusionGlobs.join('\n'))
  const [globErrors, setGlobErrors] = useState<readonly string[]>([])

  useEffect(() => () => controller.current?.abort('Schermata preflight chiusa.'), [])
  useEffect(() => setGlobInput(selection.exclusionGlobs.join('\n')), [selection.exclusionGlobs])

  const runPreflight = async () => {
    if (!fileSystem) return
    controller.current?.abort('Nuova analisi avviata.')
    const nextController = new AbortController()
    controller.current = nextController
    setIsAnalyzing(true)
    setProgress({ completed: 0, total: fileSystem.files.length })
    setStatusMessage('Lettura locale dei campioni in corso…')
    try {
      const nextReport = await analyzeVirtualFileSystem(fileSystem, {
        importIssues,
        signal: nextController.signal,
        onProgress: setProgress,
      })
      onReport(nextReport)
      setStatusMessage(`Preflight completato: ${nextReport.files.length} file classificati.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatusMessage('Preflight annullato in sicurezza.')
      } else {
        setStatusMessage(error instanceof Error ? error.message : 'Preflight non riuscito.')
      }
    } finally {
      if (controller.current === nextController) controller.current = null
      setIsAnalyzing(false)
    }
  }

  const visibleFiles = useMemo(() => report ? filterPreflightFiles(report.files, {
    query,
    capability,
    risk,
    selectedOnly,
    selection,
  }) : [], [capability, query, report, risk, selectedOnly, selection])

  const selectedCount = useMemo(
    () => report?.files.filter((record) => isFileSelected(record, selection)).length ?? 0,
    [report, selection],
  )

  const toggleFile = (fileId: string, shouldInclude: boolean) => {
    const excludedFileIds = new Set(selection.excludedFileIds)
    if (shouldInclude) excludedFileIds.delete(fileId)
    else excludedFileIds.add(fileId)
    onSelectionChange({ ...selection, excludedFileIds })
  }

  const updateVisibleSelection = (shouldInclude: boolean) => {
    const excludedFileIds = new Set(selection.excludedFileIds)
    visibleFiles.forEach((record) => {
      if (!record.defaultIncluded) return
      if (shouldInclude) excludedFileIds.delete(record.fileId)
      else excludedFileIds.add(record.fileId)
    })
    onSelectionChange({ ...selection, excludedFileIds })
  }

  const applyGlobs = () => {
    const parsed = parseGlobInput(globInput)
    setGlobErrors(parsed.errors)
    if (parsed.errors.length === 0) {
      onSelectionChange({ ...selection, exclusionGlobs: parsed.patterns })
      setStatusMessage(`${parsed.patterns.length} pattern di esclusione applicati.`)
    }
  }

  return (
    <div className="screen">
      <SectionIntro
        description="Classifica con campioni limitati, assegna livelli A–E, stima memoria e output, poi scegli cosa includere senza modificare il filesystem virtuale."
        eyebrow="Fase 03 · Preflight"
        title="Capisci cosa verrà elaborato."
      />

      {!fileSystem ? (
        <section className="preflight-empty" aria-labelledby="preflight-empty-title">
          <p className="eyebrow">Nessun progetto attivo</p>
          <h2 id="preflight-empty-title">Importa prima ZIP, cartella o file.</h2>
          <p>Il preflight non può classificare contenuti che non sono ancora nel filesystem virtuale locale.</p>
          <Button onClick={() => onNavigate('import')}>Vai all’importazione</Button>
        </section>
      ) : (
        <>
          <section className="preflight-runner" aria-labelledby="preflight-runner-title" aria-busy={isAnalyzing}>
            <div>
              <p className="eyebrow">Analisi locale limitata</p>
              <h2 id="preflight-runner-title">Campione massimo {formatBytes(report?.policy.maxSignatureBytes ?? DEFAULT_PREFLIGHT_POLICY.maxSignatureBytes)} per file</h2>
              <p>Firma, testo e metadati vengono confrontati senza caricare interamente i file durante questa fase.</p>
            </div>
            <div className="preflight-runner__actions">
              {isAnalyzing ? (
                <Button onClick={() => controller.current?.abort('Annullamento richiesto.')} variant="secondary">Annulla</Button>
              ) : null}
              <Button disabled={isAnalyzing} onClick={() => void runPreflight()}>
                {report ? 'Ripeti preflight' : 'Esegui preflight'}
              </Button>
            </div>
            {isAnalyzing && progress ? (
              <div className="preflight-progress" aria-label="Avanzamento preflight">
                <div className="preflight-progress__copy">
                  <span>{progress.currentPath ?? 'Preparazione…'}</span>
                  <strong>{progress.completed}/{progress.total}</strong>
                </div>
                <progress max={Math.max(1, progress.total)} value={progress.completed} />
              </div>
            ) : null}
          </section>
          <p className="preflight-status" role="status" aria-live="polite">{statusMessage}</p>

          {report ? (
            <div className="preflight-report">
              <section className="preflight-metrics" aria-label="Metriche preflight">
                <div><span>File classificati</span><strong>{report.totals.fileCount}</strong><small>{report.totals.distinctMimeCount} MIME rilevati</small></div>
                <div><span>Input / logico</span><strong>{formatBytes(report.totals.sourceBytes)}</strong><small>{formatBytes(report.totals.logicalBytes)} dopo acquisizione</small></div>
                <div><span>Supporto A–C</span><strong>{report.totals.capabilityCounts.A + report.totals.capabilityCounts.B + report.totals.capabilityCounts.C}</strong><small>{report.totals.capabilityCounts.D} inventario · {report.totals.capabilityCounts.E} bloccati</small></div>
                <div><span>Rischio elevato</span><strong>{report.totals.riskCounts.high}</strong><small>{report.totals.riskCounts.medium} medi · {report.totals.riskCounts.low} bassi</small></div>
              </section>

              <section className={`preflight-recommendation preflight-recommendation--${report.recommendation.mode}`} aria-labelledby="preflight-recommendation-title">
                <div>
                  <p className="eyebrow">Modalità consigliata · confidenza {report.recommendation.confidence === 'low' ? 'bassa' : 'media'}</p>
                  <h2 id="preflight-recommendation-title">{MODE_LABELS[report.recommendation.mode]}</h2>
                  <p>{report.recommendation.reason}</p>
                </div>
                <dl>
                  <div><dt>Markdown</dt><dd>{formatRange(report.totals.markdown.minBytes, report.totals.markdown.maxBytes)}</dd></div>
                  <div><dt>PDF</dt><dd>{formatRange(report.totals.pdf.minBytes, report.totals.pdf.maxBytes)}</dd></div>
                  <div><dt>Manifest</dt><dd>{formatRange(report.totals.manifest.minBytes, report.totals.manifest.maxBytes)}</dd></div>
                  <div><dt>Memoria stimata</dt><dd>{formatRange(report.totals.estimatedPeakMemory.minBytes, report.totals.estimatedPeakMemory.maxBytes)}</dd></div>
                </dl>
              </section>

              {report.importIssues.length > 0 ? (
                <section className="preflight-import-issues" aria-labelledby="preflight-import-issues-title">
                  <div>
                    <p className="eyebrow">Acquisizione</p>
                    <h2 id="preflight-import-issues-title">{report.importIssues.length} entry escluse o segnalate prima del preflight</h2>
                  </div>
                  <ul>
                    {report.importIssues.slice(0, 10).map((issue, index) => (
                      <li key={`${issue.code}-${issue.path ?? index}`}><strong>{issue.code}</strong><span>{issue.path ? `${issue.path} — ` : ''}{issue.message}</span></li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="preflight-workspace" aria-labelledby="preflight-files-title">
                <div className="preflight-workspace__header">
                  <div>
                    <p className="eyebrow">Inventario filtrabile</p>
                    <h2 id="preflight-files-title">{selectedCount} di {report.files.length} file inclusi</h2>
                  </div>
                  <div className="preflight-workspace__bulk-actions">
                    <Button onClick={() => updateVisibleSelection(true)} variant="ghost">Includi visibili</Button>
                    <Button onClick={() => updateVisibleSelection(false)} variant="ghost">Escludi visibili</Button>
                  </div>
                </div>

                <div className="preflight-filters" aria-label="Filtri inventario">
                  <label>
                    <span>Cerca percorso</span>
                    <input onChange={(event) => setQuery(event.target.value)} placeholder="es. src/core" type="search" value={query} />
                  </label>
                  <label>
                    <span>Capacità</span>
                    <select onChange={(event) => setCapability(event.target.value as CapabilityLevel | 'all')} value={capability}>
                      <option value="all">Tutti i livelli</option>
                      {(['A', 'B', 'C', 'D', 'E'] as const).map((level) => <option key={level} value={level}>{CAPABILITY_LABELS[level]}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Rischio</span>
                    <select onChange={(event) => setRisk(event.target.value as RiskLevel | 'all')} value={risk}>
                      <option value="all">Tutti i rischi</option>
                      <option value="low">Basso</option>
                      <option value="medium">Medio</option>
                      <option value="high">Alto</option>
                    </select>
                  </label>
                  <label className="preflight-checkbox">
                    <input checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)} type="checkbox" />
                    <span>Solo inclusi</span>
                  </label>
                </div>

                <div className="preflight-globs">
                  <label htmlFor="preflight-globs-input">
                    <span>Esclusioni glob sicure</span>
                    <small>Supportati `*`, `**` e `?`; un pattern per riga o separato da virgola.</small>
                  </label>
                  <textarea id="preflight-globs-input" onChange={(event) => setGlobInput(event.target.value)} placeholder={'node_modules/**\ndist/**\n**/*.map'} rows={3} value={globInput} />
                  <Button onClick={applyGlobs} variant="secondary">Applica pattern</Button>
                  {globErrors.length > 0 ? <ul className="preflight-glob-errors">{globErrors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
                </div>

                <div className="preflight-table-wrap">
                  <table className="preflight-table">
                    <caption className="visually-hidden">File classificati dal preflight</caption>
                    <thead><tr><th scope="col">Includi</th><th scope="col">Percorso</th><th scope="col">Tipo rilevato</th><th scope="col">Livello</th><th scope="col">Rischio</th><th scope="col">Dimensione</th></tr></thead>
                    <tbody>
                      {visibleFiles.slice(0, 300).map((record) => {
                        const selected = isFileSelected(record, selection)
                        const excludedByGlob = matchesAnyGlob(record.path, selection.exclusionGlobs)
                        return (
                          <tr key={record.fileId}>
                            <td><input aria-label={`Includi ${record.path}`} checked={selected} disabled={!record.defaultIncluded || excludedByGlob} onChange={(event) => toggleFile(record.fileId, event.target.checked)} title={excludedByGlob ? 'Escluso da un pattern glob.' : undefined} type="checkbox" /></td>
                            <td><strong>{record.path}</strong><small>{record.supportReason}</small>{record.risks.length > 0 ? <small>{record.risks.map((item) => item.message).join(' ')}</small> : null}</td>
                            <td><code>{record.mimeDetected}</code><small>{record.detectionMethod}</small></td>
                            <td><span className={`capability-badge capability-badge--${record.capabilityLevel.toLowerCase()}`}>{record.capabilityLevel}</span></td>
                            <td><span className={`risk-badge risk-badge--${record.riskLevel}`}>{RISK_LABELS[record.riskLevel]}</span></td>
                            <td>{formatBytes(record.size)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {visibleFiles.length === 0 ? <p className="preflight-table-note">Nessun file corrisponde ai filtri correnti.</p> : null}
                {visibleFiles.length > 300 ? <p className="preflight-table-note">Mostrati i primi 300 di {visibleFiles.length} risultati; affina i filtri per ridurre la vista.</p> : null}
              </section>

              <div className="preflight-next">
                <div>
                  <p className="eyebrow">Selezione pronta</p>
                  <strong>{selectedCount} file verranno descritti come inclusi nel manifest.</strong>
                </div>
                <Button onClick={() => onNavigate('configuration')}>Continua alla configurazione</Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
