import type { MarkdownArtifactSnapshot } from '../../core/markdown/types'
import type { ManifestArtifact } from '../../core/manifest/types'
import { AvailabilityNotice } from '../../ui/AvailabilityNotice'
import { OutputPlaceholder } from '../../ui/OutputPlaceholder'
import { SectionIntro } from '../../ui/SectionIntro'
import { ArchiveIcon, FilesIcon } from '../../ui/icons'

interface ResultsScreenProps {
  readonly manifestArtifact: ManifestArtifact | null
  readonly markdownSnapshot: MarkdownArtifactSnapshot | null
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

export function ResultsScreen({ manifestArtifact, markdownSnapshot }: ResultsScreenProps) {
  const imageCount = markdownSnapshot?.imageFiles ?? 0
  const imageLabel = `${imageCount} ${imageCount === 1 ? 'immagine' : 'immagini'}`
  return (
    <div className="screen">
      <SectionIntro
        description="Controlla dimensioni, parti, warning e coerenza prima che download e hashing degli output vengano collegati."
        eyebrow="Fase 06 · Risultati"
        title="Output chiari, verificabili e pronti per l’AI."
      />

      <AvailabilityNotice step="STEP-011">
        Download, hash degli output e archivio di conservazione non sono ancora disponibili. L’artifact Markdown resta soltanto nella memoria locale della sessione.
      </AvailabilityNotice>

      <section className="output-grid" aria-label="Output previsti">
        {markdownSnapshot?.documentsPages ? (
          <article className="output-placeholder output-placeholder--ready">
            <div className="output-placeholder__icon"><FilesIcon /></div>
            <div>
              <span className="output-placeholder__extension">.PDF · GENERATO</span>
              <h2>Documenti</h2>
              <p>{markdownSnapshot.documentsPages} pagine, {formatBytes(markdownSnapshot.documentsBytes)}, validazione {markdownSnapshot.documentsValid ? 'superata' : 'non superata'}. Pagine PDF originali copiate senza rasterizzazione quando possibile.</p>
            </div>
            <button disabled type="button">Download nello STEP-011</button>
          </article>
        ) : (
          <OutputPlaceholder
            description="Rappresentazione visuale multipagina con separatori, indici e riferimenti ai file originali."
            extension=".PDF"
            icon={<FilesIcon />}
            title="Documenti"
          />
        )}
        {markdownSnapshot ? (
          <article className="output-placeholder output-placeholder--ready">
            <div className="output-placeholder__icon"><FilesIcon /></div>
            <div>
              <span className="output-placeholder__extension">.MD · GENERATO</span>
              <h2>Contenuto</h2>
              <p>{markdownSnapshot.partCount} {markdownSnapshot.partCount === 1 ? 'parte' : 'parti'}, {formatBytes(markdownSnapshot.totalBytes)}, validazione {markdownSnapshot.valid ? 'superata' : 'non superata'}.</p>
            </div>
            <button disabled type="button">Download nello STEP-011</button>
          </article>
        ) : (
          <OutputPlaceholder
            description="Testo, codice, workbook e metadati con anchor deterministiche, delimitatori sicuri e troncamento dichiarato."
            extension=".MD"
            icon={<FilesIcon />}
            title="Contenuto"
          />
        )}
        <article className={`output-placeholder${manifestArtifact ? ' output-placeholder--ready' : ''}`}>
          <div className="output-placeholder__icon"><ArchiveIcon /></div>
          <div>
            <span className="output-placeholder__extension">.JSON{manifestArtifact ? ' · VALIDATO' : ''}</span>
            <h2>Manifest</h2>
            <p>{manifestArtifact ? `Manifest ${manifestArtifact.manifest.schemaVersion}, ${formatBytes(manifestArtifact.byteLength)}, ${manifestArtifact.validation.valid ? 'valido' : 'non valido'}.` : 'Indice autorevole di percorsi, stati, hash, warning, esclusioni e riferimenti incrociati.'}</p>
          </div>
          <button disabled type="button">Download nello STEP-011</button>
        </article>
      </section>


      {markdownSnapshot ? (
        <section className={`markdown-result ${markdownSnapshot.secretFindings > 0 ? 'markdown-result--warning' : 'markdown-result--valid'}`} aria-labelledby="security-results-title">
          <div>
            <p className="eyebrow">Sicurezza e segreti</p>
            <h2 id="security-results-title">{markdownSnapshot.secretFindings} finding · policy {markdownSnapshot.securityMode}</h2>
            <p>{markdownSnapshot.secretFlaggedFiles} file segnalati, {markdownSnapshot.secretRedactions} redazioni, {markdownSnapshot.secretExcludedFiles} esclusioni e {markdownSnapshot.secretVisualOmissions} omissioni visuali. Il manifest conserva soltanto conteggi e categorie, mai i valori rilevati.</p>
          </div>
        </section>
      ) : null}

      {markdownSnapshot && (markdownSnapshot.pdfDocuments > 0 || markdownSnapshot.imageFiles > 0) ? (
        <section className="markdown-result markdown-result--valid" aria-labelledby="visual-results-title">
          <div>
            <p className="eyebrow">PDF e immagini</p>
            <h2 id="visual-results-title">{markdownSnapshot.pdfDocuments} PDF · {imageLabel}</h2>
            <p>{markdownSnapshot.pdfSourcePages} pagine PDF sorgente e {markdownSnapshot.imageVisualPages} {markdownSnapshot.imageVisualPages === 1 ? 'immagine rappresentata' : 'immagini rappresentate'} nel documento visuale.</p>
          </div>
        </section>
      ) : null}


      {markdownSnapshot?.officeDocuments ? (
        <section className="markdown-result markdown-result--valid" aria-labelledby="office-results-title">
          <div>
            <p className="eyebrow">Documenti Office</p>
            <h2 id="office-results-title">{markdownSnapshot.docxDocuments} DOCX · {markdownSnapshot.presentations} PPTX</h2>
            <p>{markdownSnapshot.presentationSlides} slide e {markdownSnapshot.officePreviewPages} pagine derivate. Macro, formule, relazioni esterne e oggetti incorporati non sono mai eseguiti o caricati.</p>
          </div>
        </section>
      ) : null}

      {markdownSnapshot?.spreadsheetWorkbooks ? (
        <section className="markdown-result markdown-result--valid" aria-labelledby="spreadsheet-results-title">
          <div>
            <p className="eyebrow">Spreadsheet OOXML</p>
            <h2 id="spreadsheet-results-title">{markdownSnapshot.spreadsheetWorkbooks} workbook · {markdownSnapshot.spreadsheetSheets} fogli</h2>
            <p>{markdownSnapshot.spreadsheetFormulaCells} formule riportate come testo; nessuna formula o macro è stata eseguita.</p>
          </div>
        </section>
      ) : null}

      {markdownSnapshot ? (
        <section className="markdown-preview" aria-labelledby="markdown-preview-title">
          <div>
            <p className="eyebrow">Anteprima limitata</p>
            <h2 id="markdown-preview-title">Prima parte, massimo 6.000 caratteri</h2>
          </div>
          <pre>{markdownSnapshot.preview}</pre>
        </section>
      ) : null}
    </div>
  )
}
