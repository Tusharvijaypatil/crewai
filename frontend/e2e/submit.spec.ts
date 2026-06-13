import { expect, test } from '@playwright/test'

// End-to-end happy path against the static mock build: submit an answerable ticket,
// watch the pipeline animation, and confirm it auto-resolves with a grounded reply.
test('answerable ticket runs the pipeline and auto-resolves with a reply', async ({ page }) => {
  await page.goto('/app/submit')

  // Load the "Answerable" sample, then run triage.
  await page.getByRole('button', { name: 'Answerable' }).click()
  await page.getByRole('button', { name: /run triage/i }).click()

  // The running pipeline animation appears…
  await expect(page.getByText(/running the agent pipeline/i)).toBeVisible()

  // …then a RESOLVED result with a grounded, cited reply renders.
  await expect(page.getByText('Auto-resolved')).toBeVisible()
  await expect(page.getByText(/based on our documentation/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /view full trace/i })).toBeVisible()
})
