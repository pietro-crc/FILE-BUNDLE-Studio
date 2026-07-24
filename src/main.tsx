import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'

// Handle Vite dynamic import chunk missing errors after deployments automatically
window.addEventListener('vite:preload-error', (event) => {
  event.preventDefault()
  window.location.reload()
})

const root = document.getElementById('root')

if (!root) {
  throw new Error('Application root element was not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
