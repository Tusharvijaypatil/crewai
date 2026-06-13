import { defineConfig, devices } from '@playwright/test'

// Builds + previews the app in mock mode (VITE_USE_MOCKS=true), so the e2e needs
// no backend and no API keys — the same offline demo story as the rest of the app.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: { VITE_USE_MOCKS: 'true' },
  },
})
