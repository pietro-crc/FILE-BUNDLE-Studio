import { Button } from '../ui/Button'
import { SectionIntro } from '../ui/SectionIntro'
import { ArrowRightIcon, CheckIcon, ShieldCheckIcon } from '../ui/icons'
import type { WorkflowStepId } from './workflow'

interface IntroductionScreenProps {
  onNavigate: (step: WorkflowStepId) => void
}

const CAPABILITIES = [
  'Preserves file paths, structure, and provenance.',
  'Distinguishes full, partial, and unsupported conversions.',
  'Prepares PDF, Markdown, and cross-referenced JSON manifests.',
] as const

export function IntroductionScreen({ onNavigate }: IntroductionScreenProps) {
  return (
    <div className="screen screen--introduction">
      <SectionIntro
        actions={
          <>
            <Button onClick={() => onNavigate('import')}>
              Explore Import
              <ArrowRightIcon />
            </Button>
            <Button onClick={() => onNavigate('preflight')} variant="secondary">
              View Full Flow
            </Button>
          </>
        }
        description="Turn folders, files, and ZIP archives into an AI-ready package without uploading content to external servers."
        eyebrow="Privacy-first · Browser-only"
        title="Your project, prepared locally for AI analysis."
      />

      <section className="principles-grid" aria-label="Core principles">
        <article className="principle-card principle-card--accent">
          <ShieldCheckIcon />
          <div>
            <p className="principle-card__label">Verifiable Privacy</p>
            <h2>Zero Uploads</h2>
            <p>Files stay in your browser. No accounts, backends, telemetry, or cloud processing.</p>
          </div>
        </article>
        <article className="principle-card">
          <p className="principle-card__label">Primary Output</p>
          <h2>Three Coordinated Families</h2>
          <p>PDF for visual rendering, Markdown for content, and JSON as an authoritative index.</p>
        </article>
        <article className="principle-card">
          <p className="principle-card__label">Transparent Support</p>
          <h2>No False Universality</h2>
          <p>Every file receives a status, declared capability, and clear explanation.</p>
        </article>
      </section>

      <section className="capability-panel" aria-labelledby="capability-title">
        <div>
          <p className="eyebrow">Expected Experience</p>
          <h2 id="capability-title">A readable pipeline, even for complex projects.</h2>
          <p>
            Before processing, AI Bundle Studio shows sizes, formats, risks, and limits. Failures stay isolated to individual files.
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
