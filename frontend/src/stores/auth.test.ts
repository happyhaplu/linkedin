import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import type { AuthUser } from '@/api/auth'

// Mock the authApi module — we test store logic, not HTTP
vi.mock('@/api/auth', () => ({
  authApi: {
    me: vi.fn(),
    profile: vi.fn(),
    signout: vi.fn(),
  },
}))

import { authApi } from '@/api/auth'

// ── Test fixtures ────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'user-001',
  email: 'test@example.com',
  subscribed: true,
  plan: 'Starter',
  plan_type: 'custom',
  plan_status: 'active',
  plan_active: true,
  sender_limit: 3,
  workspace_id: 'ws-001',
  ...overrides,
})

// ── Pinia setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

// ── Initial state ────────────────────────────────────────────────────────────

describe('useAuthStore — initial state', () => {
  it('user is null before fetchUser', () => {
    const store = useAuthStore()
    expect(store.user).toBeNull()
  })

  it('loading is true before fetchUser', () => {
    const store = useAuthStore()
    expect(store.loading).toBe(true)
  })

  it('isAuthenticated is false before fetchUser', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
  })

  it('hasPlan is false before fetchUser', () => {
    const store = useAuthStore()
    expect(store.hasPlan).toBe(false)
  })

  it('planStatus defaults to inactive', () => {
    const store = useAuthStore()
    expect(store.planStatus).toBe('inactive')
  })

  it('senderLimit defaults to 0', () => {
    const store = useAuthStore()
    expect(store.senderLimit).toBe(0)
  })
})

// ── fetchUser — success ───────────────────────────────────────────────────────

describe('useAuthStore.fetchUser — success', () => {
  it('sets user from API response', async () => {
    const user = makeUser()
    vi.mocked(authApi.me).mockResolvedValueOnce({ user })

    const store = useAuthStore()
    await store.fetchUser()

    expect(store.user).toEqual(user)
  })

  it('sets loading=false after fetch', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({ user: makeUser() })
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.loading).toBe(false)
  })

  it('sets checked=true after fetch', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({ user: makeUser() })
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.checked).toBe(true)
  })

  it('isAuthenticated becomes true', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({ user: makeUser() })
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.isAuthenticated).toBe(true)
  })
})

// ── fetchUser — failure ───────────────────────────────────────────────────────

describe('useAuthStore.fetchUser — failure', () => {
  it('sets user to null on 401', async () => {
    vi.mocked(authApi.me).mockRejectedValueOnce(new Error('Authentication required'))
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.user).toBeNull()
  })

  it('sets loading=false even on error', async () => {
    vi.mocked(authApi.me).mockRejectedValueOnce(new Error('Authentication required'))
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.loading).toBe(false)
  })

  it('sets checked=true even on error', async () => {
    vi.mocked(authApi.me).mockRejectedValueOnce(new Error('Network error'))
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.checked).toBe(true)
  })
})

// ── Computed: hasPlan ─────────────────────────────────────────────────────────

describe('useAuthStore — hasPlan computed', () => {
  it('returns true when plan_active=true', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({ user: makeUser({ plan_active: true }) })
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.hasPlan).toBe(true)
  })

  it('returns false when plan_active=false', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({ user: makeUser({ plan_active: false }) })
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.hasPlan).toBe(false)
  })

  it('returns false when plan_active is null', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({
      user: makeUser({ plan_active: null as unknown as boolean }),
    })
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.hasPlan).toBe(false)
  })
})

// ── Computed: planStatus ──────────────────────────────────────────────────────

describe('useAuthStore — planStatus computed', () => {
  it('returns the plan_status from user', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({ user: makeUser({ plan_status: 'trialing' }) })
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.planStatus).toBe('trialing')
  })

  it("returns 'inactive' when user is null", () => {
    const store = useAuthStore()
    expect(store.planStatus).toBe('inactive')
  })

  it("returns 'inactive' when plan_status is empty string", async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({ user: makeUser({ plan_status: '' }) })
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.planStatus).toBe('inactive')
  })
})

// ── Computed: senderLimit ─────────────────────────────────────────────────────

describe('useAuthStore — senderLimit computed', () => {
  it('returns sender_limit from user', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({ user: makeUser({ sender_limit: 10 }) })
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.senderLimit).toBe(10)
  })

  it('returns 0 when user is null', () => {
    const store = useAuthStore()
    expect(store.senderLimit).toBe(0)
  })
})

// ── signOut ───────────────────────────────────────────────────────────────────

describe('useAuthStore.signOut', () => {
  it('sets user to null after signout', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({ user: makeUser() })
    vi.mocked(authApi.signout).mockResolvedValueOnce({ logout_url: 'https://accounts.example.com/logout' })

    const store = useAuthStore()
    await store.fetchUser()
    expect(store.user).not.toBeNull()

    await store.signOut()
    expect(store.user).toBeNull()
  })

  it('falls back to /login redirect on signout error', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({ user: makeUser() })
    vi.mocked(authApi.signout).mockRejectedValueOnce(new Error('Network error'))

    const store = useAuthStore()
    await store.fetchUser()
    await store.signOut()

    // On error the catch block redirects to /login but user is NOT cleared
    expect(window.location.href).toContain('/login')
  })
})

// ── userEmail computed ────────────────────────────────────────────────────────

describe('useAuthStore — userEmail', () => {
  it('returns email from user', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({ user: makeUser({ email: 'jane@acme.com' }) })
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.userEmail).toBe('jane@acme.com')
  })

  it('returns empty string when user is null', () => {
    const store = useAuthStore()
    expect(store.userEmail).toBe('')
  })
})
