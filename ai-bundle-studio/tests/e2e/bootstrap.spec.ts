import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { createEncryptedPdfFixture, createPdfFixture, createPngFixture } from '../fixtures/media'
import { createDocxProductionFixture, createPptxProductionFixture } from '../fixtures/office'
import { createSpreadsheetFixture } from '../fixtures/xlsx'

async function loadCompiledApplication(): Promise<string> {
  const assetsDirectory = resolve('dist-e2e/assets')
  const assets = await readdir(assetsDirectory)
  const scriptName = assets.find((name) => /^index-.*\.js$/.test(name))
  const styleName = assets.find((name) => /^index-.*\.css$/.test(name))

  if (!scriptName || !styleName) {
    throw new Error('Compiled application assets were not found')
  }

  const [script, style] = await Promise.all([
    readFile(resolve(assetsDirectory, scriptName), 'utf8'),
    readFile(resolve(assetsDirectory, styleName), 'utf8'),
  ])

  return `<style>${style}</style><div id="root"></div><script type="module">${script}</script>`
}

function watchNetwork(page: import('@playwright/test').Page): string[] {
  const networkRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith('http://') || request.url().startsWith('https://')) {
      networkRequests.push(request.url())
    }
  })
  return networkRequests
}

test('renders and navigates the compiled STEP-007 shell without network requests', async ({ page }) => {
  const networkRequests = watchNetwork(page)
  await page.setContent(await loadCompiledApplication())

  await expect(page.getByRole('heading', { level: 1, name: /Il tuo progetto, preparato localmente/i })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Stato privacy' })).toContainText('Nessun file lascia il browser')

  await page.getByRole('navigation', { name: 'Fasi di AI Bundle Studio' }).getByRole('button', { name: /Importazione/i }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Porta il progetto nel browser.' })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Seleziona ZIP' })).toBeEnabled()

  await page.getByLabel('Seleziona più file').setInputFiles([
    { name: 'README.md', mimeType: 'text/markdown', buffer: Buffer.from('# Local project') },
    { name: 'config.json', mimeType: 'application/json', buffer: Buffer.from('{}') },
  ])
  await expect(page.getByRole('heading', { level: 2, name: 'Struttura normalizzata' })).toBeVisible()
  await expect(page.getByText('README.md')).toBeVisible()
  await expect(page.locator('.import-status')).toContainText('2 file acquisiti')

  await page.getByRole('button', { name: 'Usa tema scuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  expect(networkRequests).toEqual([])
})

test('generates and cross-validates Markdown locally at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const networkRequests = watchNetwork(page)
  await page.setContent(await loadCompiledApplication())

  const navigation = page.getByRole('navigation', { name: 'Fasi di AI Bundle Studio' })
  await navigation.getByRole('button', { name: /Importazione/i }).click()
  await page.getByLabel('Seleziona più file').setInputFiles({
    name: 'README.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Local project\n\n```ts\nconst value = 1\n```'),
  })
  await page.getByRole('button', { name: 'Analizza progetto' }).click()
  await page.getByRole('button', { name: 'Esegui preflight' }).click()
  await page.getByRole('button', { name: 'Continua alla configurazione' }).click()
  await page.getByRole('button', { name: 'Genera manifest v1' }).click()
  await page.getByRole('button', { name: 'Continua all’elaborazione' }).click()
  await page.getByRole('button', { name: 'Genera Markdown e PDF' }).click()

  await expect(page.getByRole('heading', { level: 2, name: /1 parte Markdown/ })).toBeVisible()
  await page.getByRole('button', { name: 'Controlla i risultati' }).click()
  await expect(page.getByText('.MD · GENERATO')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Prima parte, massimo 6.000 caratteri' })).toBeVisible()
  await expect(page.locator('.markdown-preview pre')).toContainText('File: README.md')
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(horizontalOverflow).toBe(false)

  expect(networkRequests).toEqual([])
})

