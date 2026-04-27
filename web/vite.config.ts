import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env / .env.local / .env.[mode] files. The empty third arg means
  // "load all vars regardless of prefix" — needed because BACKEND_URL is
  // consumed here in Node, not exposed to client code (which would require
  // a VITE_ prefix).
  const env = loadEnv(mode, process.cwd(), '')

  const backendUrl = env.BACKEND_URL
  if (!backendUrl) {
    throw new Error(
      'BACKEND_URL is required (set it in web/.env, e.g. BACKEND_URL=http://localhost:8080)',
    )
  }

  const host = env.VITE_HOST ?? '127.0.0.1'
  const port = Number(env.VITE_PORT ?? 5173)

  return {
    plugins: [react()],
    server: {
      host,
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  }
})
