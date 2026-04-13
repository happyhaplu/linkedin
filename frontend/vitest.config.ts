import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Treat stripe-pricing-table web component as custom element (not a Vue component)
          isCustomElement: (tag) => tag.startsWith('stripe-'),
        },
      },
    }),
  ],
  test: {
    // Use happy-dom for a lightweight browser-like environment
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Collect coverage from all source files
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/test/**', 'src/main.ts', 'src/types/**'],
    },
    // Allow MSW Service Worker in test
    server: {
      deps: {
        inline: ['msw'],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
