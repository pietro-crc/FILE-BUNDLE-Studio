import { useRef, useState } from 'react'
import type { WorkflowStepId } from '../../app/workflow'
import { createMarkdownArtifactSnapshot } from '../../core/markdown/snapshot'
import type { MarkdownArtifactSnapshot, MarkdownGenerationProgress } from '../../core/markdown/types'
import { generateProjectBundle } from '../../core/output/generate'
import type { ProjectBundle } from '../../core/output/types'
import type { ManifestArtifact } from '../../core/manifest/types'
import type { VirtualFileSystem } from '../../core/vfs/types'
import { AvailabilityNotice } from '../../ui/AvailabilityNotice'
import { Button } from '../../ui/Button'
import { SectionIntro } from '../../ui/SectionIntro'

interface ProcessingScreenProps {
  readonly fileSystem: VirtualFileSystem | null
  readonly manifestArtifact: ManifestArtifact | null
  readonly markdownSnapshot: MarkdownArtifactSnapshot | null
  readonly onGenerated: (bundle: ProjectBundle, snapshot: MarkdownArtifactSnapshot) => void
  readonly onNavigate: (step: WorkflowStepId) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes
  let index = -1
  do {
    value /= 1024
    index += 1
  } while (value >= 1024 && index < units.length - 1)
  return `${value.toLocaleString('it-IT', { maximumFractionDigits: 2 })} ${units[index]}`
}

