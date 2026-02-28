'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import ProfileDropdown from '@/components/ProfileDropdown'
import { getCampaigns, deleteCampaign, startCampaign, pauseCampaign, getCampaignTemplates } from '@/app/actions/campaigns'
import type { Campaign, CampaignTemplate } from '@/types/linkedin'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<(Campaign & { lead_list?: any, senders?: any[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filters, setFilters] = useState({ status: 'all', search: '' })
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templates, setTemplates] = useState<CampaignTemplate[]>([])

  useEffect(() => {
    loadCampaigns()
    getCampaignTemplates().then(setTemplates).catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      const data = await getCampaigns(filters.status === 'all' ? {} : { status: filters.status })
      setCampaigns(data ?? [])
    } catch (error) {
      console.error('Failed to load campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Delete this campaign? This action cannot be undone.')) return
    
    try {
      await deleteCampaign(campaignId)
      await loadCampaigns()
    } catch (error) {
      console.error('Failed to delete campaign:', error)
      alert('Failed to delete campaign')
    }
  }

  const handleStart = async (campaignId: string) => {
    try {
      await startCampaign(campaignId)
      await loadCampaigns()
    } catch (error) {
      console.error('Failed to start campaign:', error)
      alert('Failed to start campaign')
    }
  }

  const handlePause = async (campaignId: string) => {
    try {
      await pauseCampaign(campaignId)
      await loadCampaigns()
    } catch (error) {
      console.error('Failed to pause campaign:', error)
      alert('Failed to pause campaign')
    }
  }

  const getStatusConfig = (status: string) => {
    const configs: any = {
      draft: { color: 'gray', icon: '📝', label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
      active: { color: 'green', icon: '▶️', label: 'Active', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      paused: { color: 'yellow', icon: '⏸️', label: 'Paused', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
      completed: { color: 'blue', icon: '✅', label: 'Completed', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      canceled: { color: 'red', icon: '❌', label: 'Canceled', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
    }
    return configs[status] || configs.draft
  }

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesStatus = filters.status === 'all' || campaign.status === filters.status
    const matchesSearch = !filters.search || 
      campaign.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      campaign.description?.toLowerCase().includes(filters.search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const stats = {
    total: campaigns.length,
    active: campaigns.filter(c => c.status === 'active').length,
    paused: campaigns.filter(c => c.status === 'paused').length,
    draft: campaigns.filter(c => c.status === 'draft').length,
    totalLeadsContacted: campaigns.reduce((sum, c) => sum + (c.connection_sent || 0), 0),
    totalAccepted: campaigns.reduce((sum, c) => sum + (c.connection_accepted || 0), 0),
    totalReplies: campaigns.reduce((sum, c) => sum + (c.replies_received || 0), 0)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
              <p className="text-sm text-gray-500 mt-1">Automate LinkedIn outreach at scale</p>
            </div>
            <div className="flex items-center space-x-4">
              <ProfileDropdown userEmail="" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Campaigns</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-xs text-gray-500">
                  <span className="text-green-600 font-medium">{stats.active} active</span>
                  <span className="mx-2">•</span>
                  <span>{stats.draft} drafts</span>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Leads Contacted</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalLeadsContacted}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-xs text-gray-500">
                  <span>Across all campaigns</span>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Acceptance Rate</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {stats.totalLeadsContacted > 0 
                        ? Math.round((stats.totalAccepted / stats.totalLeadsContacted) * 100)
                        : 0}%
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-xs text-gray-500">
                  <span>{stats.totalAccepted} connections accepted</span>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Reply Rate</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {stats.totalLeadsContacted > 0 
                        ? Math.round((stats.totalReplies / stats.totalLeadsContacted) * 100)
                        : 0}%
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-xs text-gray-500">
                  <span>{stats.totalReplies} replies received</span>
                </div>
              </div>
            </div>

            {/* Filters and Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center space-x-2 flex-1">
                  {/* Status Tabs */}
                  <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                    {[
                      { value: 'all', label: 'All', count: stats.total },
                      { value: 'active', label: 'Active', count: stats.active },
                      { value: 'paused', label: 'Paused', count: stats.paused },
                      { value: 'draft', label: 'Drafts', count: stats.draft }
                    ].map((tab) => (
                      <button
                        key={tab.value}
                        onClick={() => setFilters({ ...filters, status: tab.value })}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          filters.status === tab.value
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {tab.label} <span className="text-xs text-gray-500">({tab.count})</span>
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="relative flex-1 max-w-sm">
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      placeholder="Search campaigns..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {/* View Toggle */}
                  <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setView('grid')}
                      className={`p-2 rounded-md transition-all ${
                        view === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                      }`}
                      title="Grid view"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setView('list')}
                      className={`p-2 rounded-md transition-all ${
                        view === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                      }`}
                      title="List view"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Create Campaign Button */}
                  <Link
                    href="/campaigns/new"
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium transition-all shadow-sm space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>New Campaign</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Campaigns Display */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
                  <p className="text-gray-600 mt-4 font-medium">Loading campaigns...</p>
                </div>
              </div>
            ) : filteredCampaigns.length === 0 && campaigns.length === 0 ? (
              // ── Enhanced Empty State ──
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <svg className="w-24 h-24 text-blue-100 mb-6" fill="currentColor" viewBox="0 0 100 100">
                  <ellipse cx="50" cy="85" rx="28" ry="6" fill="#dbeafe" />
                  <rect x="38" y="55" width="24" height="30" rx="4" fill="#3b82f6" />
                  <polygon points="50,15 62,50 50,44 38,50" fill="#1d4ed8" />
                  <polygon points="38,50 30,42 37,55" fill="#60a5fa" />
                  <polygon points="62,50 70,42 63,55" fill="#60a5fa" />
                  <circle cx="44" cy="68" r="2.5" fill="white" />
                  <circle cx="56" cy="68" r="2.5" fill="white" />
                </svg>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">No campaigns yet</h2>
                <p className="text-gray-500 max-w-sm mb-8">
                  Create your first outreach campaign and start connecting automatically.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Link
                    href="/campaigns/new"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-colors shadow-sm"
                  >
                    🚀 Create Campaign
                  </Link>
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
                  >
                    📋 Use a Template
                  </button>
                </div>
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-16">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No campaigns found</h3>
                  <p className="text-gray-500">Try adjusting your filters or search query</p>
                </div>
              </div>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCampaigns.map((campaign) => {
                  const statusConfig = getStatusConfig(campaign.status)
                  const acceptRate = campaign.connection_sent > 0
                    ? Math.round((campaign.connection_accepted / campaign.connection_sent) * 100)
                    : 0
                  const replyRate = campaign.messages_sent > 0
                    ? Math.round((campaign.replies_received / campaign.messages_sent) * 100)
                    : 0

                  return (
                    <div
                      key={campaign.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all overflow-hidden group"
                    >
                      {/* Card Header */}
                      <div className="p-5 border-b border-gray-100">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <Link href={`/campaigns/${campaign.id}`}>
                              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                                {campaign.name}
                              </h3>
                            </Link>
                            {campaign.description && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{campaign.description}</p>
                            )}
                          </div>
                          <span className={`ml-3 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border} flex-shrink-0`}>
                            {statusConfig.icon} {statusConfig.label}
                          </span>
                          {campaign.status === 'paused' &&
                           campaign.auto_pause_below_acceptance != null &&
                           campaign.connection_sent > 0 &&
                           acceptRate < (campaign.auto_pause_below_acceptance ?? 100) && (
                            <span className="ml-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 flex-shrink-0 flex items-center gap-1">
                              ⚠️ Auto-paused
                            </span>
                          )}
                        </div>

                        {/* Funnel Mini-Stats */}
                        <div className="mt-3 flex items-center gap-2 text-xs">
                          <span className="text-gray-500">{campaign.connection_sent || 0} sent</span>
                          <span className="text-gray-300">·</span>
                          <span className={acceptRate >= 30 ? 'text-green-600 font-semibold' : acceptRate >= 15 ? 'text-yellow-600 font-semibold' : 'text-red-500 font-semibold'}>
                            {acceptRate}% accepted
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="text-purple-600 font-semibold">{replyRate}% replied</span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-5">
                        {/* Senders */}
                        {campaign.senders && campaign.senders.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs text-gray-500 mb-2">Senders ({campaign.senders.length})</p>
                            <div className="flex -space-x-2">
                              {campaign.senders.slice(0, 3).map((sender, idx) => (
                                <div 
                                  key={idx}
                                  className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                                  title={`Sender ${idx + 1}`}
                                >
                                  {String.fromCharCode(65 + idx)}
                                </div>
                              ))}
                              {campaign.senders.length > 3 && (
                                <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-medium">
                                  +{campaign.senders.length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-2">
                          {campaign.status === 'draft' && (
                            <button
                              onClick={() => handleStart(campaign.id)}
                              className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Launch</span>
                            </button>
                          )}
                          {campaign.status === 'active' && (
                            <button
                              onClick={() => handlePause(campaign.id)}
                              className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Pause</span>
                            </button>
                          )}
                          {campaign.status === 'paused' && (
                            <button
                              onClick={() => handleStart(campaign.id)}
                              className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Resume</span>
                            </button>
                          )}
                          
                          <Link
                            href={`/campaigns/${campaign.id}`}
                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                          >
                            View
                          </Link>
                          
                          <button
                            onClick={() => handleDelete(campaign.id)}
                            className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors"
                            title="Delete campaign"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                        <p className="text-xs text-gray-500">
                          Created {new Date(campaign.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* List View */
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Senders</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCampaigns.map((campaign) => {
                      const statusConfig = getStatusConfig(campaign.status)
                      const acceptRate = campaign.connection_sent > 0
                        ? Math.round((campaign.connection_accepted / campaign.connection_sent) * 100)
                        : 0
                      const replyRate = campaign.messages_sent > 0
                        ? Math.round((campaign.replies_received / campaign.messages_sent) * 100)
                        : 0

                      return (
                        <tr key={campaign.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <Link href={`/campaigns/${campaign.id}`}>
                              <div className="text-sm font-medium text-gray-900 hover:text-blue-600">{campaign.name}</div>
                              <div className="text-sm text-gray-500 line-clamp-1">{campaign.description}</div>
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}>
                              {statusConfig.icon} {statusConfig.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <div className="flex-1 w-24 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ 
                                    width: `${campaign.total_leads > 0 ? ((campaign.pending_leads || 0) / campaign.total_leads) * 100 : 0}%` 
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 whitespace-nowrap">
                                {campaign.pending_leads || 0}/{campaign.total_leads || 0}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3 text-sm">
                              <div className="flex items-center space-x-1">
                                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-medium text-gray-900">{acceptRate}%</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span className="font-medium text-gray-900">{replyRate}%</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {campaign.senders && campaign.senders.length > 0 && (
                              <div className="flex -space-x-2">
                                {campaign.senders.slice(0, 3).map((sender, idx) => (
                                  <div 
                                    key={idx}
                                    className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                                    title={`Sender ${idx + 1}`}
                                  >
                                    {String.fromCharCode(65 + idx)}
                                  </div>
                                ))}
                                {campaign.senders.length > 3 && (
                                  <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-medium">
                                    +{campaign.senders.length - 3}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              {campaign.status === 'draft' && (
                                <button
                                  onClick={() => handleStart(campaign.id)}
                                  className="text-green-600 hover:text-green-700"
                                  title="Launch campaign"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              )}
                              {campaign.status === 'active' && (
                                <button
                                  onClick={() => handlePause(campaign.id)}
                                  className="text-yellow-600 hover:text-yellow-700"
                                  title="Pause campaign"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              )}
                              {campaign.status === 'paused' && (
                                <button
                                  onClick={() => handleStart(campaign.id)}
                                  className="text-green-600 hover:text-green-700"
                                  title="Resume campaign"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              )}
                              <Link
                                href={`/campaigns/${campaign.id}`}
                                className="text-blue-600 hover:text-blue-700"
                                title="View campaign"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </Link>
                              <button
                                onClick={() => handleDelete(campaign.id)}
                                className="text-red-600 hover:text-red-700"
                                title="Delete campaign"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* QuickStart Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Choose a Template</h2>
                <p className="text-sm text-gray-500 mt-1">Start with a proven sequence</p>
              </div>
              <button onClick={() => setShowTemplateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Loading templates...</div>
              ) : templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    setShowTemplateModal(false)
                    router.push(`/campaigns/new?template=${tpl.id}`)
                  }}
                  className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                >
                  <span className="text-3xl">{(tpl as any).icon || '📋'}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">{tpl.name}</h3>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tpl.steps?.length || 0} steps</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{tpl.description}</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <Link
                href="/campaigns/new"
                className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                onClick={() => setShowTemplateModal(false)}
              >
                Or start from scratch →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
