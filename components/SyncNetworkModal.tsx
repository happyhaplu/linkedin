'use client'

import { useState } from 'react'
import type { LinkedInAccount } from '@/types/linkedin'

interface SyncNetworkModalProps {
  accounts: LinkedInAccount[]
  onClose: () => void
  onSync: (accountId: string, syncType: 'full' | 'incremental') => Promise<void>
}

export default function SyncNetworkModal({ accounts, onClose, onSync }: SyncNetworkModalProps) {
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [syncType, setSyncType] = useState<'full' | 'incremental'>('incremental')
  const [syncing, setSyncing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedAccountId) {
      alert('Please select a LinkedIn account')
      return
    }

    try {
      setSyncing(true)
      await onSync(selectedAccountId, syncType)
      onClose()
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Sync Network from LinkedIn</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select LinkedIn Account
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select an account...</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.email} ({account.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sync Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="incremental"
                    checked={syncType === 'incremental'}
                    onChange={(e) => setSyncType(e.target.value as 'incremental')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="ml-3">
                    <div className="font-medium text-gray-900">Incremental Sync</div>
                    <div className="text-sm text-gray-500">Only sync new connections and updates</div>
                  </div>
                </label>

                <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="full"
                    checked={syncType === 'full'}
                    onChange={(e) => setSyncType(e.target.value as 'full')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="ml-3">
                    <div className="font-medium text-gray-900">Full Sync</div>
                    <div className="text-sm text-gray-500">Sync all connections from LinkedIn (slower)</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Note:</p>
                  <p>This will scrape your LinkedIn network data and store it locally. The sync process may take a few minutes depending on the size of your network.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={syncing}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={syncing}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {syncing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Start Sync
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
