import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { auth } from './lib/store'

// On boot: validate the stored JWT and load collections.
// bootstrap() owns both — sets bootstrapping=false when done regardless of outcome.
void auth.bootstrap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
