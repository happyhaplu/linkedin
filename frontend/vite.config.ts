import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Tell Vue to leave stripe-* elements alone (they're Stripe web components)
          isCustomElement: (tag) => tag.startsWith('stripe-'),
        },
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/callback': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        bypass(req) {
          // Let browser page navigations fall through to Vite → Vue Router
          if (req.headers.accept?.includes('text/html')) return req.url
        },
      },
      '/stripe': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) return req.url
        },
      },
    },
  },
})