test('imports files and completes the bounded preflight workflow', async ({ page }) => {
  const networkRequests = watchNetwork(page)
  await page.setContent(await loadCompiledApplication())

  const navigation = page.getByRole('navigation', { name: 'Fasi di AI Bundle Studio' })
  await navigation.getByRole('button', { name: /Importazione/i }).click()
  await page.getByLabel('Seleziona più file').setInputFiles([
    { name: 'README.md', mimeType: 'text/markdown', buffer: Buffer.from('# Local project') },
    { name: '.env', mimeType: 'text/plain', buffer: Buffer.from('TOKEN=fake') },
    { name: 'program.txt', mimeType: 'text/plain', buffer: Buffer.from([0x4d, 0x5a, 0, 0]) },
  ])
  await page.getByRole('button', { name: 'Analizza progetto' }).click()
  await page.getByRole('button', { name: 'Esegui preflight' }).click()

  await expect(page.getByRole('heading', { level: 2, name: /Anteprima rapida|Tre file|Multipart sicura/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Metriche preflight' })).toContainText('3')
  await expect(page.getByLabel('Includi program.txt')).toBeDisabled()
  await page.getByRole('combobox', { name: 'Rischio' }).selectOption('high')
  await expect(page.getByText('.env')).toBeVisible()
  await expect(page.getByText('README.md')).toHaveCount(0)

  await page.getByRole('button', { name: 'Continua alla configurazione' }).click()
  await page.getByLabel('Nome progetto').fill('E2E / Manifest')
  await page.getByRole('button', { name: 'Genera manifest v1' }).click()
  await expect(page.getByRole('heading', { level: 2, name: /Manifest 1\.0\.0/ })).toBeVisible()
  await expect(page.getByText('Valido')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('TOKEN=fake')

  expect(networkRequests).toEqual([])
})

test('keeps navigation and privacy status usable at a narrow desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.setContent(await loadCompiledApplication())

  await expect(page.getByRole('status', { name: 'Stato privacy' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Fasi di AI Bundle Studio' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Fasi di AI Bundle Studio' }).getByRole('button', { name: /Risultati/i }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Output chiari, verificabili/i })).toBeVisible()

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(horizontalOverflow).toBe(false)
})


test('processes an XLSX workbook into Markdown and a local spreadsheet PDF preview', async ({ page }) => {
  const networkRequests = watchNetwork(page)
  await page.setContent(await loadCompiledApplication())
  const workbook = createSpreadsheetFixture()
  const navigation = page.getByRole('navigation', { name: 'Fasi di AI Bundle Studio' })
  await navigation.getByRole('button', { name: /Importazione/i }).click()
  await page.getByLabel('Seleziona più file').setInputFiles({
    name: 'finance.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(workbook),
  })
  await page.getByRole('button', { name: 'Analizza progetto' }).click()
  await page.getByRole('button', { name: 'Esegui preflight' }).click()
  await page.getByRole('button', { name: 'Continua alla configurazione' }).click()
  await page.getByRole('button', { name: 'Genera manifest v1' }).click()
  await page.getByRole('button', { name: 'Continua all’elaborazione' }).click()
  await page.getByRole('button', { name: 'Genera Markdown e PDF' }).click()
  await expect(page.getByRole('heading', { level: 2, name: /1 parte Markdown/ })).toBeVisible()
  await page.getByRole('button', { name: 'Controlla i risultati' }).click()
  await expect(page.getByText('.PDF · GENERATO')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: /1 workbook · 2 fogli/ })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(horizontalOverflow).toBe(false)
  expect(networkRequests).toEqual([])
})


test('extracts a local PDF, represents an image, and maps both into the documents PDF', async ({ page }) => {
  const networkRequests = watchNetwork(page)
  await page.setContent(await loadCompiledApplication())
  const pdf = await createPdfFixture(2)
  const png = createPngFixture()
  const navigation = page.getByRole('navigation', { name: 'Fasi di AI Bundle Studio' })

  await navigation.getByRole('button', { name: /Importazione/i }).click()
  await page.getByLabel('Seleziona più file').setInputFiles([
    { name: 'manual.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) },
    { name: 'diagram.png', mimeType: 'image/png', buffer: Buffer.from(png) },
  ])
  await page.getByRole('button', { name: 'Analizza progetto' }).click()
  await page.getByRole('button', { name: 'Esegui preflight' }).click()
  await page.getByRole('button', { name: 'Continua alla configurazione' }).click()
  await page.getByRole('button', { name: 'Genera manifest v1' }).click()
  await page.getByRole('button', { name: 'Continua all’elaborazione' }).click()
  await page.getByRole('button', { name: 'Genera Markdown e PDF' }).click()

  await expect(page.getByRole('heading', { level: 2, name: /1 parte Markdown/ })).toBeVisible()
  await expect(page.getByText('PDF sorgente').locator('..')).toContainText('1 · 2 pagine')
  await expect(page.getByText('Immagini', { exact: true }).locator('..')).toContainText('1 · 1 visuali')
  await page.getByRole('button', { name: 'Controlla i risultati' }).click()
  await expect(page.getByText('.PDF · GENERATO')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: '1 PDF · 1 immagine' })).toBeVisible()
  await expect(page.locator('.markdown-preview pre')).toContainText('AI Bundle PDF page 1')
  await expect(page.locator('.markdown-preview pre')).toContainText('Dimensioni originali: 2 × 1 px')
  expect(networkRequests).toEqual([])
})


