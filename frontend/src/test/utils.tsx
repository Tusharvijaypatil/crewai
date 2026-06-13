import type { ReactElement, ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/** A QueryClient tuned for tests: no retries, no background chatter. */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
}

interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string
  client?: QueryClient
}

/**
 * Render a component inside the providers the app relies on (TanStack Query +
 * react-router). Returns the QueryClient so tests can seed/inspect the cache.
 */
export function renderWithProviders(ui: ReactElement, options: ProviderOptions = {}) {
  const { route = '/', client = makeQueryClient(), ...renderOptions } = options

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }

  return { client, ...render(ui, { wrapper: Wrapper, ...renderOptions }) }
}

/** Wrapper for `renderHook` when only the QueryClient is needed (no router). */
export function queryWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}