export function ProcessingScreen({
  fileSystem,
  manifestArtifact,
  markdownSnapshot,
  onGenerated,
  onNavigate,
}: ProcessingScreenProps) {
  const [maxFileKiB, setMaxFileKiB] = useState(1024)
  const [maxCharacters, setMaxCharacters] = useState(1_000_000)
  const [maxPartKiB, setMaxPartKiB] = useState(4096)
  const [includeLineNumbers, setIncludeLineNumbers] = useState(false)
  const [maxWorkbookMiB, setMaxWorkbookMiB] = useState(64)
  const [maxSpreadsheetCells, setMaxSpreadsheetCells] = useState(50_000)
  const [maxSheetRows, setMaxSheetRows] = useState(1_000)
  const [maxSheetColumns, setMaxSheetColumns] = useState(100)
  const [maxPdfMiB, setMaxPdfMiB] = useState(64)
  const [maxPdfPages, setMaxPdfPages] = useState(500)
  const [maxImageMiB, setMaxImageMiB] = useState(64)
  const [maxImageMegapixels, setMaxImageMegapixels] = useState(40)
  const [targetImageMegapixels, setTargetImageMegapixels] = useState(12)
  const [maxDocumentsPages, setMaxDocumentsPages] = useState(2000)
  const [maxOfficeMiB, setMaxOfficeMiB] = useState(64)
  const [maxOfficeSlides, setMaxOfficeSlides] = useState(500)
  const [maxOfficePreviewPages, setMaxOfficePreviewPages] = useState(1000)
  const [maxSecretCharacters, setMaxSecretCharacters] = useState(2_000_000)
  const [maxSecretFindings, setMaxSecretFindings] = useState(100)
  const [scanHighEntropy, setScanHighEntropy] = useState(true)
  const [progress, setProgress] = useState<MarkdownGenerationProgress | null>(null)
  const [status, setStatus] = useState('La pipeline contenuti non è ancora stata avviata.')
  const [isProcessing, setIsProcessing] = useState(false)
  const abortController = useRef<AbortController | null>(null)

  const processMarkdown = async () => {
    if (!fileSystem || !manifestArtifact) return
    const controller = new AbortController()
    abortController.current = controller
    setIsProcessing(true)
    setProgress({ completed: 0, total: manifestArtifact.manifest.files.filter((file) => file.inclusion.included && (file.isText || file.mimeDetected === 'application/pdf' || file.category === 'image' || (file.category === 'spreadsheet' && ['xlsx', 'xlsm'].includes(file.extension)) || (file.category === 'document' && ['docx', 'docm'].includes(file.extension)) || (file.category === 'presentation' && ['pptx', 'pptm'].includes(file.extension)))).length, warnings: 0, errors: 0 })
    setStatus('Estrazione locale, generazione Markdown e assemblaggio PDF visuale in corso…')
    try {
      const bundle = await generateProjectBundle(fileSystem, manifestArtifact, {
        signal: controller.signal,
        policy: {
          maxBytesPerFile: maxFileKiB * 1024,
          maxCharactersPerFile: maxCharacters,
          maxPartBytes: maxPartKiB * 1024,
          includeLineNumbers,
        },
        spreadsheetPolicy: {
          maxWorkbookBytes: maxWorkbookMiB * 1024 * 1024,
          maxCells: maxSpreadsheetCells,
          maxRowsPerSheet: maxSheetRows,
          maxColumnsPerSheet: maxSheetColumns,
        },
        pdfPolicy: { maxPdfBytes: maxPdfMiB * 1024 * 1024, maxPages: maxPdfPages },
        imagePolicy: { maxImageBytes: maxImageMiB * 1024 * 1024, maxMegapixels: maxImageMegapixels, targetMegapixels: targetImageMegapixels },
        officePolicy: { maxDocumentBytes: maxOfficeMiB * 1024 * 1024, maxSlides: maxOfficeSlides, maxPreviewPages: maxOfficePreviewPages },
        documentsPolicy: { maxOutputPages: maxDocumentsPages },
        secretPolicy: { maxCharactersPerFile: maxSecretCharacters, maxFindingsPerFile: maxSecretFindings, scanHighEntropy },
        onProgress: setProgress,
      })
      const snapshot = createMarkdownArtifactSnapshot(bundle.markdown, bundle.documents)
      onGenerated(bundle, snapshot)
      setStatus(bundle.markdown.validation.valid && bundle.documents.validation.valid
        ? `Bundle locale validato: ${snapshot.partCount} parti Markdown e ${snapshot.documentsPages} pagine PDF.`
        : `Bundle generato con errori di coerenza: Markdown ${bundle.markdown.validation.errors.length}, PDF ${bundle.documents.validation.errors.length}.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') setStatus('Elaborazione annullata; nessun artifact parziale è stato conservato.')
      else setStatus(error instanceof Error ? error.message : 'Generazione Markdown non riuscita.')
    } finally {
      abortController.current = null
      setIsProcessing(false)
    }
  }

  const total = progress?.total ?? 0
  const completed = progress?.completed ?? 0
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)

  return (
    <div className="screen">
      <SectionIntro
        description="Estrai testo, PDF, immagini, workbook, DOCX e PPTX con limiti espliciti, Markdown strutturato e un PDF visuale multipagina."
        eyebrow="Fase 05 · Elaborazione"
        title="Genera contenuti AI-readable in modo trasparente."
      />

      {!fileSystem || !manifestArtifact ? (
        <section className="manifest-empty" aria-labelledby="processing-empty-title">
          <p className="eyebrow">Prerequisiti mancanti</p>
          <h2 id="processing-empty-title">Serve un Manifest v1 valido.</h2>
          <p>Importa il progetto, completa il preflight e genera il manifest prima di elaborare contenuti, PDF e immagini.</p>
          <Button onClick={() => onNavigate(manifestArtifact ? 'configuration' : fileSystem ? 'preflight' : 'import')}>Torna ai prerequisiti</Button>
        </section>
      ) : (
        <>
          <section className="markdown-settings" aria-labelledby="markdown-settings-title">
            <div>
              <p className="eyebrow">Testo · Spreadsheet · PDF · Immagini · Office · adapter 1.0.0</p>
              <h2 id="markdown-settings-title">Limiti reversibili e dichiarati</h2>
              <p>Policy segreti: <strong>{manifestArtifact.manifest.settings.secretHandling}</strong>. I byte originali non vengono modificati. PDF cifrati non vengono aggirati, formule e macro non vengono eseguite, relazioni Office esterne non vengono caricate e le immagini sono controllate prima della decodifica.</p>
            </div>
            <div className="markdown-settings__grid">
              <label>
                <span>Limite per file (KiB)</span>
                <input min="1" max="65536" onChange={(event) => setMaxFileKiB(Number(event.target.value))} type="number" value={maxFileKiB} />
              </label>
              <label>
                <span>Limite caratteri</span>
                <input min="1" max="10000000" onChange={(event) => setMaxCharacters(Number(event.target.value))} type="number" value={maxCharacters} />
              </label>
              <label>
                <span>Soglia parte (KiB)</span>
                <input min="4" max="262144" onChange={(event) => setMaxPartKiB(Number(event.target.value))} type="number" value={maxPartKiB} />
              </label>
              <label>
                <span>Workbook massimo (MiB)</span>
                <input min="1" max="512" onChange={(event) => setMaxWorkbookMiB(Number(event.target.value))} type="number" value={maxWorkbookMiB} />
              </label>
              <label>
                <span>Celle massime workbook</span>
                <input min="1" max="1000000" onChange={(event) => setMaxSpreadsheetCells(Number(event.target.value))} type="number" value={maxSpreadsheetCells} />
              </label>
              <label>
                <span>Righe massime per foglio</span>
                <input min="1" max="100000" onChange={(event) => setMaxSheetRows(Number(event.target.value))} type="number" value={maxSheetRows} />
              </label>
              <label>
                <span>Colonne massime per foglio</span>
                <input min="1" max="16384" onChange={(event) => setMaxSheetColumns(Number(event.target.value))} type="number" value={maxSheetColumns} />
              </label>
              <label>
                <span>PDF massimo (MiB)</span>
                <input min="1" max="512" onChange={(event) => setMaxPdfMiB(Number(event.target.value))} type="number" value={maxPdfMiB} />
              </label>
              <label>
                <span>Pagine massime per PDF</span>
                <input min="1" max="5000" onChange={(event) => setMaxPdfPages(Number(event.target.value))} type="number" value={maxPdfPages} />
              </label>
              <label>
                <span>Immagine massima (MiB)</span>
                <input min="1" max="512" onChange={(event) => setMaxImageMiB(Number(event.target.value))} type="number" value={maxImageMiB} />
              </label>
              <label>
                <span>Megapixel massimi</span>
                <input min="1" max="200" onChange={(event) => setMaxImageMegapixels(Number(event.target.value))} type="number" value={maxImageMegapixels} />
              </label>
              <label>
                <span>Target immagini (MP)</span>
                <input min="1" max={maxImageMegapixels} onChange={(event) => setTargetImageMegapixels(Number(event.target.value))} type="number" value={targetImageMegapixels} />
              </label>
              <label>
                <span>Documento Office massimo (MiB)</span>
                <input min="1" max="512" onChange={(event) => setMaxOfficeMiB(Number(event.target.value))} type="number" value={maxOfficeMiB} />
              </label>
              <label>
                <span>Slide massime PPTX</span>
                <input min="1" max="5000" onChange={(event) => setMaxOfficeSlides(Number(event.target.value))} type="number" value={maxOfficeSlides} />
              </label>
              <label>
                <span>Pagine preview Office</span>
                <input min="1" max="5000" onChange={(event) => setMaxOfficePreviewPages(Number(event.target.value))} type="number" value={maxOfficePreviewPages} />
              </label>
              <label>
                <span>Pagine massime PDF finale</span>
                <input min="4" max="10000" onChange={(event) => setMaxDocumentsPages(Number(event.target.value))} type="number" value={maxDocumentsPages} />
              </label>
              <label>
                <span>Caratteri scanner segreti</span>
                <input min="1000" max="10000000" onChange={(event) => setMaxSecretCharacters(Number(event.target.value))} type="number" value={maxSecretCharacters} />
              </label>
              <label>
                <span>Finding massimi per file</span>
                <input min="1" max="1000" onChange={(event) => setMaxSecretFindings(Number(event.target.value))} type="number" value={maxSecretFindings} />
              </label>
              <label className="markdown-checkbox">
                <input checked={scanHighEntropy} onChange={(event) => setScanHighEntropy(event.target.checked)} type="checkbox" />
                <span>Segnala sequenze ad alta entropia</span>
              </label>
              <label className="markdown-checkbox">
                <input checked={includeLineNumbers} onChange={(event) => setIncludeLineNumbers(event.target.checked)} type="checkbox" />
                <span>Includi numeri di riga</span>
              </label>
            </div>
            <div className="markdown-settings__actions">
              <Button disabled={isProcessing} onClick={() => void processMarkdown()}>
                {markdownSnapshot ? 'Rigenera bundle' : 'Genera Markdown e PDF'}
              </Button>
              {isProcessing ? <Button onClick={() => abortController.current?.abort('Richiesta utente')} variant="secondary">Annulla</Button> : null}
            </div>
          </section>

          <p className="manifest-status" role="status" aria-live="polite">{status}</p>

          <section className="processing-placeholder" aria-labelledby="processing-progress-title" aria-busy={isProcessing}>
            <div className="processing-placeholder__header">
              <div>
                <p className="eyebrow">Pipeline contenuti</p>
                <h2 id="processing-progress-title">{progress?.currentPath ?? (markdownSnapshot ? 'Artifact disponibile' : 'In attesa')}</h2>
              </div>
              <strong>{percentage}%</strong>
            </div>
            <div className="progress-track" aria-hidden="true"><span style={{ width: `${percentage}%` }} /></div>
            <dl className="markdown-progress-metrics">
              <div><dt>File completati</dt><dd>{completed}/{total}</dd></div>
              <div><dt>Warning</dt><dd>{progress?.warnings ?? 0}</dd></div>
              <div><dt>Errori isolati</dt><dd>{progress?.errors ?? 0}</dd></div>
              <div><dt>Output corrente</dt><dd>{markdownSnapshot ? formatBytes(markdownSnapshot.totalBytes) : '—'}</dd></div>
            </dl>
          </section>

          {markdownSnapshot ? (
            <section className={`markdown-result markdown-result--${markdownSnapshot.valid ? 'valid' : 'invalid'}`} aria-labelledby="markdown-result-title">
              <div>
                <p className="eyebrow">Validazione incrociata {markdownSnapshot.valid ? 'superata' : 'non superata'}</p>
                <h2 id="markdown-result-title">{markdownSnapshot.partCount} {markdownSnapshot.partCount === 1 ? 'parte Markdown' : 'parti Markdown'} · {formatBytes(markdownSnapshot.totalBytes)}</h2>
              </div>
              <dl className="markdown-progress-metrics">
                <div><dt>Completi</dt><dd>{markdownSnapshot.completedFiles}</dd></div>
                <div><dt>Parziali</dt><dd>{markdownSnapshot.partialFiles}</dd></div>
                <div><dt>Falliti</dt><dd>{markdownSnapshot.failedFiles}</dd></div>
                <div><dt>Sharding</dt><dd>{markdownSnapshot.sharded ? 'Applicato' : 'Non necessario'}</dd></div>
                <div><dt>Workbook</dt><dd>{markdownSnapshot.spreadsheetWorkbooks}</dd></div>
                <div><dt>Fogli</dt><dd>{markdownSnapshot.spreadsheetSheets}</dd></div>
                <div><dt>Formule</dt><dd>{markdownSnapshot.spreadsheetFormulaCells}</dd></div>
                <div><dt>PDF sorgente</dt><dd>{markdownSnapshot.pdfDocuments} · {markdownSnapshot.pdfSourcePages} pagine</dd></div>
                <div><dt>Immagini</dt><dd>{markdownSnapshot.imageFiles} · {markdownSnapshot.imageVisualPages} visuali</dd></div>
                <div><dt>Office</dt><dd>{markdownSnapshot.officeDocuments} · {markdownSnapshot.officePreviewPages} pagine</dd></div>
                <div><dt>DOCX</dt><dd>{markdownSnapshot.docxDocuments}</dd></div>
                <div><dt>PPTX</dt><dd>{markdownSnapshot.presentations} · {markdownSnapshot.presentationSlides} slide</dd></div>
                <div><dt>PDF finale</dt><dd>{markdownSnapshot.documentsPages} pagine · {formatBytes(markdownSnapshot.documentsBytes)}</dd></div>
                <div><dt>File segnalati</dt><dd>{markdownSnapshot.secretFlaggedFiles}</dd></div>
                <div><dt>Finding segreti</dt><dd>{markdownSnapshot.secretFindings}</dd></div>
                <div><dt>Redazioni</dt><dd>{markdownSnapshot.secretRedactions}</dd></div>
                <div><dt>Esclusioni policy</dt><dd>{markdownSnapshot.secretExcludedFiles}</dd></div>
                <div><dt>Preview fogli</dt><dd>{markdownSnapshot.spreadsheetPreviewPages} pagine · {formatBytes(markdownSnapshot.spreadsheetPreviewBytes)}</dd></div>
              </dl>
              <Button onClick={() => onNavigate('results')}>Controlla i risultati</Button>
            </section>
          ) : null}
        </>
      )}

      <AvailabilityNotice step="STEP-010">
        Questa baseline usa scheduling cooperativo e letture lazy. Worker, coda concorrente, backpressure e recovery arriveranno nello step di orchestrazione.
      </AvailabilityNotice>
    </div>
  )
}
