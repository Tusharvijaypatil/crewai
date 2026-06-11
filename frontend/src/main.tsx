import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/space-grotesk'
import './index.css'

import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'

import { LandingPage } from '@/pages/Landing'
import { Skeleton } from '@/components/ui'

// Route-level code-splitting: the landing page ships in the entry bundle;
// the dashboard (and its heavier deps) load on demand when /app is visited.
const AppLayout = lazy(() => import('@/components/AppLayout').then((m) => ({ default: m.AppLayout })))
const OverviewPage = lazy(() => import('@/pages/Overview').then((m) => ({ default: m.OverviewPage })))
const SubmitPage = lazy(() => import('@/pages/Submit').then((m) => ({ default: m.SubmitPage })))
const TicketDetailPage = lazy(() => import('@/pages/TicketDetail').then((m) => ({ default: m.TicketDetailPage })))
const QueuePage = lazy(() => import('@/pages/Queue').then((m) => ({ default: m.QueuePage })))
const HealthPage = lazy(() => import('@/pages/Health').then((m) => ({ default: m.HealthPage })))

/** Suspense fallback in the same skeleton language as the in-page loaders. */
function RouteFallback() {
  return (
    <div className="min-h-screen bg-ink-900">
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-8 sm:px-8 lg:pl-72">
        <Skeleton className="h-8 w-44" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } },
})

const withSuspense = (el: React.ReactNode) => <Suspense fallback={<RouteFallback />}>{el}</Suspense>

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    path: '/app',
    element: withSuspense(<AppLayout />),
    children: [
      { index: true, element: withSuspense(<OverviewPage />) },
      { path: 'submit', element: withSuspense(<SubmitPage />) },
      { path: 'tickets/:id', element: withSuspense(<TicketDetailPage />) },
      { path: 'queue', element: withSuspense(<QueuePage />) },
      { path: 'health', element: withSuspense(<HealthPage />) },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <RouterProvider router={router} />
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-ink-800)',
              border: '1px solid var(--color-line)',
              color: 'var(--color-fg)',
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
