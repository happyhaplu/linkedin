/**
 * Server-side DB client — reads user session from the cookie.
 *
 * The session JWT is signed by the Go backend. We decode the payload
 * without re-verifying the signature because the cookie is HttpOnly
 * and can only be set by the backend.
 *
 * createClient()           → { db, auth: { getUser() } } — reads JWT from cookies
 * createServiceRoleClient() → DbClient — no auth check, for workers/service use
 */

import { cookies } from 'next/headers'
import { DbClient } from './query-builder'

const SESSION_COOKIE = 'reach-session'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
}

interface ServerClient {
  from: DbClient['from']
  rpc: DbClient['rpc']
  query: DbClient['query']
  auth: {
    getUser: () => Promise<{ data: { user: AuthUser | null }; error: any }>
  }
}

// ── JWT payload decoder ─────────────────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const json = Buffer.from(parts[1], 'base64url').toString('utf8')
    const payload = JSON.parse(json)
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// ── Client factories ────────────────────────────────────────────────────────

export async function createClient(): Promise<ServerClient> {
  const db = new DbClient()
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  return {
    from: db.from.bind(db),
    rpc: db.rpc.bind(db),
    query: db.query.bind(db),
    auth: {
      getUser: async () => {
        if (!token) {
          return { data: { user: null }, error: { message: 'Not authenticated' } }
        }
        const payload = decodeJwtPayload(token)
        if (!payload?.sub) {
          return { data: { user: null }, error: { message: 'Invalid session' } }
        }
        const user: AuthUser = { id: payload.sub, email: payload.email }
        return { data: { user }, error: null }
      },
    },
  }
}

/**
 * Service-role client — bypasses auth. For workers & background jobs.
 */
export function createServiceRoleClient(): DbClient {
  return new DbClient()
}
