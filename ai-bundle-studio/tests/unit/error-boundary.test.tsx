import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, vi } from 'vitest'
import { ErrorBoundary } from '../../src/ui/ErrorBoundary'

let shouldThrow = true

function FragileChild() {
  if (shouldThrow) throw new Error('sensitive/path/.env: super-secret-password')
  return <p>Recovered</p>
}

afterEach(() => {
  cleanup()
  shouldThrow = true
})

describe('ErrorBoundary', () => {
  it('isolates render failures without exposing exception details and resets the local session', async () => {
    const user = userEvent.setup()
    const onReset = vi.fn(() => {
      shouldThrow = false
    })
    render(
      <ErrorBoundary onReset={onReset}>
        <FragileChild />
      </ErrorBoundary>,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('La schermata corrente non può essere mostrata')
    expect(alert).not.toHaveTextContent('sensitive/path/.env')
    expect(alert).not.toHaveTextContent('super-secret-password')

    await user.click(screen.getByRole('button', { name: 'Azzera la sessione locale' }))
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })
})
