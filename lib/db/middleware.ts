/**
 * Cookie-based session middleware.
 *
 * Reads the session cookie (JWT signed by Go backend), decodes the payload
 * (without re-verifying — the cookie is HttpOnly and signed server-side),
 * and enforces authentication + subscription on protected routes.
 */

import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'reach-session'

// ── JWT payload decoder (no signature verification) ─────────────────────────

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // base64url → base64
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const json = atob(b64)
    const payload = JSON.parse(json)
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// ── Middleware ───────────────────────────────────────────────────────────────

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const payload = token ? decodeJwtPayload(token) : null
  const user = payload?.sub ? { id: payload.sub, email: payload.email } : null

  // Routes that require authentication + active subscription
  const protectedPaths = [
    '/dashboard',
    '/my-network',
    '/campaigns',
    '/leads',
    '/unibox',
    '/linkedin-account',
    '/profile',
    '/analytics',
  ]

  // Paths that always pass through without any auth checks
  const bypassPaths = [
    '/api/',
    '/auth',
    '/login',
    '/signup',
  ]

  const path = request.nextUrl.pathname

  // ── Bypass paths — never intercept ────────────────────────────────────
  if (bypassPaths.some((p) => path.startsWith(p))) {
    // If user is already authenticated and subscribed, redirect from login to dashboard
    if ((path === '/login' || path === '/signup') && user && payload?.subscribed) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  const isProtectedPath = protectedPaths.some((p) => path.startsWith(p))

  // ── Protected routes — require auth + subscription ────────────────────
  if (isProtectedPath) {
    if (!user || !payload?.subscribed) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', path)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}
