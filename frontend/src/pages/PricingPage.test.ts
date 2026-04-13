import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

// Stripe web component is a custom element — vitest doesn't need to render it
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { email: 'test@example.com', plan_active: false },
    isAuthenticated: true,
    hasPlan: false,
    planStatus: 'inactive',
  })),
}))

import PricingPage from '@/pages/PricingPage.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/pricing', component: PricingPage },
    { path: '/linkedin-account', component: { template: '<div>App</div>' } },
  ],
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('PricingPage', () => {
  it('renders the page heading', () => {
    const wrapper = mount(PricingPage, {
      global: {
        plugins: [router],
        stubs: {
          'stripe-pricing-table': true,
          'router-link': true,
        },
      },
    })
    expect(wrapper.text()).toContain('Choose your plan')
  })

  it('shows the user email in the header', () => {
    const wrapper = mount(PricingPage, {
      global: {
        plugins: [router],
        stubs: {
          'stripe-pricing-table': true,
          'router-link': true,
        },
      },
    })
    expect(wrapper.text()).toContain('test@example.com')
  })

  it('shows "Back to app" link for authenticated users', () => {
    const wrapper = mount(PricingPage, {
      global: {
        plugins: [router],
        stubs: {
          'stripe-pricing-table': true,
          RouterLink: {
            template: '<a><slot /></a>',
            props: ['to'],
          },
        },
      },
    })
    expect(wrapper.text()).toContain('Back to app')
  })

  it('shows the custom plan / enterprise section', () => {
    const wrapper = mount(PricingPage, {
      global: {
        plugins: [router],
        stubs: {
          'stripe-pricing-table': true,
          'router-link': true,
        },
      },
    })
    // Enterprise / custom plan features should be rendered
    expect(wrapper.text()).toContain('Custom')
  })

  it('renders the subscription plans section', () => {
    const wrapper = mount(PricingPage, {
      global: {
        plugins: [router],
        stubs: {
          'router-link': true,
        },
      },
    })
    // The section heading is always rendered
    expect(wrapper.text()).toContain('Subscription Plans')
  })
})
