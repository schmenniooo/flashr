import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { auth } from './lib/store'

void auth.bootstrap()

if (typeof window !== "undefined") {
  (window as unknown as { flashrSignInAsDemo(): void }).flashrSignInAsDemo =
    () => auth.signInAsDemo();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
