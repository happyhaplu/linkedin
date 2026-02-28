'use client'

import { useState } from 'react'

export default function TestInfiniteLoginPage() {
  const [email, setEmail] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const testCookieAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    try {
      console.log('🧪 Testing cookie authentication...')
      console.log('Email:', email)
      console.log('Secret Key (first 10 chars):', secretKey.substring(0, 10) + '...')

      const response = await fetch('/api/test-cookie-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, secretKey })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Test failed')
      }

      setResult(data)
      console.log('✅ Test result:', data)

    } catch (err: any) {
      console.error('❌ Test error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6">Test Infinite Login</h1>

          <form onSubmit={testCookieAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Secret Key (li_at cookie)
              </label>
              <textarea
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
                rows={3}
                required
                placeholder="Paste your li_at cookie value here"
              />
              <p className="text-xs text-gray-500 mt-1">
                Get this from: LinkedIn → F12 → Application → Cookies → li_at
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Cookie Authentication'}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-900 mb-2">Error</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">✅ Success!</h3>
                <div className="text-sm space-y-2">
                  {result.profileData?.name && (
                    <p><strong>Name:</strong> {result.profileData.name}</p>
                  )}
                  {result.profileData?.profilePictureUrl && (
                    <p><strong>Profile Picture:</strong> ✓ Found</p>
                  )}
                  {result.cookies?.li_at && (
                    <p><strong>li_at Cookie:</strong> {result.cookies.li_at.substring(0, 20)}...</p>
                  )}
                  {result.cookies?.JSESSIONID && (
                    <p><strong>JSESSIONID:</strong> ✓ Found</p>
                  )}
                </div>
              </div>

              <details className="p-4 bg-gray-50 border rounded-lg">
                <summary className="cursor-pointer font-semibold">Full Response</summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
