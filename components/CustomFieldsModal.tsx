'use client'

import { useState } from 'react'
import type { CustomField } from '@/types/linkedin'

interface CustomFieldsModalProps {
  isOpen: boolean
  onClose: () => void
  fields: CustomField[]
  onCreateField: (data: any) => Promise<CustomField>
  onDeleteField: (id: string) => Promise<void>
}

export default function CustomFieldsModal({ isOpen, onClose, fields, onCreateField, onDeleteField }: CustomFieldsModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newField, setNewField] = useState({
    name: '',
    field_type: 'text',
    is_required: false
  })

  if (!isOpen) return null

  const handleCreate = async () => {
    if (!newField.name.trim()) {
      setError('Field name is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onCreateField(newField)
      setNewField({ name: '', field_type: 'text', is_required: false })
    } catch (err: any) {
      setError(err.message || 'Failed to create field')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this custom field? All data in this field will be lost.')) return

    try {
      await onDeleteField(id)
    } catch (err: any) {
      setError(err.message || 'Failed to delete field')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Custom Fields</h2>
            <p className="text-xs text-gray-500 mt-1">Create custom fields to track additional lead information</p>
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
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Create New Field */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Create New Field</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Field Name</label>
                <input
                  type="text"
                  value={newField.name}
                  onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                  placeholder="e.g., Industry, Company Size"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Field Type</label>
                <select
                  value={newField.field_type}
                  onChange={(e) => setNewField({ ...newField, field_type: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="text">Text (Short)</option>
                  <option value="textarea">Text (Long)</option>
                  <option value="number">Number</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="url">URL</option>
                  <option value="date">Date</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="is_required"
                checked={newField.is_required}
                onChange={(e) => setNewField({ ...newField, is_required: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="is_required" className="text-xs text-gray-700">Required field</label>
            </div>
            <button
              onClick={handleCreate}
              disabled={loading || !newField.name.trim()}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Field'}
            </button>
          </div>

          {/* Existing Fields */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Existing Fields ({fields.length})
            </h3>
            {fields.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No custom fields yet. Create one above to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((field) => (
                  <div key={field.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{field.name}</span>
                        {field.is_required && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Required</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Type: {field.field_type}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(field.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
