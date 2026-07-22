interface MetricPlaceholderProps {
  label: string
  hint: string
}

export function MetricPlaceholder({ hint, label }: MetricPlaceholderProps) {
  return (
    <article className="metric-placeholder">
      <span>{label}</span>
      <strong aria-label="Dato non ancora disponibile">—</strong>
      <small>{hint}</small>
    </article>
  )
}
