/**
 * Accounts service integration — Edge-compatible.
 *
 * Handles communication with the central Accounts service for
 * authentication-token verification and subscription checks.
 *
 * Every export in this file is safe to use in Next.js middleware (Edge Runtime)
 * because it only relies on `fetch` and basic string operations.
 */

// ── Configuration ────────────────────────────────────────────────────────────

/** Public URL of the Accounts app (used for browser redirects). */
export const ACCOUNTS_URL =
  process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:5173'

/**
 * Server-to-server API URL.
 * Falls back to the public URL so a single env var is enough in simple setups.
 * In Docker / k8s you can point this at an internal hostname instead.
 */
export const ACCOUNTS_API_URL =
  process.env.ACCOUNTS_API_URL || ACCOUNTS_URL

/** This app's own public URL (used to build the callback that Accounts redirects to). */
export const REACH_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/** Cookie that persists the raw Accounts token for future server-to-server calls. */
export const ACCOUNTS_TOKEN_COOKIE = 'reach-accounts-token'

// ── Types ────────────────────────────────────────────────────────────────────

export interface AccountsUser {
  id: string
  email: string
  name?: string
}

export interface SubscriptionStatus {
  active: boolean
  plan?: string
  trial?: boolean
  expires_at?: string
}

export interface AccountsVerifyResponse {
  user: AccountsUser
  subscription: SubscriptionStatus
}

// ── API helpers (fetch-only — Edge-safe) ─────────────────────────────────────

/**
 * Verify a token with the Accounts API.
 * Calls the product check endpoint to validate the launch token
 * and return subscription status. Returns null when the token is
 * invalid or the request fails.
 *
 * NOTE: In the normal auth flow the Go backend verifies launch tokens
 * locally (HS256 shared secret). This function is here for any
 * edge-case where the Next.js frontend needs to verify directly.
 */
export async function verifyAccountsToken(
  token: string,
): Promise<AccountsVerifyResponse | null> {
  try {
    const res = await fetch(`${ACCOUNTS_API_URL}/api/v1/products/reach/check`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as AccountsVerifyResponse
  } catch (err) {
    console.error('[Accounts] Token verification failed:', err)
    return null
  }
}

/**
 * Standalone subscription check — useful for periodic re-verification
 * without going through the full token-verify flow.
 */
export async function checkSubscription(
  token: string,
): Promise<SubscriptionStatus> {
  try {
    const res = await fetch(`${ACCOUNTS_API_URL}/api/v1/products/reach/check`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
    if (!res.ok) return { active: false }
    return await res.json()
  } catch (err) {
    console.error('[Accounts] Subscription check failed:', err)
    return { active: false }
  }
}

// ── URL builders (pure string ops — Edge-safe) ──────────────────────────────

/**
 * Build the Accounts login URL.
 *
 * Uses the product launch path so Accounts handles auth → subscription
 * check → launch token signing → redirect back to Go backend callback.
 *
 * IMPORTANT: The redirect_uri must NOT contain query parameters because
 * Accounts appends `?token=<jwt>` literally. If the redirect_uri already
 * has a `?`, the resulting URL gets a double `?` and the token is lost.
 * After login the user always lands on /dashboard.
 */
export function getAccountsLoginUrl(_redirectAfterLogin?: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  // Plain callback URL — no query params (avoids Accounts double-? bug)
  const callbackUrl = `${apiUrl}/auth/callback`

  const launchUrl = new URL('/products/reach/launch', ACCOUNTS_URL)
  launchUrl.searchParams.set('redirect_uri', callbackUrl)
  return launchUrl.toString()
}

/** Accounts billing / upgrade page. */
export function getAccountsBillingUrl(): string {
  return `${ACCOUNTS_URL}/billing`
}

/** Accounts sign-out URL (clears the Accounts-side session). */
export function getAccountsSignOutUrl(): string {
  return `${ACCOUNTS_URL}/logout`
}