test('isolates a password-protected PDF without attempting a bypass', async ({ page }) => {
  const networkRequests = watchNetwork(page)
  await page.setContent(await loadCompiledApplication())
  const navigation = page.getByRole('navigation', { name: 'Fasi di AI Bundle Studio' })
  await navigation.getByRole('button', { name: /Importazione/i }).click()
  await page.getByLabel('Seleziona più file').setInputFiles({
    name: 'protected.pdf', mimeType: 'application/pdf', buffer: Buffer.from(createEncryptedPdfFixture()),
  })
  await page.getByRole('button', { name: 'Analizza progetto' }).click()
  await page.getByRole('button', { name: 'Esegui preflight' }).click()
  await page.getByRole('button', { name: 'Continua alla configurazione' }).click()
  await page.getByRole('button', { name: 'Genera manifest v1' }).click()
  await page.getByRole('button', { name: 'Continua all’elaborazione' }).click()
  await page.getByRole('button', { name: 'Genera Markdown e PDF' }).click()

  await expect(page.getByText('Falliti', { exact: true }).locator('..')).toContainText('1')
  await expect(page.locator('.manifest-status')).toContainText('Bundle locale validato')
  await page.getByRole('button', { name: 'Controlla i risultati' }).click()
  await expect(page.getByText('.PDF · GENERATO')).toBeVisible()
  await expect(page.locator('.markdown-preview pre')).toContainText('PDF cifrato o protetto da password')
  expect(networkRequests).toEqual([])
})


test('extracts DOCX semantics and PPTX slides without loading active Office content', async ({ page }) => {
  const networkRequests = watchNetwork(page)
  await page.setContent(await loadCompiledApplication())
  const docx = createDocxProductionFixture({ macroEnabled: true, includeImage: true })
  const pptx = createPptxProductionFixture({ macroEnabled: true, advancedFeatures: true })
  const navigation = page.getByRole('navigation', { name: 'Fasi di AI Bundle Studio' })

  await navigation.getByRole('button', { name: /Importazione/i }).click()
  await page.getByLabel('Seleziona più file').setInputFiles([
    {
      name: 'report.docm',
      mimeType: 'application/vnd.ms-word.document.macroEnabled.12',
      buffer: Buffer.from(docx),
    },
    {
      name: 'briefing.pptm',
      mimeType: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
      buffer: Buffer.from(pptx),
    },
  ])
  await page.getByRole('button', { name: 'Analizza progetto' }).click()
  await page.getByRole('button', { name: 'Esegui preflight' }).click()
  await page.getByRole('button', { name: 'Continua alla configurazione' }).click()
  await page.getByRole('button', { name: 'Genera manifest v1' }).click()
  await page.getByRole('button', { name: 'Continua all’elaborazione' }).click()
  await page.getByRole('button', { name: 'Genera Markdown e PDF' }).click()

  await expect(page.getByText('Office', { exact: true }).locator('..')).toContainText('2')
  await expect(page.getByText('DOCX', { exact: true }).locator('..')).toContainText('1')
  await expect(page.getByText('PPTX', { exact: true }).locator('..')).toContainText('1 · 2 slide')
  await page.getByRole('button', { name: 'Controlla i risultati' }).click()
  await expect(page.getByRole('heading', { level: 2, name: '1 DOCX · 1 PPTX' })).toBeVisible()
  await expect(page.locator('.markdown-preview pre')).toContainText('AI Bundle Studio DOCX')
  await expect(page.locator('.markdown-preview pre')).toContainText('Speaker note: emphasize privacy.')
  await expect(page.locator('.markdown-preview pre')).not.toContainText('javascript:alert(1)')
  await expect(page.locator('body')).not.toContainText('https://example.invalid')
  expect(networkRequests).toEqual([])
})

test('redacts detected secrets from derived outputs without changing the local original', async ({ page }) => {
  const networkRequests = watchNetwork(page)
  await page.setContent(await loadCompiledApplication())
  const secret = 'super-secret-password'
  const token = 'AKIAABCDEFGHIJKLMNOP'
  const navigation = page.getByRole('navigation', { name: 'Fasi di AI Bundle Studio' })

  await navigation.getByRole('button', { name: /Importazione/i }).click()
  await page.getByLabel('Seleziona più file').setInputFiles({
    name: '.env',
    mimeType: 'text/plain',
    buffer: Buffer.from(`DATABASE_URL=postgres://demo:${secret}@localhost/app\nAWS_ACCESS_KEY_ID=${token}`),
  })
  await page.getByRole('button', { name: 'Analizza progetto' }).click()
  await page.getByRole('button', { name: 'Esegui preflight' }).click()
  await page.getByRole('button', { name: 'Continua alla configurazione' }).click()
  await page.getByLabel('Gestione segreti').selectOption('redact')
  await page.getByRole('button', { name: 'Genera manifest v1' }).click()
  await page.getByRole('button', { name: 'Continua all’elaborazione' }).click()
  await page.getByRole('button', { name: 'Genera Markdown e PDF' }).click()

  await expect(page.getByText('File segnalati').locator('..')).toContainText('1')
  await expect(page.getByText('Redazioni').locator('..')).not.toContainText('0')
  await page.getByRole('button', { name: 'Controlla i risultati' }).click()
  await expect(page.getByRole('heading', { level: 2, name: /finding · policy redact/ })).toBeVisible()
  await expect(page.locator('.markdown-preview pre')).toContainText('[REDACTED:')
  await expect(page.locator('.markdown-preview pre')).not.toContainText(secret)
  await expect(page.locator('.markdown-preview pre')).not.toContainText(token)
  await expect(page.locator('body')).not.toContainText(secret)
  await expect(page.locator('body')).not.toContainText(token)
  expect(networkRequests).toEqual([])
})
