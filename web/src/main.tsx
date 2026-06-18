import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { auth } from './lib/store'
import { notificationsApi } from './lib/store/notifications'
import posthog from 'posthog-js'
import { PostHogProvider } from '@posthog/react'

posthog.init('phc_y7Tm8rPR2wMcBaT5aAMjJcjrt85Z3kpDkABvyLmxAF8v', {
  api_host: 'https://eu.i.posthog.com',
  capture_pageview: true,
  capture_pageleave: true,
  autocapture: false,
})

void auth.bootstrap().then(() => notificationsApi.init())

if (typeof window !== "undefined") {
  (window as unknown as { flashrSignInAsDemo(): void }).flashrSignInAsDemo =
    () => auth.signInAsDemo();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </PostHogProvider>
  </StrictMode>,
)
