'use client'

import { useState } from 'react'

interface ConfigureLimitsModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (limits: any) => Promise<void>
  account: any
}

export default function ConfigureLimitsModal({ isOpen, onClose, onSubmit, account }: ConfigureLimitsModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [limits, setLimits] = useState({
    connection_requests_per_day: account?.daily_limits?.connection_requests_per_day || 20,
    messages_per_day: account?.daily_limits?.messages_per_day || 50,
    inmails_per_day: account?.daily_limits?.inmails_per_day || 20
  })

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      await onSubmit(limits)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update limits')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Configure Daily Limits</h2>
            <p className="text-xs text-gray-500 mt-1">{account?.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-blue-800">
                    Set conservative limits to avoid LinkedIn restrictions and account safety.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Connection Requests per Day
              </label>
              <input
                type="number"
                value={limits.connection_requests_per_day}
                onChange={(e) => setLimits({ ...limits, connection_requests_per_day: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                max="100"
                required
              />
              <p className="mt-1 text-xs text-gray-500">Recommended: 15-25 per day</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Messages per Day
              </label>
              <input
                type="number"
                value={limits.messages_per_day}
                onChange={(e) => setLimits({ ...limits, messages_per_day: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                max="200"
                required
              />
              <p className="mt-1 text-xs text-gray-500">Recommended: 30-60 per day</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                InMails per Day
              </label>
              <input
                type="number"
                value={limits.inmails_per_day}
                onChange={(e) => setLimits({ ...limits, inmails_per_day: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                max="50"
                required
              />
              <p className="mt-1 text-xs text-gray-500">Recommended: 10-20 per day</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <span>{loading ? 'Saving...' : 'Save Limits'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
