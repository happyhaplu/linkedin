'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import ProfileDropdown from '@/components/ProfileDropdown'
import CreateListModal from '@/components/CreateListModal'
import { getLists, createList, deleteList } from '@/app/actions/leads'
import type { List } from '@/types/linkedin'
import Link from 'next/link'

export default function ListsPage() {
  const [lists, setLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    loadLists()
  }, [])

  const loadLists = async () => {
    try {
      const data = await getLists()
      setLists(data)
    } catch (error) {
      console.error('Failed to load lists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateList = async (data: { name: string; description?: string }) => {
    await createList(data)
    await loadLists()
  }

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Are you sure? This will delete all leads in this list.')) return
    
    try {
      await deleteList(listId)
      await loadLists()
    } catch (error: any) {
      alert(error.message || 'Failed to delete list')
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lead Lists</h1>
            <p className="text-sm text-gray-500 mt-1">Organize your leads into lists</p>
          </div>
          <ProfileDropdown userEmail="" />
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header Actions */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-3">
                <Link 
                  href="/leads"
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Back to Leads
                </Link>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create List
              </button>
            </div>

            {/* Lists Grid */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 mt-4">Loading lists...</p>
              </div>
            ) : lists.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Lists Yet</h3>
                <p className="text-gray-500 mb-6">Create your first list to organize your leads</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Your First List
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lists.map((list) => (
                  <div
                    key={list.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {list.name}
                          </h3>
                          {list.description && (
                            <p className="text-sm text-gray-500 line-clamp-2">
                              {list.description}
                            </p>
                          )}
                        </div>
                        <div className="ml-2 flex gap-1">
                          <button
                            onClick={() => handleDeleteList(list.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete list"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span>{list.lead_count} leads</span>
                        </div>
                        <Link
                          href={`/leads?list_id=${list.id}`}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          View Leads →
                        </Link>
                      </div>

                      <div className="mt-3 text-xs text-gray-400">
                        Created {new Date(list.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateList}
      />
    </div>
  )
}
