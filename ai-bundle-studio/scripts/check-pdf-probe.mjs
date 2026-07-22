import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const workerScript = resolve('scripts/pdf-probe-worker.mjs')
const maxAttempts = 2

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const result = spawnSync(process.execPath, [workerScript], {
    encoding: 'utf8',
    env: process.env,
    timeout: 20_000,
    killSignal: 'SIGKILL',
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.stdout?.includes('PDF_PROBE ')) process.exit(0)

  const timedOut = result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGKILL'
  if (!timedOut || attempt === maxAttempts) process.exit(result.status ?? 1)
  console.warn('Retrying the PDF feasibility probe once after an infrastructure timeout.')
}
