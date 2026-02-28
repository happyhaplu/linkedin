'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import ProfileDropdown from '@/components/ProfileDropdown'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        router.push('/login')
      } else {
        setUser(user)
      }
      setLoading(false)
    }
    getUser()
  }, [router, supabase])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setUpdating(true)

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      setUpdating(false)
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      setUpdating(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      setSuccess('Password updated successfully!')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      setError(error.message || 'An error occurred while updating password')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4 flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-900">Profile Settings</h1>
            <ProfileDropdown userEmail={user?.email} />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
            <div className="flex items-center mb-8">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-3xl font-bold">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="ml-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile Settings</h1>
                <p className="text-gray-600 mt-1">{user?.email}</p>
                <p className="text-sm text-blue-600 font-medium">Linkedin Automation Account</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Account Details</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    <p className="text-sm font-medium text-gray-600 mb-1">Email Address</p>
                    <p className="text-gray-800">{user?.email}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    <p className="text-sm font-medium text-gray-600 mb-1">User ID</p>
                    <p className="font-mono text-xs text-gray-800 break-all">{user?.id}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    <p className="text-sm font-medium text-gray-600 mb-1">Account Created</p>
                    <p className="text-gray-800">
                      {new Date(user?.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    <p className="text-sm font-medium text-gray-600 mb-1">Email Verified</p>
                    <p className="text-gray-800">
                      {user?.email_confirmed_at ? (
                        <span className="text-green-600 font-medium">✓ Verified</span>
                      ) : (
                        <span className="text-amber-600 font-medium">⚠ Not Verified</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 mt-8 pt-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Change Password</h2>
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
                  {success}
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-6 max-w-md">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                    placeholder="••••••••"
                  />
                  <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updating}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {updating ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
