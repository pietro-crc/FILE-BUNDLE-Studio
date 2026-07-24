import type { ReactNode } from 'react'

interface SectionIntroProps {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}

export function SectionIntro({ actions, description, eyebrow, title }: SectionIntroProps) {
  return (
    <header className="section-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1 tabIndex={-1} data-screen-heading>
        {title}
      </h1>
      <p className="section-intro__description">{description}</p>
      {actions ? <div className="section-intro__actions">{actions}</div> : null}
    </header>
  )
}
