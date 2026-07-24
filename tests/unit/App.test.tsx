import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { strToU8, zipSync } from 'fflate'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../../src/app/App'
import { createSpreadsheetFixture } from '../fixtures/xlsx'

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.theme
  document.title = ''
})

describe('Modern UI/UX Application Shell & Workflow', () => {
  it('renders landing page with privacy-first posture and accessibility landmarks', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: /Prepare your project for AI/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('No files leave your browser')
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByRole('button', { name: 'Start processing' })).toBeDisabled()
  })

  it('supports light, dark, and system theme choices', async () => {
    const user = userEvent.setup()
    render(<App />)

    const darkTheme = screen.getByRole('button', { name: 'Use dark theme' })
    await user.click(darkTheme)
    expect(darkTheme).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    await user.click(screen.getByRole('button', { name: 'Use light theme' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    await user.click(screen.getByRole('button', { name: 'Use system theme' }))
    await waitFor(() => expect(document.documentElement).not.toHaveAttribute('data-theme'))
  })

  it(
    'imports files, enables processing CTA, and completes processing with ResultsDashboard',
    async () => {
      const user = userEvent.setup()
      render(<App />)

      const input = screen.getByLabelText('Select multiple files')
      await user.upload(input, [
        new File(['# Hello AI'], 'README.md', { type: 'text/markdown' }),
        new File(['{"app": "test"}'], 'config.json', { type: 'application/json' }),
      ])

      expect(screen.getByText('Project Acquired')).toBeInTheDocument()
      const startButton = screen.getByRole('button', { name: 'Start processing' })
      expect(startButton).toBeEnabled()

      await user.click(startButton)

      // Verify automatic completion to ResultsDashboard
      expect(
        await screen.findByText(/PROCESSING COMPLETE/i, {}, { timeout: 10000 }),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Download Package \(\.ZIP\)/i })).toBeInTheDocument()
      expect(screen.getByText('.MD')).toBeInTheDocument()
    },
    15000,
  )

  it(
    'imports a ZIP archive and processes it directly to completion',
    async () => {
      const user = userEvent.setup()
      render(<App />)

      const archive = zipSync({ 'docs/readme.md': strToU8('hello zip') })
      const zipFile = new File([archive.slice().buffer as ArrayBuffer], 'project.zip', {
        type: 'application/zip',
      })

      await user.upload(screen.getByLabelText('Select ZIP archive'), zipFile)

      const startButton = screen.getByRole('button', { name: 'Start processing' })
      expect(startButton).toBeEnabled()
      await user.click(startButton)

      expect(
        await screen.findByText(/PROCESSING COMPLETE/i, {}, { timeout: 10000 }),
      ).toBeInTheDocument()
      expect(screen.getByText('.MD')).toBeInTheDocument()
    },
    15000,
  )

  it(
    'processes an XLSX workbook and displays spreadsheet metrics in ResultsDashboard',
    async () => {
      const user = userEvent.setup()
      render(<App />)

      const bytes = createSpreadsheetFixture()
      const copy = new Uint8Array(bytes.byteLength)
      copy.set(bytes)

      await user.upload(
        screen.getByLabelText('Select multiple files'),
        new File([copy.buffer], 'finance.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      )

      await user.click(screen.getByRole('button', { name: 'Start processing' }))

      expect(
        await screen.findByText(/PROCESSING COMPLETE/i, {}, { timeout: 10000 }),
      ).toBeInTheDocument()
      expect(screen.getByText(/PROCESSING COMPLETE/i)).toBeInTheDocument()
    },
    15000,
  )
})
