import { redirect } from 'next/navigation'
import { getAccountsLoginUrl } from '@/lib/accounts'

/**
 * /signup — Fallback page.
 *
 * Registration is handled by Accounts. The middleware normally redirects
 * before this page renders, but we keep a server-side redirect as a safety net.
 */
export default function SignUpPage() {
  redirect(getAccountsLoginUrl())
}
