import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendUrl = process.env.BACKEND_URL
if (!backendUrl) {
  throw new Error('BACKEND_URL is required (e.g. http://backend:8080 in Docker, http://localhost:8080 locally)')
}

const host = process.env.VITE_HOST ?? '127.0.0.1'
const port = Number(process.env.VITE_PORT ?? 5173)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host,
    port,
    strictPort: true,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
})
