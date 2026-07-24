import { SparklesIcon } from './icons'

interface AvailabilityNoticeProps {
  readonly active?: boolean
  readonly children: string
  readonly step: string
}

export function AvailabilityNotice({ active = false, children, step }: AvailabilityNoticeProps) {
  return (
    <aside className="availability-notice" aria-label={active ? `Funzione attiva nello ${step}` : `Disponibilità prevista nello ${step}`}>
      <SparklesIcon />
      <div>
        <strong>{active ? 'Acquisizione locale attiva' : 'Shell pronta, funzione non ancora attiva'}</strong>
        <p>
          {children}{active ? '' : ` Sarà implementata e verificata nello ${step}.`}
        </p>
      </div>
    </aside>
  )
}
