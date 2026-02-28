'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Sidebar from '@/components/Sidebar'
import ProfileDropdown from '@/components/ProfileDropdown'
import ImportLeadsModal from '@/components/ImportLeadsModal'
import LeadDetailModal from '@/components/LeadDetailModal'
import CustomFieldsModal from '@/components/CustomFieldsModal'
import { getLeads, getLists, createList, importLeadsFromCSV, deleteLead, bulkDeleteLeads, bulkUpdateLeadStatus } from '@/app/actions/leads'
import { getCustomFields, createCustomField, deleteCustomField } from '@/app/actions/custom-fields'
import type { Lead, List, CustomField } from '@/types/linkedin'
import Link from 'next/link'

function LeadsContent() {
  const searchParams = useSearchParams()
  const [leads, setLeads] = useState<(Lead & { list: List })[]>([])
  const [lists, setLists] = useState<List[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showCustomFieldsModal, setShowCustomFieldsModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState<(Lead & { list: List }) | null>(null)
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    list_id: searchParams?.get('list_id') || '',
    status: '',
    search: ''
  })

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const loadData = async () => {
    try {
      const [leadsData, listsData, customFieldsData] = await Promise.all([
        getLeads(filters),
        getLists(),
        getCustomFields()
      ])
      setLeads(leadsData)
      setLists(listsData)
      setCustomFields(customFieldsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (data: { list_id: string; leads: any[] }) => {
    await importLeadsFromCSV(data)
    await loadData()
  }

  const handleCreateList = async (data: { name: string; description?: string }) => {
    return await createList(data)
  }

  const handleCreateCustomField = async (data: any) => {
    const field = await createCustomField(data)
    await loadData()
    return field
  }

  const handleDeleteCustomField = async (id: string) => {
    await deleteCustomField(id)
    await loadData()
  }

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Delete this lead?')) return
    await deleteLead(leadId)
    await loadData()
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedLeads.size} selected leads?`)) return
    await bulkDeleteLeads(Array.from(selectedLeads))
    setSelectedLeads(new Set())
    await loadData()
  }

  const handleBulkStatusUpdate = async (status: string) => {
    await bulkUpdateLeadStatus(Array.from(selectedLeads), status)
    setSelectedLeads(new Set())
    await loadData()
  }

  const toggleSelectLead = (leadId: string) => {
    const newSelected = new Set(selectedLeads)
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId)
    } else {
      newSelected.add(leadId)
    }
    setSelectedLeads(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)))
    }
  }

  const getStatusBadgeColor = (status: string) => {
    const colors: any = {
      new: 'bg-blue-100 text-blue-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      replied: 'bg-green-100 text-green-800',
      qualified: 'bg-purple-100 text-purple-800',
      unqualified: 'bg-gray-100 text-gray-800',
      do_not_contact: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your lead database</p>
          </div>
          <ProfileDropdown userEmail="" />
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header Actions */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-3">
                <Link
                  href="/leads/lists"
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Manage Lists
                </Link>
                <button
                  onClick={() => setShowCustomFieldsModal(true)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Custom Fields
                </button>
              </div>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Import CSV
              </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">List</label>
                  <select
                    value={filters.list_id}
                    onChange={(e) => setFilters({ ...filters, list_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Lists</option>
                    {lists.map(list => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Status</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="replied">Replied</option>
                    <option value="qualified">Qualified</option>
                    <option value="unqualified">Unqualified</option>
                    <option value="do_not_contact">Do Not Contact</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Name, email, company..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedLeads.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
                <span className="text-sm text-blue-900 font-medium">
                  {selectedLeads.size} leads selected
                </span>
                <div className="flex gap-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleBulkStatusUpdate(e.target.value)
                        e.target.value = ''
                      }
                    }}
                    className="px-3 py-1 text-sm border border-blue-300 rounded bg-white"
                  >
                    <option value="">Change Status...</option>
                    <option value="contacted">Mark as Contacted</option>
                    <option value="replied">Mark as Replied</option>
                    <option value="qualified">Mark as Qualified</option>
                    <option value="unqualified">Mark as Unqualified</option>
                    <option value="do_not_contact">Mark as Do Not Contact</option>
                  </select>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete Selected
                  </button>
                </div>
              </div>
            )}

            {/* Leads Table */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 mt-4">Loading leads...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Leads Yet</h3>
                <p className="text-gray-500 mb-6">Import your first CSV to get started</p>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Import CSV
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedLeads.size === leads.length}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Headline</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">List</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedLeads.has(lead.id)}
                              onChange={() => toggleSelectLead(lead.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {/* Profile Picture */}
                              {lead.profile_picture ? (
                                <>
                                  <Image
                                    src={lead.profile_picture}
                                    alt={lead.full_name || 'Profile'}
                                    width={40}
                                    height={40}
                                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-100 flex-shrink-0"
                                    unoptimized
                                    onError={(e) => {
                                      const target = e.currentTarget as HTMLImageElement;
                                      target.style.display = 'none';
                                      const fallback = target.nextElementSibling as HTMLElement;
                                      if (fallback) fallback.classList.remove('hidden');
                                    }}
                                  />
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 hidden">
                                    <span className="text-white font-semibold text-sm">
                                      {(lead.first_name?.charAt(0) || lead.full_name?.charAt(0) || '?').toUpperCase()}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white font-semibold text-sm">
                                    {(lead.first_name?.charAt(0) || lead.full_name?.charAt(0) || '?').toUpperCase()}
                                  </span>
                                </div>
                              )}
                              
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  {lead.linkedin_url && (
                                    <a
                                      href={lead.linkedin_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-shrink-0"
                                      title="View LinkedIn Profile"
                                    >
                                      <svg className="w-4 h-4 text-blue-600 hover:text-blue-700" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                      </svg>
                                    </a>
                                  )}
                                  <div className="text-sm font-medium text-gray-900 truncate">
                                    {lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '-'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-500 max-w-xs truncate" title={lead.headline || ''}>
                              {lead.headline || lead.position || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-500">
                              {lead.company || '-'}
                              {lead.company_url && (
                                <a
                                  href={lead.company_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 text-blue-600 hover:text-blue-700"
                                  title="Visit company website"
                                >
                                  <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{lead.location || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-500">
                              {lead.enriched_email || lead.email || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              {lead.list?.name || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded ${getStatusBadgeColor(lead.status)}`}>
                              {lead.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedLead(lead)}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                              >
                                View
                              </button>
                              <button
                                onClick={() => handleDeleteLead(lead.id)}
                                className="text-red-600 hover:text-red-700 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
                  Showing {leads.length} leads
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <ImportLeadsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSubmit={handleImport}
        lists={lists}
        onCreateList={handleCreateList}
      />

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          onDelete={async (id) => {
            await deleteLead(id)
            setSelectedLead(null)
            await loadData()
          }}
        />
      )}

      <CustomFieldsModal
        isOpen={showCustomFieldsModal}
        onClose={() => setShowCustomFieldsModal(false)}
        fields={customFields}
        onCreateField={handleCreateCustomField}
        onDeleteField={handleDeleteCustomField}
      />
    </div>
  )
}

export default function LeadsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <LeadsContent />
    </Suspense>
  )
}
