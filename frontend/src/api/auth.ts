import api from './client'

export interface AuthUser {
  id: string
  email: string
  subscribed: boolean
  plan: string
  plan_type: 'stripe' | 'custom' | null
  plan_status: string
  plan_active: boolean
  sender_limit: number
  workspace_id: string
}

export interface ProfileData {
  user: AuthUser
  accounts_url: string
  manage_account_url: string
  billing_url: string
}

export const authApi = {
  /** GET /api/auth/me — returns current user from session cookie */
  me(): Promise<{ user: AuthUser }> {
    return api.get('/auth/me').then((r) => r.data)
  },

  /** GET /api/profile — returns user profile + accounts management URLs */
  profile(): Promise<ProfileData> {
    return api.get('/profile').then((r) => r.data)
  },

  /** POST /auth/signout — clears session, returns Accounts logout URL */
  signout(): Promise<{ logout_url: string }> {
    // Note: signout is on /auth, not /api/auth (no RequireAuth middleware)
    return api.post('/auth/signout', null, { baseURL: '' }).then((r) => r.data)
  },
}
