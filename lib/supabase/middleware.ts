import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes that require authentication
  const protectedPaths = [
    '/dashboard',
    '/my-network',
    '/campaigns',
    '/leads',
    '/unibox',
    '/linkedin-account',
    '/profile'
  ]

  // Public paths that don't require authentication
  const publicPaths = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/auth'
  ]

  const path = request.nextUrl.pathname

  // Check if the current path is protected
  const isProtectedPath = protectedPaths.some(protectedPath => 
    path.startsWith(protectedPath)
  )

  const isPublicPath = publicPaths.some(publicPath =>
    path.startsWith(publicPath)
  )

  // Redirect to login if accessing protected route without authentication
  if (isProtectedPath && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to dashboard if accessing auth pages while authenticated
  if (isPublicPath && user && (path === '/login' || path === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}
