import { useEffect, useState } from 'react'
import type { WorkflowStepId } from '../../app/workflow'
import { createManifestV1 } from '../../core/manifest/generate'
import type { ManifestArtifact } from '../../core/manifest/types'
import type { PreflightReport, PreflightSelection, RecommendedOutputMode } from '../../core/preflight/types'
import type { VirtualFileSystem } from '../../core/vfs/types'
import type { SecretHandlingMode } from '../../core/security/types'
import { AvailabilityNotice } from '../../ui/AvailabilityNotice'
import { Button } from '../../ui/Button'
import { SectionIntro } from '../../ui/SectionIntro'

interface ConfigurationScreenProps {
  readonly fileSystem: VirtualFileSystem | null
  readonly preflightReport: PreflightReport | null
  readonly preflightSelection: PreflightSelection
  readonly manifestArtifact: ManifestArtifact | null
  readonly onManifestArtifact: (artifact: ManifestArtifact) => void
  readonly onNavigate: (step: WorkflowStepId) => void
}

const SETTINGS = [
  ['Archivi annidati', 'Disattivati', 'La ricorsione richiederà profondità e limiti cumulativi espliciti.'],
  ['Contenuto testuale', 'Completo', 'Troncamento e sharding saranno configurabili e dichiarati.'],
] as const

