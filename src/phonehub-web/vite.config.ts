import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// Dev: proxy /api, /images, /uploads sang ASP.NET Core → cùng origin, cookie refresh SameSite=Strict hoạt động.
const apiTarget = process.env.PHONEHUB_API ?? 'http://localhost:5080'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
      '/images': { target: apiTarget },
      '/uploads': { target: apiTarget },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: { environment: 'node' },
})
