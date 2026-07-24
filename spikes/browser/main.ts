import { runAllProbes } from './probes'

const output = document.querySelector<HTMLPreElement>('#probe-output')
const button = document.querySelector<HTMLButtonElement>('#run-probes')

if (!output || !button) {
  throw new Error('Spike page controls are missing')
}

button.addEventListener('click', async () => {
  button.disabled = true
  output.textContent = 'Running local browser probes…'
  try {
    const results = await runAllProbes()
    output.textContent = JSON.stringify(results, null, 2)
  } catch (error) {
    output.textContent = error instanceof Error ? error.stack ?? error.message : String(error)
  } finally {
    button.disabled = false
  }
})
