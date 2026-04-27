import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { auth } from './lib/store'

// Validate any stored JWT against the backend before showing protected routes.
// Fire-and-forget: if the token is bad, RequireAuth will redirect on the next
// re-render once bootstrap clears the local session.
void auth.bootstrap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
