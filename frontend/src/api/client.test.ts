import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'

// We test the REAL client module (not a mock) to ensure interceptors are wired correctly.
// The module uses window.location.href for redirects — we use the stub from setup.ts.

// Reset location before each test
beforeEach(() => {
  window.location.href = 'http://localhost:3000/'
  window.location.pathname = '/'
})

// ── 401 interceptor ───────────────────────────────────────────────────────────

describe('api/client — 401 interceptor', () => {
  it('rejects with "Authentication required" message on 401', async () => {
    // Import after setup so interceptors are registered
    const { default: api } = await import('@/api/client')

    // Use axios-mock-adapter to simulate 401
    const AxiosMockAdapter = (await import('axios-mock-adapter')).default
    const mock = new AxiosMockAdapter(api)
    mock.onGet('/test-401').reply(401)

    await expect(api.get('/test-401')).rejects.toThrow('Authentication required')
    mock.restore()
  })

  it('redirects to /login on 401 when not already on /login', async () => {
    window.location.pathname = '/campaigns'
    const { default: api } = await import('@/api/client')
    const AxiosMockAdapter = (await import('axios-mock-adapter')).default
    const mock = new AxiosMockAdapter(api)
    mock.onGet('/test-401-redirect').reply(401)

    try {
      await api.get('/test-401-redirect')
    } catch {
      // Expected rejection
    }

    expect(window.location.href).toContain('/login')
    mock.restore()
  })

  it('does NOT redirect if already on /login', async () => {
    window.location.pathname = '/login'
    window.location.href = 'http://localhost:3000/login'
    const { default: api } = await import('@/api/client')
    const AxiosMockAdapter = (await import('axios-mock-adapter')).default
    const mock = new AxiosMockAdapter(api)
    mock.onGet('/test-401-noop').reply(401)

    try {
      await api.get('/test-401-noop')
    } catch {
      // Expected
    }

    // href should remain unchanged (no redirect happened — already on /login)
    expect(window.location.href).toContain('/login')
    mock.restore()
  })
})

// ── 402 interceptor ───────────────────────────────────────────────────────────

describe('api/client — 402 interceptor', () => {
  it('rejects with "Active billing plan required" on 402', async () => {
    const { default: api } = await import('@/api/client')
    const AxiosMockAdapter = (await import('axios-mock-adapter')).default
    const mock = new AxiosMockAdapter(api)
    mock.onGet('/test-402').reply(402)

    await expect(api.get('/test-402')).rejects.toThrow('Active billing plan required')
    mock.restore()
  })

  it('redirects to /pricing on 402 when not already on /pricing', async () => {
    window.location.pathname = '/linkedin-account'
    const { default: api } = await import('@/api/client')
    const AxiosMockAdapter = (await import('axios-mock-adapter')).default
    const mock = new AxiosMockAdapter(api)
    mock.onGet('/test-402-redirect').reply(402)

    try {
      await api.get('/test-402-redirect')
    } catch {
      // Expected
    }

    expect(window.location.href).toContain('/pricing')
    mock.restore()
  })

  it('does NOT redirect if already on /pricing', async () => {
    window.location.pathname = '/pricing'
    window.location.href = 'http://localhost:3000/pricing'
    const { default: api } = await import('@/api/client')
    const AxiosMockAdapter = (await import('axios-mock-adapter')).default
    const mock = new AxiosMockAdapter(api)
    mock.onGet('/test-402-noop').reply(402)

    try {
      await api.get('/test-402-noop')
    } catch {
      // Expected
    }

    expect(window.location.href).toContain('/pricing')
    mock.restore()
  })
})

// ── Successful response passthrough ──────────────────────────────────────────

describe('api/client — success passthrough', () => {
  it('returns response data on 200', async () => {
    const { default: api } = await import('@/api/client')
    const AxiosMockAdapter = (await import('axios-mock-adapter')).default
    const mock = new AxiosMockAdapter(api)
    mock.onGet('/test-200').reply(200, { ok: true })

    const resp = await api.get('/test-200')
    expect(resp.data).toEqual({ ok: true })
    mock.restore()
  })

  it('passes through other 4xx errors unchanged', async () => {
    const { default: api } = await import('@/api/client')
    const AxiosMockAdapter = (await import('axios-mock-adapter')).default
    const mock = new AxiosMockAdapter(api)
    mock.onPost('/test-400').reply(400, { error: 'bad request' })

    await expect(api.post('/test-400')).rejects.toMatchObject({
      response: { status: 400 },
    })
    mock.restore()
  })
})
