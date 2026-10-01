import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Este arquivo roda no Node; o tsconfig do frontend não inclui os tipos do Node.
declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // API_URL permite apontar para outro backend (ex.: um de teste). Padrão: o backend local.
      '/api': process.env.API_URL || 'http://localhost:3333',
    },
  },
})
