import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { strToU8, zipSync } from 'fflate'

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

async function openApp(page: import('@playwright/test').Page): Promise<void> {
  await page.setContent(await loadCompiledApplication())
  await expect(page.getByRole('heading', { level: 1, name: /Prepare your project for AI/i })).toBeVisible()
}

async function processFiles(
  page: import('@playwright/test').Page,
  files: Parameters<import('@playwright/test').FileChooser['setFiles']>[0],
): Promise<void> {
  await page.getByLabel('Select multiple files').setInputFiles(files)
  await expect(page.getByText('Project Acquired')).toBeVisible()
  await page.getByRole('button', { name: 'Start processing' }).click()
  await expect(page.getByText('PROCESSING COMPLETE')).toBeVisible({ timeout: 15000 })
}

test('renders the browser-only landing page without network requests', async ({ page }) => {
  const networkRequests = watchNetwork(page)
  await openApp(page)

  await expect(page.getByRole('status', { name: 'Privacy status' })).toContainText('LOCAL ONLY')
  await expect(page.getByRole('region', { name: 'Drag and drop area for files or folders' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select ZIP', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Select Folder', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Multiple Files', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Start processing' })).toBeDisabled()

  expect(networkRequests).toEqual([])
})

test('converts selected files into downloadable AI bundle outputs', async ({ page }) => {
  const networkRequests = watchNetwork(page)
  await openApp(page)

  await processFiles(page, [
    { name: 'README.md', mimeType: 'text/markdown', buffer: Buffer.from('# Local project') },
    { name: 'config.json', mimeType: 'application/json', buffer: Buffer.from('{}') },
  ])

  await expect(page.getByRole('button', { name: 'Download Package (.ZIP)' })).toBeVisible()
  await expect(page.getByRole('button', { name: '.MD' })).toBeVisible()
  await expect(page.getByRole('button', { name: '.PDF' })).toBeVisible()
  await expect(page.getByRole('button', { name: '.JSON' })).toBeVisible()
  await expect(page.getByRole('region', { name: /steps to feed your project/i })).toBeVisible()

  expect(networkRequests).toEqual([])
})

test('processes a ZIP archive locally and keeps source content out of the page', async ({ page }) => {
  const networkRequests = watchNetwork(page)
  await openApp(page)

  const archive = zipSync({ 'docs/readme.md': strToU8('# ZIP project') })
  await page.getByLabel('Select ZIP archive').setInputFiles({
    name: 'project.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(archive),
  })
  await page.getByRole('button', { name: 'Start processing' }).click()

  await expect(page.getByText('PROCESSING COMPLETE')).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'Download Package (.ZIP)' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('ZIP project')
  expect(networkRequests).toEqual([])
})

test('keeps the landing and results layouts usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openApp(page)

  await expect(page.getByRole('status', { name: 'Privacy status' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Drag and drop area for files or folders' })).toBeVisible()
  let horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(horizontalOverflow).toBe(false)

  await processFiles(page, {
    name: 'README.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Narrow viewport project'),
  })
  horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(horizontalOverflow).toBe(false)
})
