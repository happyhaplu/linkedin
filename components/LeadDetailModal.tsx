'use client'

import { useState } from 'react'
import type { Lead, List } from '@/types/linkedin'

interface LeadDetailModalProps {
  lead: Lead & { list?: List }
  isOpen: boolean
  onClose: () => void
  onUpdate?: (leadId: string, data: Partial<Lead>) => Promise<void>
  onDelete?: (leadId: string) => Promise<void>
}

export default function LeadDetailModal({ lead, isOpen, onClose, onUpdate, onDelete }: LeadDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<Lead>>(lead)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSave = async () => {
    if (!onUpdate) return
    setLoading(true)
    try {
      await onUpdate(lead.id, editData)
      setIsEditing(false)
      onClose()
    } catch (error) {
      console.error('Failed to update lead:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || !confirm('Delete this lead?')) return
    setLoading(true)
    try {
      await onDelete(lead.id)
      onClose()
    } catch (error) {
      console.error('Failed to delete lead:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            {lead.linkedin_url && (
              <a
                href={lead.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
                <svg className="w-10 h-10 text-blue-600 hover:text-blue-700" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown'}
              </h2>
              <p className="text-sm text-gray-500">{lead.position || lead.headline || '-'}</p>
            </div>
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
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Profile Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="First Name" value={lead.first_name} />
                <DetailField label="Last Name" value={lead.last_name} />
                <DetailField label="Full Name" value={lead.full_name} />
                <DetailField label="LinkedIn URL" value={lead.linkedin_url} isLink />
              </div>
            </div>

            {/* Professional Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Professional Details
              </h3>
              <div className="space-y-3">
                <DetailField label="Headline" value={lead.headline} fullWidth />
                <div className="grid grid-cols-2 gap-4">
                  <DetailField label="Job Title" value={lead.position} />
                  <DetailField label="Company" value={lead.company} />
                  <DetailField label="Company URL" value={lead.company_url} isLink />
                  <DetailField label="Location" value={lead.location} />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Enriched Email" value={lead.enriched_email} />
                <DetailField label="Email" value={lead.email} />
                <DetailField label="Custom Address" value={lead.custom_address} />
                <DetailField label="Phone" value={lead.phone} />
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Additional Details
              </h3>
              <div className="space-y-3">
                <DetailField label="Tags" value={lead.tags} />
                <DetailField label="List" value={lead.list?.name} />
                <div className="grid grid-cols-2 gap-4">
                  <DetailField label="Status" value={lead.status} isBadge />
                  <DetailField 
                    label="Created" 
                    value={new Date(lead.created_at).toLocaleDateString()} 
                  />
                </div>
                <DetailField label="Notes" value={lead.notes} fullWidth isTextarea />
              </div>
            </div>

            {/* Custom Fields */}
            {lead.custom_field_values && Object.keys(lead.custom_field_values).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Custom Fields
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(lead.custom_field_values).map(([key, value]) => (
                    <DetailField key={key} label={key} value={String(value || '-')} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 bg-gray-50">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                  disabled={loading}
                >
                  Delete
                </button>
              )}
              {onUpdate && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Edit
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailField({ 
  label, 
  value, 
  isLink, 
  fullWidth, 
  isTextarea,
  isBadge 
}: { 
  label: string
  value?: string | null
  isLink?: boolean
  fullWidth?: boolean
  isTextarea?: boolean
  isBadge?: boolean
}) {
  const displayValue = value || '-'
  
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {isLink && value ? (
        <a
          href={value.startsWith('http') ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
        >
          {value}
        </a>
      ) : isBadge && value ? (
        <span className="inline-flex text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
          {value.replace('_', ' ')}
        </span>
      ) : isTextarea ? (
        <p className="text-sm text-gray-900 whitespace-pre-wrap">{displayValue}</p>
      ) : (
        <p className="text-sm text-gray-900 break-words">{displayValue}</p>
      )}
    </div>
  )
}
