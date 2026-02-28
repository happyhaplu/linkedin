'use client'

import { useState } from 'react'

interface InfiniteLoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    email: string
    password: string
    keepSessionAlive: boolean
    autoRefreshCookies: boolean
  }) => Promise<void>
  proxies: any[]
}

export default function InfiniteLoginModal({
  isOpen,
  onClose,
  onSubmit,
  proxies
}: InfiniteLoginModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [keepSessionAlive, setKeepSessionAlive] = useState(true)
  const [autoRefreshCookies, setAutoRefreshCookies] = useState(true)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await onSubmit({
        email,
        password,
        keepSessionAlive,
        autoRefreshCookies
      })

      // Reset form
      setEmail('')
      setPassword('')
      setKeepSessionAlive(true)
      setAutoRefreshCookies(true)
      onClose()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Infinite Login with 2FA
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Browser stays open to maintain permanent session
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LinkedIn Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your.email@example.com"
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LinkedIn Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {/* Infinite Session Options */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="keepSessionAlive"
                checked={keepSessionAlive}
                onChange={(e) => setKeepSessionAlive(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <label htmlFor="keepSessionAlive" className="text-sm font-medium text-gray-900 cursor-pointer">
                  Keep Session Alive (Infinite Login)
                </label>
                <p className="text-xs text-gray-600 mt-1">
                  Browser window stays open in background to maintain LinkedIn session indefinitely
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="autoRefreshCookies"
                checked={autoRefreshCookies}
                onChange={(e) => setAutoRefreshCookies(e.target.checked)}
                disabled={!keepSessionAlive}
                className="mt-1 h-4 w-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
              />
              <div className="flex-1">
                <label 
                  htmlFor="autoRefreshCookies" 
                  className={`text-sm font-medium cursor-pointer ${keepSessionAlive ? 'text-gray-900' : 'text-gray-400'}`}
                >
                  Auto-Refresh Cookies
                </label>
                <p className="text-xs text-gray-600 mt-1">
                  Automatically refresh session cookies every 4 hours to prevent expiration
                </p>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-xs font-medium text-yellow-800">
                  2FA Support Included
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  If LinkedIn requires 2FA verification, you&apos;ll be able to enter the code after clicking connect. The browser will wait for you.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Connecting...
                </span>
              ) : (
                'Connect with Infinite Login'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
