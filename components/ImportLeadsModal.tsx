'use client'

import { useState } from 'react'
import type { List } from '@/types/linkedin'

interface ImportLeadsModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { list_id: string; leads: any[] }) => Promise<void>
  lists: List[]
  onCreateList: (data: { name: string; description?: string }) => Promise<List>
}

export default function ImportLeadsModal({ isOpen, onClose, onSubmit, lists, onCreateList }: ImportLeadsModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [selectedListId, setSelectedListId] = useState('')
  const [showCreateList, setShowCreateList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [parsedData, setParsedData] = useState<any[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [rawData, setRawData] = useState<string[][]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload')

  if (!isOpen) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    setFile(selectedFile)
    setError('')

    // Parse CSV (properly handle quoted fields with commas)
    const text = await selectedFile.text()
    
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }
    
    const rows = text.split('\n').filter(row => row.trim())
    
    if (rows.length < 2) {
      setError('CSV file must have at least a header row and one data row')
      return
    }

    const headers = parseCSVLine(rows[0])
    const dataRows = rows.slice(1).map(row => parseCSVLine(row))
    
    console.log('📋 CSV Headers:', headers)
    
    setCsvHeaders(headers)
    setRawData(dataRows)
    
    // Auto-detect column mapping
    const autoMapping: Record<string, string> = {}
    headers.forEach((header) => {
      const lowerHeader = header.toLowerCase().trim()
      
      if (lowerHeader === 'profile url' || lowerHeader.includes('linkedin')) autoMapping[header] = 'linkedin_url'
      else if (lowerHeader === 'first name' || lowerHeader === 'firstname') autoMapping[header] = 'first_name'
      else if (lowerHeader === 'last name' || lowerHeader === 'lastname') autoMapping[header] = 'last_name'
      else if (lowerHeader === 'full name' || lowerHeader === 'fullname') autoMapping[header] = 'full_name'
      else if (lowerHeader === 'headline') autoMapping[header] = 'headline'
      else if (lowerHeader === 'enriched email') autoMapping[header] = 'enriched_email'
      else if (lowerHeader === 'custom address') autoMapping[header] = 'custom_address'
      else if (lowerHeader === 'job title' || lowerHeader === 'title') autoMapping[header] = 'position'
      else if (lowerHeader === 'location') autoMapping[header] = 'location'
      else if (lowerHeader === 'company' && !lowerHeader.includes('url')) autoMapping[header] = 'company'
      else if (lowerHeader === 'company url') autoMapping[header] = 'company_url'
      else if (lowerHeader === 'tags') autoMapping[header] = 'tags'
      else if (lowerHeader.includes('email') && !lowerHeader.includes('enriched')) autoMapping[header] = 'email'
      else if (lowerHeader.includes('phone')) autoMapping[header] = 'phone'
      else if (lowerHeader.includes('note')) autoMapping[header] = 'notes'
      else autoMapping[header] = '' // No mapping
    })
    
    setColumnMapping(autoMapping)
    setStep('mapping')
  }
  
  const applyMapping = () => {
    // Apply the mapping to create parsed data
    const data = rawData.map(values => {
      const obj: any = {}
      
      csvHeaders.forEach((header, index) => {
        const fieldName = columnMapping[header]
        const value = values[index]?.trim()
        
        if (!fieldName || !value) return
        
        obj[fieldName] = value
        
        // Special handling for custom_address email extraction
        if (fieldName === 'custom_address' && value.includes('@') && !obj.email && !obj.enriched_email) {
          obj.enriched_email = value
        }
      })
      
      return obj
    }).filter(obj => Object.keys(obj).length > 0)
    
    console.log('✅ Mapped leads:', data.length)
    console.log('📝 Sample lead:', data[0])
    
    setParsedData(data)
    setStep('preview')
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    console.log('🚀 Starting import...', {
      selectedListId,
      showCreateList,
      newListName,
      leadsCount: parsedData.length
    })

    try {
      let listId = selectedListId

      // Create new list if needed
      if (showCreateList && newListName) {
        const newList = await onCreateList({ name: newListName })
        listId = newList.id
      }

      if (!listId) {
        throw new Error('Please select or create a list')
      }

      console.log('📤 Submitting to server...', { listId, leadsCount: parsedData.length })
      await onSubmit({ list_id: listId, leads: parsedData })
      
      console.log('✅ Import successful!')
      
      // Reset
      setFile(null)
      setParsedData([])
      setCsvHeaders([])
      setRawData([])
      setColumnMapping({})
      setSelectedListId('')
      setShowCreateList(false)
      setNewListName('')
      setStep('upload')
      onClose()
    } catch (err: any) {
      console.error('❌ Import failed:', err)
      setError(err.message || 'Failed to import leads')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Import Leads from CSV</h2>
            <p className="text-xs text-gray-500 mt-1">
              {step === 'upload' && 'Upload your CSV file'}
              {step === 'mapping' && `Map ${csvHeaders.length} columns to fields`}
              {step === 'preview' && `${parsedData.length} leads ready to import`}
            </p>
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

        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {step === 'upload' ? (
            <div className="space-y-6">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload CSV File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-gray-600">
                      {file ? file.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">CSV files only</p>
                  </label>
                </div>
              </div>

              {/* CSV Format Guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">CSV Format Guide</h4>
                <p className="text-xs text-blue-700 mb-3">Your CSV should have these columns (any order):</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    <span className="text-blue-900">first_name / last_name</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    <span className="text-blue-900">company</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    <span className="text-blue-900">position / title</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    <span className="text-blue-900">email</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    <span className="text-blue-900">linkedin_url</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    <span className="text-blue-900">location</span>
                  </div>
                </div>
              </div>
            </div>
          ) : step === 'mapping' ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">Column Mapping</h4>
                <p className="text-xs text-blue-700">
                  Map your CSV columns to the correct fields. Auto-detected mappings are shown - you can adjust them if needed.
                </p>
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <span className="text-blue-800">
                    <strong>{Object.values(columnMapping).filter(v => v).length}</strong> of {csvHeaders.length} columns mapped
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {csvHeaders.map((header, index) => {
                  const isMapped = columnMapping[header] && columnMapping[header] !== ''
                  return (
                    <div key={index} className={`flex items-center gap-4 p-3 rounded-lg border-2 ${isMapped ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex-shrink-0">
                        {isMapped ? (
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">CSV Column</label>
                        <div className="text-sm font-medium text-gray-900">{header}</div>
                        {rawData[0] && rawData[0][index] && (
                          <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                            Example: {rawData[0][index].substring(0, 50)}{rawData[0][index].length > 50 ? '...' : ''}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Maps To</label>
                        <select
                          value={columnMapping[header] || ''}
                          onChange={(e) => setColumnMapping({ ...columnMapping, [header]: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">-- Skip this column --</option>
                          <optgroup label="Profile">
                            <option value="linkedin_url">LinkedIn URL</option>
                            <option value="first_name">First Name</option>
                            <option value="last_name">Last Name</option>
                            <option value="full_name">Full Name</option>
                          </optgroup>
                          <optgroup label="Professional">
                            <option value="headline">Headline</option>
                            <option value="position">Job Title / Position</option>
                            <option value="company">Company</option>
                            <option value="company_url">Company URL</option>
                            <option value="location">Location</option>
                          </optgroup>
                          <optgroup label="Contact">
                            <option value="email">Email</option>
                            <option value="enriched_email">Enriched Email</option>
                            <option value="custom_address">Custom Address</option>
                            <option value="phone">Phone</option>
                          </optgroup>
                          <optgroup label="Additional">
                            <option value="tags">Tags</option>
                            <option value="notes">Notes</option>
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* List Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select List
                </label>
                
                {!showCreateList ? (
                  <div className="space-y-2">
                    <select
                      value={selectedListId}
                      onChange={(e) => setSelectedListId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select an existing list...</option>
                      {lists.map(list => (
                        <option key={list.id} value={list.id}>
                          {list.name} ({list.lead_count} leads)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCreateList(true)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Create new list
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="New list name..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreateList(false)}
                      className="text-sm text-gray-600 hover:text-gray-700"
                    >
                      ← Back to existing lists
                    </button>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Preview ({parsedData.length} leads)
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-64">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">LinkedIn</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Headline</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Company</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Location</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {parsedData.slice(0, 10).map((lead, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm">
                              {lead.linkedin_url && (
                                <a
                                  href={lead.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700"
                                  title="View LinkedIn Profile"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                  </svg>
                                </a>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate">
                              {lead.headline || lead.position || '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">{lead.company || '-'}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{lead.location || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedData.length > 10 && (
                    <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center border-t">
                      Showing first 10 of {parsedData.length} leads
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          {step === 'mapping' && (
            <button
              onClick={() => setStep('upload')}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Back
            </button>
          )}
          {step === 'preview' && (
            <button
              onClick={() => setStep('mapping')}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Back
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          {step === 'mapping' && (
            <button
              onClick={applyMapping}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continue to Preview →
            </button>
          )}
          {step === 'preview' && (
            <button
              onClick={handleSubmit}
              disabled={loading || (!selectedListId && !newListName)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Importing...' : `Import ${parsedData.length} Leads`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
