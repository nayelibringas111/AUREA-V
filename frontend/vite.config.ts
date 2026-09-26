import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    // En desarrollo, /api se redirige al backend local para evitar CORS
    proxy: { '/api': 'http://localhost:8000', '/health': 'http://localhost:8000' },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          data: ['@tanstack/react-query', 'axios', 'zod', 'react-hook-form'],
        },
      },
    },
  },
})
