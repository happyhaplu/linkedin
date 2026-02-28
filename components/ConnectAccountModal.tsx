'use client'

import { useState, useEffect } from 'react'

interface ConnectAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<void>
  proxies: any[]
  reconnectingAccount?: any
  onCreateProxy?: () => void
}

export default function ConnectAccountModal({ isOpen, onClose, onSubmit, proxies, reconnectingAccount, onCreateProxy }: ConnectAccountModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [useImportSession, setUseImportSession] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    li_at_cookie: '',
    proxy_id: ''
  })

  // Auto-select best proxy on mount
  useEffect(() => {
    if (proxies.length > 0 && !formData.proxy_id) {
      const residential = proxies.find((p: any) => p.type === 'residential' && p.status !== 'error')
      const best = residential || proxies[0]
      if (best) {
        setFormData(prev => ({ ...prev, proxy_id: best.id }))
      }
    }
  }, [proxies]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill when reconnecting
  useEffect(() => {
    if (reconnectingAccount) {
      setFormData(prev => ({
        ...prev,
        email: reconnectingAccount.email,
        proxy_id: reconnectingAccount.proxy_id || prev.proxy_id
      }))
    }
  }, [reconnectingAccount])

  if (!isOpen) return null

  const hasProxy = proxies.length > 0
  const selectedProxy = proxies.find((p: any) => p.id === formData.proxy_id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      if (useImportSession) {
        // Import Session mode — cookie-based
        if (!formData.li_at_cookie.trim()) {
          throw new Error('Please paste your LinkedIn session cookie (li_at)')
        }
        await onSubmit({
          email: formData.email,
          li_at_cookie: formData.li_at_cookie.trim(),
          proxy_id: formData.proxy_id || null,
          loginMethod: 'cookie'
        })
      } else {
        // Primary mode — email + password via proxy
        if (!formData.password) {
          throw new Error('Password is required')
        }
        await onSubmit({
          email: formData.email,
          password: formData.password,
          proxy_id: formData.proxy_id || null,
          loginMethod: 'proxy_login'
        })
      }
      
      // Reset and close on success
      setFormData({ email: '', password: '', li_at_cookie: '', proxy_id: '' })
      setShowAdvanced(false)
      setUseImportSession(false)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to connect account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {reconnectingAccount ? 'Reconnect Account' : 'Connect LinkedIn Account'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {reconnectingAccount 
                  ? `Refresh session for ${reconnectingAccount.email}` 
                  : 'Securely connect your LinkedIn profile'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-start gap-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Mode Toggle — only show when not reconnecting */}
          {!reconnectingAccount && (
            <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
              <button
                type="button"
                onClick={() => { setUseImportSession(false); setError('') }}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  !useImportSession 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Email &amp; Password
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setUseImportSession(true); setError('') }}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  useImportSession 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Import Session
                </span>
              </button>
            </div>
          )}

          <div className="space-y-4">
            {/* Email — always shown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                LinkedIn Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                placeholder="your.email@example.com"
                disabled={!!reconnectingAccount}
                required
              />
            </div>

            {/* Password — Email+Password mode */}
            {!useImportSession && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  LinkedIn Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors text-sm"
                  placeholder="••••••••"
                  required={!useImportSession}
                />
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Never stored. Used once to create a secure session.
                </p>
              </div>
            )}

            {/* Cookie input — Import Session mode */}
            {useImportSession && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Session Cookie (li_at)
                </label>
                <textarea
                  value={formData.li_at_cookie}
                  onChange={(e) => setFormData({ ...formData, li_at_cookie: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors text-sm font-mono"
                  placeholder="Paste your li_at cookie value or full cookies JSON here..."
                  rows={3}
                  required={useImportSession}
                />
                <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-xs text-blue-700 font-medium mb-1">How to get your session cookie:</p>
                  <ol className="text-xs text-blue-600 space-y-0.5 list-decimal list-inside">
                    <li>Open LinkedIn in Chrome → press F12</li>
                    <li>Go to Application → Cookies → linkedin.com</li>
                    <li>Find <code className="bg-blue-100 px-1 rounded">li_at</code> and copy its value</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Advanced Options Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Advanced Options
              </span>
              <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Advanced Options Panel */}
            {showAdvanced && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">
                    Proxy
                    {!hasProxy && (
                      <span className="text-amber-600 normal-case tracking-normal ml-1">(none configured)</span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.proxy_id}
                      onChange={(e) => setFormData({ ...formData, proxy_id: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">No proxy (not recommended)</option>
                      {proxies.map((proxy: any) => (
                        <option key={proxy.id} value={proxy.id}>
                          {proxy.name} — {proxy.host}:{proxy.port} ({proxy.type})
                        </option>
                      ))}
                    </select>
                    {onCreateProxy && (
                      <button
                        type="button"
                        onClick={onCreateProxy}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-1"
                        title="Add new proxy"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add
                      </button>
                    )}
                  </div>
                  {!hasProxy && (
                    <p className="text-xs text-amber-600 mt-1.5">
                      ⚠️ Without a proxy, LinkedIn may detect automation. Add a residential proxy for best results.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-all text-sm shadow-sm shadow-blue-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {useImportSession ? 'Validating session...' : 'Connecting securely...'}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  {useImportSession ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Import Session
                    </>
                  ) : (
                    <>
                      Connect Account
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </span>
              )}
            </button>
          </div>

          {/* Trust signals */}
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Encrypted
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Proxy-protected
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Safe
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
