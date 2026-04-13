// src/test/setup.ts — Global test setup for Vitest + Vue Test Utils
import { config } from '@vue/test-utils'
import { createPinia } from 'pinia'

// Install Pinia globally for all component tests
config.global.plugins = [createPinia()]

// Stub window.location for redirect tests
// Must provide a real-looking href so vue-router doesn't throw on .includes()
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000/',
    pathname: '/',
    hash: '',
    host: 'localhost:3000',
    origin: 'http://localhost:3000',
    search: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  },
  writable: true,
})
