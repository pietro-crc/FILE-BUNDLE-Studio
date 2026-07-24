import type { ReactNode } from 'react'

interface OutputPlaceholderProps {
  extension: string
  title: string
  description: string
  icon: ReactNode
}

export function OutputPlaceholder({ description, extension, icon, title }: OutputPlaceholderProps) {
  return (
    <article className="output-placeholder">
      <div className="output-placeholder__icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <span className="output-placeholder__extension">{extension}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button disabled type="button">
        Non disponibile
      </button>
    </article>
  )
}
