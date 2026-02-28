'use client'

import { useState } from 'react'

interface AssignCampaignsModalProps {
  isOpen: boolean
  onClose: () => void
  accountId: string
  accountEmail: string
  currentCampaigns: string[]
  availableCampaigns: Array<{ id: string; name: string; status: string }>
  onAssign: (accountId: string, campaignIds: string[]) => Promise<void>
}

export default function AssignCampaignsModal({
  isOpen,
  onClose,
  accountId,
  accountEmail,
  currentCampaigns,
  availableCampaigns,
  onAssign
}: AssignCampaignsModalProps) {
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>(currentCampaigns)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleToggleCampaign = (campaignId: string) => {
    if (selectedCampaigns.includes(campaignId)) {
      setSelectedCampaigns(selectedCampaigns.filter(id => id !== campaignId))
    } else {
      setSelectedCampaigns([...selectedCampaigns, campaignId])
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await onAssign(accountId, selectedCampaigns)
      onClose()
    } catch (error) {
      console.error('Failed to assign campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Assign Campaigns</h2>
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
        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Assign campaigns to <span className="font-medium text-gray-900">{accountEmail}</span>
            </p>
          </div>

          {availableCampaigns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No campaigns available</p>
              <p className="text-sm text-gray-400 mt-1">Create a campaign first to assign it</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableCampaigns.map((campaign) => (
                <label
                  key={campaign.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedCampaigns.includes(campaign.id)}
                    onChange={() => handleToggleCampaign(campaign.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{campaign.name}</p>
                    <p className="text-xs text-gray-500">
                      Status: <span className="capitalize">{campaign.status}</span>
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {selectedCampaigns.length} campaign{selectedCampaigns.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <span>Assign</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
