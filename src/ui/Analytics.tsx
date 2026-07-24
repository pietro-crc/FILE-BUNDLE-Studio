import { useEffect } from 'react'

export function Analytics() {
  useEffect(() => {
    const token = import.meta.env.VITE_CF_BEACON_TOKEN
    if (!token) return

    const existingScript = document.querySelector('script[src*="cloudflareinsights"]')
    if (existingScript) return

    const script = document.createElement('script')
    script.defer = true
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js'
    script.setAttribute('data-cf-beacon', JSON.stringify({ token }))
    document.body.appendChild(script)
  }, [])

  return null
}