const OUTPUT_MODE_LABELS: Readonly<Record<RecommendedOutputMode, string>> = {
  'three-files': 'Tre file',
  multipart: 'Multipart sicura',
  'quick-preview': 'Anteprima rapida',
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

export function ConfigurationScreen({
  fileSystem,
  manifestArtifact,
  onManifestArtifact,
  onNavigate,
  preflightReport,
  preflightSelection,
}: ConfigurationScreenProps) {
  const [projectName, setProjectName] = useState('project')
  const [outputMode, setOutputMode] = useState<RecommendedOutputMode>(preflightReport?.recommendation.mode ?? 'three-files')
  const [secretHandling, setSecretHandling] = useState<SecretHandlingMode>('report-only')
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState('Manifest v1 non ancora generato per la selezione corrente.')

  useEffect(() => {
    if (preflightReport) setOutputMode(preflightReport.recommendation.mode)
  }, [preflightReport])

  useEffect(() => {
    if (!manifestArtifact) setStatus('Manifest v1 non ancora generato per la selezione corrente.')
  }, [manifestArtifact])

  const generateManifest = async () => {
    if (!fileSystem || !preflightReport) return
    setIsGenerating(true)
    setStatus('Generazione e validazione locale del manifest in corso…')
    try {
      const artifact = await createManifestV1(fileSystem, preflightReport, preflightSelection, {
        outputMode,
        projectName,
        secretHandling,
      })
      onManifestArtifact(artifact)
      setStatus(artifact.validation.valid
        ? 'Manifest v1 generato e validato senza errori.'
        : `Manifest generato con ${artifact.validation.errors.length} errori di validazione.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Generazione manifest non riuscita.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="screen">
      <SectionIntro
        description="Definisci modalità e metadati iniziali, poi costruisci l’indice autorevole senza leggere nuovamente il contenuto dei file."
        eyebrow="Fase 04 · Configurazione"
        title="Scegli come rappresentare il progetto."
      />

      {!fileSystem || !preflightReport ? (
        <section className="manifest-empty" aria-labelledby="manifest-empty-title">
          <p className="eyebrow">Prerequisiti mancanti</p>
          <h2 id="manifest-empty-title">Importazione e preflight devono essere completi.</h2>
          <p>Il manifest può descrivere soltanto un VFS corrente già classificato e una selezione esplicita.</p>
          <div className="manifest-empty__actions">
            <Button onClick={() => onNavigate(fileSystem ? 'preflight' : 'import')}>
              {fileSystem ? 'Vai al preflight' : 'Vai all’importazione'}
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section className="manifest-builder" aria-labelledby="manifest-builder-title" aria-busy={isGenerating}>
            <div className="manifest-builder__intro">
              <p className="eyebrow">Manifest JSON v1</p>
              <h2 id="manifest-builder-title">Crea una baseline metadata-only e verificabile.</h2>
              <p>Gli ID dipendono dal tipo di nodo e dal percorso normalizzato. Gli hash dei byte originali restano dichiarati come pending fino alla fase di elaborazione.</p>
            </div>
            <div className="manifest-builder__controls">
              <label>
                <span>Nome progetto</span>
                <input maxLength={120} onChange={(event) => setProjectName(event.target.value)} type="text" value={projectName} />
              </label>
              <label>
                <span>Modalità pianificata</span>
                <select onChange={(event) => setOutputMode(event.target.value as RecommendedOutputMode)} value={outputMode}>
                  <option value="three-files">Tre file</option>
                  <option value="multipart">Multipart sicura</option>
                  <option value="quick-preview">Anteprima rapida</option>
                </select>
              </label>
              <label>
                <span>Gestione segreti</span>
                <select onChange={(event) => setSecretHandling(event.target.value as SecretHandlingMode)} value={secretHandling}>
                  <option value="report-only">Segnala soltanto</option>
                  <option value="redact">Redigi nelle rappresentazioni</option>
                  <option value="exclude">Escludi file segnalati</option>
                </select>
              </label>
              <Button disabled={isGenerating} onClick={() => void generateManifest()}>
                {manifestArtifact ? 'Rigenera manifest v1' : 'Genera manifest v1'}
              </Button>
            </div>
          </section>
          <p className="manifest-status" role="status" aria-live="polite">{status}</p>

          {manifestArtifact ? (
            <section className={`manifest-result manifest-result--${manifestArtifact.validation.valid ? 'valid' : 'invalid'}`} aria-labelledby="manifest-result-title">
              <div className="manifest-result__header">
                <div>
                  <p className="eyebrow">{manifestArtifact.validation.valid ? 'Schema e coerenza validi' : 'Validazione non superata'}</p>
                  <h2 id="manifest-result-title">Manifest {manifestArtifact.manifest.schemaVersion} · {formatBytes(manifestArtifact.byteLength)}</h2>
                </div>
                <span className="manifest-result__badge">{manifestArtifact.validation.valid ? 'Valido' : `${manifestArtifact.validation.errors.length} errori`}</span>
              </div>
              <dl className="manifest-result__metrics">
                <div><dt>File inclusi</dt><dd>{manifestArtifact.manifest.summary.includedFileCount}</dd></div>
                <div><dt>File esclusi</dt><dd>{manifestArtifact.manifest.summary.excludedFileCount}</dd></div>
                <div><dt>Directory</dt><dd>{manifestArtifact.manifest.summary.directoryCount}</dd></div>
                <div><dt>Modalità</dt><dd>{OUTPUT_MODE_LABELS[manifestArtifact.manifest.settings.outputMode]}</dd></div>
                <div><dt>Segreti</dt><dd>{manifestArtifact.manifest.settings.secretHandling}</dd></div>
              </dl>
              {!manifestArtifact.validation.valid ? (
                <ul className="manifest-errors">
                  {manifestArtifact.validation.errors.slice(0, 10).map((error) => (
                    <li key={`${error.code}-${error.path}`}><code>{error.path}</code><span>{error.message}</span></li>
                  ))}
                </ul>
              ) : null}
              <details className="manifest-preview">
                <summary>Anteprima JSON canonica</summary>
                <pre>{manifestArtifact.json.slice(0, 6000)}{manifestArtifact.json.length > 6000 ? '\n… anteprima limitata …' : ''}</pre>
              </details>
              <p className="manifest-result__note">La policy segreti viene applicata durante l’estrazione senza inserire valori sensibili nel manifest. Il download, gli hash originali e i riferimenti PDF/Markdown verranno completati negli step di elaborazione e output.</p>
              {manifestArtifact.validation.valid ? (
                <div className="manifest-result__actions">
                  <Button onClick={() => onNavigate('processing')}>Continua all’elaborazione</Button>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      <AvailabilityNotice step="STEP-012">
        La configurazione completa verrà collegata progressivamente ai motori introdotti negli step tecnici successivi.
      </AvailabilityNotice>

      <section className="settings-list" aria-label="Anteprima delle impostazioni future">
        {SETTINGS.map(([label, value, description]) => (
          <article className="setting-row" key={label}>
            <div>
              <h2>{label}</h2>
              <p>{description}</p>
            </div>
            <button disabled type="button">
              {value}
            </button>
          </article>
        ))}
      </section>
    </div>
  )
}
