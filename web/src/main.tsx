import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { auth, collectionsApi } from './lib/store'

// On boot: validate the stored JWT, then load the user's collections.
// Both are fire-and-forget — if auth fails, RequireAuth redirects to /login.
void auth.bootstrap().then(() => collectionsApi.load()).catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
