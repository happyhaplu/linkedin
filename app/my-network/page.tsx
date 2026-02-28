'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Sidebar from '@/components/Sidebar'
import ProfileDropdown from '@/components/ProfileDropdown'
import {
  getNetworkConnections,
  getConnectionRequests,
  getConnectionStats,
  syncNetworkFromLinkedIn,
  getSyncLogs,
  toggleFavorite,
  deleteConnection,
  bulkDeleteConnections,
  bulkWithdrawRequests,
  withdrawConnectionRequest,
  acceptConnectionRequest
} from '@/app/actions/network'
import { getLinkedInAccounts as getAccounts } from '@/app/actions/linkedin-accounts'
import { getLists } from '@/app/actions/leads'
import type { NetworkConnection, ConnectionRequest, LinkedInAccount, NetworkSyncLog, List } from '@/types/linkedin'
import ConnectionDetailModal from '@/components/ConnectionDetailModal'
import SyncNetworkModal from '@/components/SyncNetworkModal'
import Link from 'next/link'

type TabType = 'connections' | 'requests-sent' | 'requests-received' | 'sync-logs'

export default function MyNetworkPage() {
  const [activeTab, setActiveTab] = useState<TabType>('connections')
  const [connections, setConnections] = useState<(NetworkConnection & { linkedin_account: LinkedInAccount })[]>([])
  const [requests, setRequests] = useState<(ConnectionRequest & { linkedin_account: LinkedInAccount })[]>([])
  const [syncLogs, setSyncLogs] = useState<(NetworkSyncLog & { linkedin_account: LinkedInAccount })[]>([])
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([])
  const [lists, setLists] = useState<List[]>([])
  const [stats, setStats] = useState({
    totalConnections: 0,
    pendingSent: 0,
    pendingReceived: 0,
    favorites: 0
  })
  const [loading, setLoading] = useState(true)
  const [bulkAddLoading, setBulkAddLoading] = useState(false)
  const [selectedConnection, setSelectedConnection] = useState<NetworkConnection | null>(null)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [showListSelectModal, setShowListSelectModal] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalItems, setTotalItems] = useState(0)
  const [filters, setFilters] = useState({
    linkedin_account_id: '',
    connection_status: '',
    request_type: '',
    request_status: '',
    search: '',
    is_favorite: undefined as boolean | undefined
  })

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when tab or filters change
    setSelectedItems(new Set()) // Clear selections
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters])

  const loadData = async () => {
    try {
      setLoading(true)
      const [accountsData, statsData, listsData] = await Promise.all([
        getAccounts(),
        getConnectionStats(),
        getLists()
      ])
      
      setAccounts(accountsData)
      setStats(statsData)
      setLists(listsData)

      if (activeTab === 'connections') {
        const connectionsData = await getNetworkConnections(filters)
        setConnections(connectionsData)
        setTotalItems(connectionsData.length)
      } else if (activeTab === 'requests-sent') {
        const requestsData = await getConnectionRequests({
          ...filters,
          request_type: 'sent'
        })
        setRequests(requestsData)
        setTotalItems(requestsData.length)
      } else if (activeTab === 'requests-received') {
        const requestsData = await getConnectionRequests({
          ...filters,
          request_type: 'received'
        })
        setRequests(requestsData)
        setTotalItems(requestsData.length)
      } else if (activeTab === 'sync-logs') {
        const logsData = await getSyncLogs(filters.linkedin_account_id)
        setSyncLogs(logsData)
        setTotalItems(logsData.length)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async (accountId: string, syncType: 'full' | 'incremental') => {
    try {
      await syncNetworkFromLinkedIn(accountId, syncType)
      await loadData()
    } catch (error) {
      console.error('Sync failed:', error)
      alert('Sync failed. Please try again.')
    }
  }

  const handleToggleFavorite = async (connectionId: string, isFavorite: boolean) => {
    await toggleFavorite(connectionId, !isFavorite)
    await loadData()
  }

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Delete this connection?')) return
    await deleteConnection(connectionId)
    await loadData()
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedItems.size} selected items?`)) return
    
    if (activeTab === 'connections') {
      await bulkDeleteConnections(Array.from(selectedItems))
    } else {
      await bulkWithdrawRequests(Array.from(selectedItems))
    }
    
    setSelectedItems(new Set())
    await loadData()
  }

  const handleBulkAddToLeads = async (listId: string) => {
    setBulkAddLoading(true)
    try {
      const selectedConnections = connections.filter(c => selectedItems.has(c.id))
      
      console.log('Selected items:', selectedItems.size)
      console.log('Total connections:', connections.length)
      console.log('Filtered connections:', selectedConnections.length)
      
      if (selectedConnections.length === 0) {
        alert('No connections selected. Please select connections from the list.')
        setBulkAddLoading(false)
        return
      }
      
      let successCount = 0
      let failCount = 0
      const errors: string[] = []
      
      for (let i = 0; i < selectedConnections.length; i++) {
        const connection = selectedConnections[i]
        
        // Ensure we have a full_name
        const fullName = connection.full_name || 
                        `${connection.first_name || ''} ${connection.last_name || ''}`.trim() ||
                        'Unknown'
        
        try {
          const response = await fetch('/api/leads/add-from-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connection_id: connection.id,
              full_name: fullName,
              linkedin_url: connection.connection_linkedin_url,
              position: connection.position,
              company: connection.company,
              profile_picture: connection.profile_picture_url,
              headline: connection.headline,
              list_id: listId
            })
          })
          
          const responseData = await response.json().catch(() => null)
          
          if (response.ok) {
            successCount++
          } else if (response.status === 409) {
            // Already exists - count as success
            successCount++
          } else {
            failCount++
            const errorMsg = responseData?.error || responseData?.message || 'Failed'
            errors.push(`${fullName}: ${errorMsg}`)
            console.error(`Failed to add ${fullName}:`, responseData)
          }
        } catch (error) {
          failCount++
          errors.push(`${fullName}: Network error`)
          console.error(`Error adding ${fullName}:`, error)
        }
      }
      
      // Show results
      if (successCount > 0) {
        const successMsg = `✅ Successfully added ${successCount} of ${selectedConnections.length} connection(s) to leads!`
        
        if (failCount > 0) {
          const failMsg = `⚠️ ${failCount} already existed or failed`
          alert(successMsg + '\n\n' + failMsg)
        } else {
          // Show success toast
          const toast = document.createElement('div')
          toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-3'
          toast.innerHTML = `
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <div class="font-semibold">Success!</div>
              <div class="text-sm">${successMsg}</div>
            </div>
          `
          document.body.appendChild(toast)
          setTimeout(() => {
            toast.style.opacity = '0'
            toast.style.transition = 'opacity 0.3s'
            setTimeout(() => document.body.removeChild(toast), 300)
          }, 4000)
        }
      } else {
        alert(`⚠️ All ${selectedConnections.length} connection(s) already exist in this list`)  
      }
      
      setSelectedItems(new Set())
      setShowListSelectModal(false)
      
      // Refresh to show updated counts
      await loadData()
    } catch (error) {
      console.error('Error in bulk add to leads:', error)
      alert('❌ Failed to add connections to leads. Please try again.')
    } finally {
      setBulkAddLoading(false)
    }
  }

  const handleWithdrawRequest = async (requestId: string) => {
    if (!confirm('Withdraw this connection request?')) return
    await withdrawConnectionRequest(requestId)
    await loadData()
  }

  const handleAcceptRequest = async (requestId: string) => {
    await acceptConnectionRequest(requestId)
    await loadData()
  }

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  const toggleSelectAll = () => {
    const currentPageItems = getCurrentPageItems()
    const currentPageIds = currentPageItems.map(item => item.id)
    const allCurrentSelected = currentPageIds.every(id => selectedItems.has(id))
    
    if (allCurrentSelected) {
      // Deselect all on current page
      const newSelected = new Set(selectedItems)
      currentPageIds.forEach(id => newSelected.delete(id))
      setSelectedItems(newSelected)
    } else {
      // Select all on current page
      const newSelected = new Set(selectedItems)
      currentPageIds.forEach(id => newSelected.add(id))
      setSelectedItems(newSelected)
    }
  }

  const selectAllItems = () => {
    if (activeTab === 'connections') {
      setSelectedItems(new Set(connections.map(c => c.id)))
    } else if (activeTab === 'requests-sent' || activeTab === 'requests-received') {
      setSelectedItems(new Set(requests.map(r => r.id)))
    }
  }

  const getCurrentPageItems = () => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    
    if (activeTab === 'connections') {
      return connections.slice(startIndex, endIndex)
    } else if (activeTab === 'requests-sent' || activeTab === 'requests-received') {
      return requests.slice(startIndex, endIndex)
    } else {
      return syncLogs.slice(startIndex, endIndex)
    }
  }

  const totalPages = Math.ceil(totalItems / pageSize)

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const getStatusBadgeColor = (status: string) => {
    const colors: any = {
      connected: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      withdrawn: 'bg-gray-100 text-gray-800',
      accepted: 'bg-green-100 text-green-800',
      declined: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getSyncStatusBadgeColor = (status: string) => {
    const colors: any = {
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      partial: 'bg-yellow-100 text-yellow-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (accounts.length === 0 && !loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Network</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your LinkedIn network</p>
            </div>
            <ProfileDropdown userEmail="" />
          </header>

          <main className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md text-center">
              <div className="mb-6">
                <svg className="mx-auto h-24 w-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No LinkedIn Accounts Connected</h2>
              <p className="text-gray-600 mb-6">
                You don&apos;t have any LinkedIn accounts connected. Go to the Accounts tab to connect your accounts. 
                We will then sync your LinkedIn network into the system.
              </p>
              <Link
                href="/linkedin-account"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                Connect LinkedIn Account
              </Link>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Network</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your LinkedIn network connections</p>
          </div>
          <ProfileDropdown userEmail="" />
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Connections</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalConnections}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Sent</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pendingSent}</p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Received</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pendingReceived}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Favorites</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.favorites}</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-3 items-center">
                {selectedItems.size > 0 && (
                  <>
                    <button
                      onClick={handleBulkDelete}
                      className="px-4 py-2 text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Delete Selected ({selectedItems.size})
                    </button>
                    {activeTab === 'connections' && (
                      <button
                        onClick={() => setShowListSelectModal(true)}
                        className="px-4 py-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        Add to Leads ({selectedItems.size})
                      </button>
                    )}
                  </>
                )}
                {activeTab !== 'sync-logs' && (
                  <>
                    <button
                      onClick={toggleSelectAll}
                      className="px-4 py-2 text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                    >
                      Select Page
                    </button>
                    <button
                      onClick={selectAllItems}
                      className="px-4 py-2 text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                    >
                      Select All ({totalItems})
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-3 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Per page:</label>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <button
                  onClick={() => setShowSyncModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Network
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('connections')}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'connections'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Connections
                  </button>
                  <button
                    onClick={() => setActiveTab('requests-sent')}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'requests-sent'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Requests Sent
                  </button>
                  <button
                    onClick={() => setActiveTab('requests-received')}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'requests-received'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Requests Received
                  </button>
                  <button
                    onClick={() => setActiveTab('sync-logs')}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'sync-logs'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Sync Logs
                  </button>
                </nav>
              </div>

              {/* Filters */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">LinkedIn Account</label>
                    <select
                      value={filters.linkedin_account_id}
                      onChange={(e) => setFilters({ ...filters, linkedin_account_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Accounts</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {activeTab === 'connections' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select
                          value={filters.connection_status}
                          onChange={(e) => setFilters({ ...filters, connection_status: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">All Status</option>
                          <option value="connected">Connected</option>
                          <option value="pending">Pending</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Filter</label>
                        <select
                          value={filters.is_favorite === undefined ? '' : filters.is_favorite.toString()}
                          onChange={(e) => setFilters({ 
                            ...filters, 
                            is_favorite: e.target.value === '' ? undefined : e.target.value === 'true'
                          })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">All</option>
                          <option value="true">Favorites Only</option>
                        </select>
                      </div>
                    </>
                  )}

                  {(activeTab === 'requests-sent' || activeTab === 'requests-received') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                      <select
                        value={filters.request_status}
                        onChange={(e) => setFilters({ ...filters, request_status: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="declined">Declined</option>
                        <option value="withdrawn">Withdrawn</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      placeholder="Search by name, company..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600 mt-4">Loading...</p>
                  </div>
                ) : (
                  <>
                    {activeTab === 'connections' && (
                      <>
                        {connections.length === 0 ? (
                          <div className="text-center py-12">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <p className="text-gray-600 mt-4">No connections found</p>
                            <button
                              onClick={() => setShowSyncModal(true)}
                              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Sync from LinkedIn
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {getCurrentPageItems().map((connection: any) => (
                              <div
                                key={connection.id}
                                className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedItems.has(connection.id)}
                                  onChange={() => toggleSelectItem(connection.id)}
                                  className="w-4 h-4 text-blue-600 rounded mt-1"
                                />
                                
                                {connection.profile_picture_url ? (
                                  <Image
                                    src={connection.profile_picture_url}
                                    alt={connection.full_name || 'Profile'}
                                    width={56}
                                    height={56}
                                    className="w-14 h-14 rounded-full object-cover border-2 border-gray-100 flex-shrink-0"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white font-semibold text-xl">
                                      {connection.first_name?.charAt(0) || connection.full_name?.charAt(0) || '?'}
                                    </span>
                                  </div>
                                )}

                                <div className="flex-1 min-w-0">
                                  {/* Name with favorite icon */}
                                  <div className="flex items-center gap-2 mb-2">
                                    {connection.connection_linkedin_url ? (
                                      <a
                                        href={connection.connection_linkedin_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-1.5"
                                      >
                                        {connection.full_name || `${connection.first_name || ''} ${connection.last_name || ''}`.trim()}
                                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                        </svg>
                                      </a>
                                    ) : (
                                      <h3 className="text-base font-semibold text-gray-900">
                                        {connection.full_name || `${connection.first_name || ''} ${connection.last_name || ''}`.trim()}
                                      </h3>
                                    )}
                                    {connection.is_favorite && (
                                      <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                      </svg>
                                    )}
                                  </div>
                                  
                                  {/* Position/Title */}
                                  {(connection.position || connection.headline) && (
                                    <p className="text-sm text-gray-700 mb-1.5 line-clamp-1">
                                      {connection.position || connection.headline}
                                    </p>
                                  )}
                                  
                                  {/* Company */}
                                  {connection.company && (
                                    <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-2">
                                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                      </svg>
                                      <span className="truncate">{connection.company}</span>
                                    </div>
                                  )}
                                  
                                  {/* Status Badge and Date */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(connection.connection_status)}`}>
                                      {connection.connection_status}
                                    </span>
                                    {connection.connected_at && (
                                      <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {new Date(connection.connected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const response = await fetch('/api/leads/add-from-connection', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            connection_id: connection.id,
                                            full_name: connection.full_name,
                                            linkedin_url: connection.connection_linkedin_url,
                                            position: connection.position,
                                            company: connection.company,
                                            profile_picture: connection.profile_picture_url
                                          })
                                        })
                                        
                                        if (response.ok) {
                                          alert(`${connection.full_name} added to leads!`)
                                        } else {
                                          const error = await response.json()
                                          alert(error.message || 'Failed to add to leads')
                                        }
                                      } catch (error) {
                                        alert('Error adding to leads')
                                      }
                                    }}
                                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                    title="Add to Leads"
                                  >
                                    Add to Leads
                                  </button>
                                  <button
                                    onClick={() => handleToggleFavorite(connection.id, connection.is_favorite)}
                                    className="p-2 text-gray-400 hover:text-purple-600 transition-colors"
                                    title={connection.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                                  >
                                    <svg className="w-5 h-5" fill={connection.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setSelectedConnection(connection)}
                                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteConnection(connection.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {(activeTab === 'requests-sent' || activeTab === 'requests-received') && (
                      <>
                        {requests.length === 0 ? (
                          <div className="text-center py-12">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <p className="text-gray-600 mt-4">No requests found</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {getCurrentPageItems().map((request: any) => (
                              <div
                                key={request.id}
                                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedItems.has(request.id)}
                                  onChange={() => toggleSelectItem(request.id)}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                
                                {request.profile_picture_url ? (
                                  <Image
                                    src={request.profile_picture_url}
                                    alt={request.full_name || 'Profile'}
                                    width={48}
                                    height={48}
                                    className="w-12 h-12 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                    <span className="text-gray-600 font-medium text-lg">
                                      {request.first_name?.charAt(0) || request.full_name?.charAt(0) || '?'}
                                    </span>
                                  </div>
                                )}

                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium text-gray-900 truncate">
                                    {request.full_name || `${request.first_name || ''} ${request.last_name || ''}`.trim()}
                                  </h3>
                                  <p className="text-sm text-gray-600 truncate">{request.headline}</p>
                                  <div className="flex items-center gap-4 mt-1">
                                    {request.company && (
                                      <span className="text-xs text-gray-500">{request.company}</span>
                                    )}
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(request.request_status)}`}>
                                      {request.request_status}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(request.sent_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {activeTab === 'requests-received' && request.request_status === 'pending' && (
                                    <button
                                      onClick={() => handleAcceptRequest(request.id)}
                                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                                    >
                                      Accept
                                    </button>
                                  )}
                                  {activeTab === 'requests-sent' && request.request_status === 'pending' && (
                                    <button
                                      onClick={() => handleWithdrawRequest(request.id)}
                                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                                    >
                                      Withdraw
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {activeTab === 'sync-logs' && (
                      <>
                        {syncLogs.length === 0 ? (
                          <div className="text-center py-12">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-gray-600 mt-4">No sync logs found</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {getCurrentPageItems().map((log: any) => (
                              <div
                                key={log.id}
                                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h3 className="font-medium text-gray-900">{log.sync_type} Sync</h3>
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSyncStatusBadgeColor(log.sync_status)}`}>
                                        {log.sync_status}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-2">
                                      Account: {log.linkedin_account?.email}
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                      <div>
                                        <span className="text-gray-500">Connections:</span>
                                        <span className="ml-1 font-medium">{log.total_connections_synced}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">New:</span>
                                        <span className="ml-1 font-medium text-green-600">{log.new_connections_added}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Updated:</span>
                                        <span className="ml-1 font-medium text-blue-600">{log.connections_updated}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Duration:</span>
                                        <span className="ml-1 font-medium">{log.duration_seconds || 0}s</span>
                                      </div>
                                    </div>
                                    {log.error_message && (
                                      <p className="text-sm text-red-600 mt-2">{log.error_message}</p>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {new Date(log.created_at).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Pagination Controls */}
              {!loading && totalItems > 0 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} items
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        First
                      </button>
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum
                          if (totalPages <= 5) {
                            pageNum = i + 1
                          } else if (currentPage <= 3) {
                            pageNum = i + 1
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                          } else {
                            pageNum = currentPage - 2 + i
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`px-3 py-2 border rounded-lg text-sm ${
                                currentPage === pageNum
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          )
                        })}
                      </div>
                      
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {selectedConnection && (
        <ConnectionDetailModal
          connection={selectedConnection}
          onClose={() => setSelectedConnection(null)}
          onUpdate={loadData}
        />
      )}

      {showSyncModal && (
        <SyncNetworkModal
          accounts={accounts}
          onClose={() => setShowSyncModal(false)}
          onSync={handleSync}
        />
      )}

      {/* List Selection Modal */}
      {showListSelectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 relative">
            {bulkAddLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10 rounded-lg">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-900 font-medium">Adding connections to leads...</p>
                  <p className="text-gray-600 text-sm mt-1">Please wait</p>
                </div>
              </div>
            )}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Select List</h2>
              <p className="text-sm text-gray-600 mt-1">
                Add {selectedItems.size} connection(s) to a list
              </p>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto">
              {lists.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No lists found</p>
                  <Link
                    href="/leads/lists"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create a list
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {lists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => handleBulkAddToLeads(list.id)}
                      disabled={bulkAddLoading}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">
                            {list.name}
                          </h3>
                          {list.description && (
                            <p className="text-sm text-gray-600 truncate mt-1">
                              {list.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {list.lead_count || 0} leads
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 flex-shrink-0 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowListSelectModal(false)}
                disabled={bulkAddLoading}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
