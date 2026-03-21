import { redirect } from 'next/navigation'
import { getAccountsLoginUrl } from '@/lib/accounts'

interface LoginPageProps {
  searchParams: { next?: string }
}

/**
 * /login — immediately redirects to the Accounts service login page.
 * After authentication, Accounts redirects to the Go backend callback,
 * which sets session cookies and sends the user to the dashboard.
 */
export default function LoginPage({ searchParams }: LoginPageProps) {
  const next = searchParams.next || '/dashboard'
  redirect(getAccountsLoginUrl(next))
}
