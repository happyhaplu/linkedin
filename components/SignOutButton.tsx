'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface SignOutButtonProps {
  fullWidth?: boolean
}

export default function SignOutButton({ fullWidth = false }: SignOutButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/signout`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      // Navigate to Accounts logout page to clear their session too
      if (data.logout_url) {
        window.location.href = data.logout_url
      } else {
        router.push('/login')
        router.refresh()
      }
    } catch (error) {
      console.error('Error signing out:', error)
      router.push('/login')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className={`${fullWidth ? 'w-full' : ''} bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      <span>{loading ? 'Signing out...' : 'Sign Out'}</span>
    </button>
  )
}
