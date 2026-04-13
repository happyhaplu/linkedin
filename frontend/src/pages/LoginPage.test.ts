import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

// Mock auth store + router dependencies
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    checked: false,
    isAuthenticated: false,
    fetchUser: vi.fn().mockResolvedValue(undefined),
    user: null,
  })),
}))

// Minimal stub router (avoids importing full router with lazy-loaded pages)
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
    { path: '/linkedin-account', component: { template: '<div>LinkedIn</div>' } },
    { path: '/login', component: { template: '<div>Login</div>' } },
  ],
})

import LoginPage from '@/pages/LoginPage.vue'
import { useAuthStore } from '@/stores/auth'

beforeEach(() => {
  setActivePinia(createPinia())
  window.location.href = ''
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('renders the Reach brand and loading text', async () => {
    const wrapper = mount(LoginPage, {
      global: {
        plugins: [router],
        stubs: {
          'router-link': true,
          'router-view': true,
        },
      },
    })

    await router.isReady()
    // Template is always rendered (onMounted may redirect but DOM should have content)
    expect(wrapper.find('h1').text()).toContain('Reach')
    expect(wrapper.text()).toContain('Redirecting to login')
  })

  it('redirects to accounts.gour.io when not authenticated', async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      checked: true, // already checked
      isAuthenticated: false,
      fetchUser: vi.fn().mockResolvedValue(undefined),
      user: null,
    } as any)

    mount(LoginPage, { global: { plugins: [router] } })
    await router.isReady()
    // onMounted triggers redirect — allow microtasks to flush
    await new Promise((r) => setTimeout(r, 10))

    expect(window.location.href).toContain('accounts.gour.io')
  })

  it('redirects to /linkedin-account when already authenticated', async () => {
    const replaceFn = vi.fn()
    vi.mocked(useAuthStore).mockReturnValue({
      checked: true,
      isAuthenticated: true,
      fetchUser: vi.fn().mockResolvedValue(undefined),
      user: { email: 'user@example.com' },
    } as any)

    // Override router.replace for this test
    const localRouter = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/linkedin-account', component: { template: '<div>LinkedIn</div>' } },
        { path: '/login', component: { template: '<div>Login</div>' } },
      ],
    })
    localRouter.replace = replaceFn

    mount(LoginPage, { global: { plugins: [localRouter] } })
    await localRouter.isReady()
    await new Promise((r) => setTimeout(r, 10))

    expect(replaceFn).toHaveBeenCalledWith('/linkedin-account')
  })
})
