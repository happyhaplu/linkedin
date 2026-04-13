import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

// Mock admin API
vi.mock('@/api/admin', () => ({
  admin: {
    login: vi.fn(),
    logout: vi.fn(),
    listUsers: vi.fn(),
    listPlans: vi.fn(),
  },
}))

import AdminLoginPage from '@/pages/admin/AdminLoginPage.vue'
import { admin } from '@/api/admin'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/admin/login', component: AdminLoginPage },
    { path: '/admin/users', component: { template: '<div>Users</div>' } },
  ],
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('AdminLoginPage', () => {
  it('renders email and password inputs', () => {
    const wrapper = mount(AdminLoginPage, {
      global: { plugins: [router] },
    })
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })

  it('renders a login button', () => {
    const wrapper = mount(AdminLoginPage, {
      global: { plugins: [router] },
    })
    const btn = wrapper.find('button[type="submit"]')
    expect(btn.exists()).toBe(true)
  })

  it('calls admin.login with email and password on submit', async () => {
    vi.mocked(admin.login).mockResolvedValueOnce(undefined as any)

    const wrapper = mount(AdminLoginPage, {
      global: { plugins: [router] },
    })

    await wrapper.find('input[type="email"]').setValue('happy.outcraftly@zohomail.in')
    await wrapper.find('input[type="password"]').setValue('System@123321')
    await wrapper.find('form').trigger('submit')

    expect(admin.login).toHaveBeenCalledWith('happy.outcraftly@zohomail.in', 'System@123321')
  })

  it('shows error message on failed login', async () => {
    vi.mocked(admin.login).mockRejectedValueOnce({
      response: { data: { error: 'Invalid credentials' } },
    })

    const wrapper = mount(AdminLoginPage, {
      global: { plugins: [router] },
    })

    await wrapper.find('input[type="email"]').setValue('wrong@example.com')
    await wrapper.find('input[type="password"]').setValue('wrongpass')
    await wrapper.find('form').trigger('submit')

    // Wait for async error to resolve
    await new Promise((r) => setTimeout(r, 10))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Invalid credentials')
  })

  it('disables form submission while loading', async () => {
    // Make login hang indefinitely (never resolves)
    vi.mocked(admin.login).mockReturnValue(new Promise(() => {}))

    const wrapper = mount(AdminLoginPage, {
      global: { plugins: [router] },
    })

    await wrapper.find('input[type="email"]').setValue('admin@test.com')
    await wrapper.find('input[type="password"]').setValue('pass123')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    // Button should be disabled during loading
    const btn = wrapper.find('button[type="submit"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })
})
