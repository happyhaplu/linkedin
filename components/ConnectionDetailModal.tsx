'use client'

import { useState } from 'react'
import Image from 'next/image'
import { updateConnection } from '@/app/actions/network'
import type { NetworkConnection } from '@/types/linkedin'

interface ConnectionDetailModalProps {
  connection: NetworkConnection
  onClose: () => void
  onUpdate: () => void
}

export default function ConnectionDetailModal({ connection, onClose, onUpdate }: ConnectionDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    notes: connection.notes || '',
    tags: connection.tags?.join(', ') || ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      await updateConnection(connection.id, {
        notes: formData.notes,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      })
      setIsEditing(false)
      onUpdate()
    } catch (error) {
      console.error('Failed to update connection:', error)
      alert('Failed to update connection')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">Connection Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Profile Header Section */}
          <div className="flex items-start gap-6 mb-8">
            {connection.profile_picture_url ? (
              <Image
                src={connection.profile_picture_url}
                alt={connection.full_name || 'Profile'}
                width={120}
                height={120}
                className="w-30 h-30 rounded-lg object-cover shadow-md"
              />
            ) : (
              <div className="w-30 h-30 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-4xl">
                  {connection.first_name?.charAt(0) || connection.full_name?.charAt(0) || '?'}
                </span>
              </div>
            )}
            
            <div className="flex-1">
              <h3 className="text-3xl font-bold text-gray-900 mb-2">
                {connection.full_name || `${connection.first_name || ''} ${connection.last_name || ''}`.trim()}
              </h3>
              
              {connection.position && (
                <p className="text-lg text-gray-700 mb-3">{connection.position}</p>
              )}
              
              <div className="flex flex-wrap gap-2 mb-4">
                {connection.company && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {connection.company}
                  </span>
                )}
                
                {connection.is_favorite && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    Favorite
                  </span>
                )}
                
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                  connection.connection_status === 'connected' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {connection.connection_status === 'connected' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                  {connection.connection_status}
                </span>
              </div>
              
              {connection.connection_linkedin_url && (
                <a
                  href={connection.connection_linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  View on LinkedIn
                </a>
              )}
            </div>
          </div>

          {/* Information Sections */}
          <div className="space-y-6">
            {/* Contact & Professional Info */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Professional Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {connection.position && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Position</label>
                    <p className="text-gray-900">{connection.position}</p>
                  </div>
                )}

                {connection.company && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Company</label>
                    <p className="text-gray-900">{connection.company}</p>
                  </div>
                )}

                {connection.connected_at && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Connected On</label>
                    <p className="text-gray-900">{new Date(connection.connected_at).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tags Section */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Tags
              </h4>
              {!isEditing ? (
                <div className="flex flex-wrap gap-2">
                  {connection.tags && connection.tags.length > 0 ? (
                    connection.tags.map((tag, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <p className="text-gray-500 italic">No tags</p>
                  )}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Edit Tags
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="Enter tags separated by commas"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Notes Section */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Notes
              </h4>
              {!isEditing ? (
                <div>
                  <p className="text-gray-900 whitespace-pre-wrap">{connection.notes || 'No notes'}</p>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Edit Notes
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add notes about this connection..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Activity Section */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Activity
              </h4>
              <p className="text-gray-500 italic">No activity in any campaigns</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
