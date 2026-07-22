import { Button } from '../ui/Button'
import { SectionIntro } from '../ui/SectionIntro'
import { ArrowRightIcon, CheckIcon, ShieldCheckIcon } from '../ui/icons'
import type { WorkflowStepId } from './workflow'

interface IntroductionScreenProps {
  onNavigate: (step: WorkflowStepId) => void
}

const CAPABILITIES = [
  'Mantiene percorsi, struttura e provenienza dei file.',
  'Distingue conversioni complete, parziali e non supportate.',
  'Prepara PDF, Markdown e manifest JSON con riferimenti incrociati.',
] as const

export function IntroductionScreen({ onNavigate }: IntroductionScreenProps) {
  return (
    <div className="screen screen--introduction">
      <SectionIntro
        actions={
          <>
            <Button onClick={() => onNavigate('import')}>
              Esplora l’importazione
              <ArrowRightIcon />
            </Button>
            <Button onClick={() => onNavigate('preflight')} variant="secondary">
              Vedi il flusso completo
            </Button>
          </>
        }
        description="Trasforma cartelle, file e archivi ZIP in un pacchetto leggibile dagli assistenti AI, senza caricare i contenuti su server esterni."
        eyebrow="Privacy-first · Browser-only"
        title="Il tuo progetto, preparato localmente per l’analisi AI."
      />

      <section className="principles-grid" aria-label="Principi principali">
        <article className="principle-card principle-card--accent">
          <ShieldCheckIcon />
          <div>
            <p className="principle-card__label">Privacy verificabile</p>
            <h2>Nessun upload</h2>
            <p>I file restano nel browser. Niente account, backend, telemetria o conversioni cloud.</p>
          </div>
        </article>
        <article className="principle-card">
          <p className="principle-card__label">Output principale</p>
          <h2>Tre famiglie coordinate</h2>
          <p>PDF per la resa visuale, Markdown per il contenuto e JSON come indice autorevole.</p>
        </article>
        <article className="principle-card">
          <p className="principle-card__label">Supporto trasparente</p>
          <h2>Nessuna falsa universalità</h2>
          <p>Ogni file riceve uno stato, una capacità dichiarata e una motivazione comprensibile.</p>
        </article>
      </section>

      <section className="capability-panel" aria-labelledby="capability-title">
        <div>
          <p className="eyebrow">Esperienza prevista</p>
          <h2 id="capability-title">Una pipeline leggibile, anche per progetti complessi.</h2>
          <p>
            Prima di elaborare, AI Bundle Studio mostra dimensioni, formati, rischi e limiti. Gli errori restano isolati al singolo file.
          </p>
        </div>
        <ul>
          {CAPABILITIES.map((capability) => (
            <li key={capability}>
              <CheckIcon />
              <span>{capability}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
