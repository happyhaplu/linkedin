/**
 * Client-side auth API — calls the Go backend for auth operations.
 *
 * The Go backend runs at NEXT_PUBLIC_API_URL (default http://localhost:4000).
 * All requests include credentials so cookies are sent cross-origin.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface AuthResult {
  data: any
  error: { message: string } | null
}

class BrowserAuthClient {
  async signOut(): Promise<AuthResult> {
    try {
      await fetch(`${API_URL}/auth/signout`, {
        method: 'POST',
        credentials: 'include',
      })
      return { data: null, error: null }
    } catch (err: any) {
      return { data: null, error: { message: err.message } }
    }
  }

  async getUser(): Promise<{ data: { user: any }; error: any }> {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) {
        return { data: { user: null }, error: { message: json.error || 'Not authenticated' } }
      }
      return { data: { user: json.user }, error: null }
    } catch {
      return { data: { user: null }, error: { message: 'Not authenticated' } }
    }
  }

  /** @deprecated Use Accounts service for password updates */
  async updateUser(_params: { password?: string }): Promise<AuthResult> {
    return {
      data: null,
      error: { message: 'Password changes are managed via Accounts.' },
    }
  }

  /** @deprecated Use Accounts service for signup */
  async signUp(_params: { email: string; password: string }): Promise<AuthResult> {
    return {
      data: null,
      error: { message: 'Sign up is handled via Accounts service.' },
    }
  }

  /** @deprecated Use Accounts service for login */
  async signInWithPassword(_credentials: { email: string; password: string }): Promise<AuthResult> {
    return {
      data: null,
      error: { message: 'Login is handled via Accounts service.' },
    }
  }

  /** @deprecated Use Accounts service for password reset */
  async resetPasswordForEmail(_email: string): Promise<AuthResult> {
    return {
      data: null,
      error: { message: 'Password reset is handled via Accounts service.' },
    }
  }
}

interface BrowserClient {
  auth: BrowserAuthClient
  from: (table: string) => any
}

export function createClient(): BrowserClient {
  return {
    auth: new BrowserAuthClient(),
    // Stub: browser cannot query DB directly. Use server actions instead.
    from: (_table: string) => {
      console.warn('Browser client .from() is a stub — use server actions for DB queries')
      const noop = () => stub
      const stub: any = {
        select: noop, insert: noop, update: noop, delete: noop, upsert: noop,
        eq: noop, neq: noop, in: noop, is: noop, ilike: noop, or: noop,
        order: noop, limit: noop, range: noop, single: noop, maybeSingle: noop,
        then: (resolve: any) => resolve({ data: null, error: { message: 'Use server actions for DB queries' } }),
      }
      return stub
    },
  }
}
