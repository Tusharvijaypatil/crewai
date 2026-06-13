import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/utils'
import { SubmitPage } from './Submit'

// Drives the real mock pipeline (VITE_USE_MOCKS defaults to true) through the page,
// exercising the internal ResultState for both routing outcomes.
describe('SubmitPage → ResultState', () => {
  async function runSample(sample: string) {
    const user = userEvent.setup()
    renderWithProviders(<SubmitPage />, { route: '/app/submit' })
    await user.click(screen.getByRole('button', { name: sample }))
    await user.click(screen.getByRole('button', { name: /run triage/i }))
  }

  it('renders the grounded reply for an auto-resolved ticket', async () => {
    await runSample('Answerable')

    expect(await screen.findByText('Auto-resolved', undefined, { timeout: 4000 })).toBeInTheDocument()
    // grounded reply text from the mock pipeline
    expect(screen.getByText(/Based on our documentation/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /view full trace/i })).toBeInTheDocument()
  })

  it('shows the escalation reason count and no reply for an escalated ticket', async () => {
    await runSample('P1 outage')

    expect(await screen.findByText('In review', undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText(/held for a human/i)).toBeInTheDocument()
    expect(screen.getByText(/reason/i)).toBeInTheDocument()
    // an escalated ticket carries no auto-reply
    expect(screen.queryByText(/Based on our documentation/i)).not.toBeInTheDocument()
  })
})
