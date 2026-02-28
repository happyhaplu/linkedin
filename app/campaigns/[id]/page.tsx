'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ProfileDropdown from '@/components/ProfileDropdown'
import {
  getCampaignById,
  getCampaignLeads,
  removeLeadsFromCampaign,
  addLeadsFromList,
  getCampaignAnalytics,
  getCampaignActivityLog,
  declareABTestWinner,
  updateCampaign,
  startCampaign,
  pauseCampaign,
  deleteCampaign,
  getCampaignWebhooks,
  createCampaignWebhook,
  deleteCampaignWebhook,
  addCampaignSender,
  removeCampaignSender,
} from '@/app/actions/campaigns'
import { getLists } from '@/app/actions/leads'
import { getLinkedInAccounts } from '@/app/actions/linkedin-accounts'
import AnalyticsFunnelChart from '@/components/AnalyticsFunnelChart'
import AnalyticsTrendChart from '@/components/AnalyticsTrendChart'
import VisualSequenceBuilder from '@/components/VisualSequenceBuilder'
import type { Campaign, CampaignAnalytics, CampaignSequence } from '@/types/linkedin'
import Link from 'next/link'

type TabType = 'analytics' | 'sequence' | 'leads' | 'activity' | 'settings'

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('analytics')
  const [sequences, setSequences] = useState<CampaignSequence[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [analyticsData, setAnalyticsData] = useState<CampaignAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [leadSearch, setLeadSearch] = useState('')
  const [leadStatusFilter, setLeadStatusFilter] = useState('all')
  const [activityLog, setActivityLog] = useState<any[]>([])
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [newWebhookUrl, setNewWebhookUrl] = useState('')
  const [newWebhookDesc, setNewWebhookDesc] = useState('')
  const [addingWebhook, setAddingWebhook] = useState(false)
  const [settingsForm, setSettingsForm] = useState<any>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [showAddLeadsModal, setShowAddLeadsModal] = useState(false)
  const [addLeadsListId, setAddLeadsListId] = useState('')
  const [addLeadsLoading, setAddLeadsLoading] = useState(false)
  const [availableLists, setAvailableLists] = useState<any[]>([])
  const [showLaunchMenu, setShowLaunchMenu] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [allLinkedInAccounts, setAllLinkedInAccounts] = useState<any[]>([])
  const [addingSender, setAddingSender] = useState(false)
  const [selectedSenderAccountId, setSelectedSenderAccountId] = useState('')

  // Close launch dropdown on outside click
  useEffect(() => {
    if (!showLaunchMenu) return
    const handler = () => setShowLaunchMenu(false)
    window.addEventListener('click', handler, { capture: true, once: true })
    return () => window.removeEventListener('click', handler, { capture: true })
  }, [showLaunchMenu])

  useEffect(() => {
    loadCampaignData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, activeTab])

  // Auto-refresh analytics every 30s while campaign is active
  useEffect(() => {
    if (activeTab !== 'analytics') return
    const interval = setInterval(async () => {
      try {
        const analytics = await getCampaignAnalytics(campaignId)
        setAnalyticsData(analytics)
      } catch { /* silent */ }
    }, 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, activeTab])

  const loadCampaignData = async () => {
    try {
      setLoading(true)
      const campaignData = await getCampaignById(campaignId)
      setCampaign(campaignData)
      if (!settingsForm) {
        setSettingsForm({
          name: campaignData.name,
          description: campaignData.description || '',
          daily_limit: campaignData.daily_limit,
          timezone: campaignData.timezone || 'UTC',
          working_hours_start: campaignData.working_hours_start ?? '09:00',
          working_hours_end: campaignData.working_hours_end ?? '18:00',
          working_days: campaignData.working_days ?? ['Mon','Tue','Wed','Thu','Fri'],
          delay_min_seconds: campaignData.delay_min_seconds ?? 30,
          delay_max_seconds: campaignData.delay_max_seconds ?? 120,
          warm_up_enabled: campaignData.warm_up_enabled ?? false,
          warm_up_days: campaignData.warm_up_days ?? 14,
          auto_pause_below_acceptance: campaignData.auto_pause_below_acceptance ?? 10,
          skip_already_contacted: campaignData.skip_already_contacted ?? true,
          stop_on_reply: campaignData.stop_on_reply ?? true,
        })
      }

      if (activeTab === 'analytics') {
        try {
          const analytics = await getCampaignAnalytics(campaignId)
          setAnalyticsData(analytics)
          setSequences((campaignData as any).sequences || [])
        } catch (e) { console.error('Analytics load failed:', e) }
      } else if (activeTab === 'sequence') {
        setSequences((campaignData as any).sequences || [])
      } else if (activeTab === 'leads') {
        const leadsData = await getCampaignLeads(campaignId)
        setLeads(leadsData)
      } else if (activeTab === 'activity') {
        const log = await getCampaignActivityLog(campaignId, 200)
        setActivityLog(log)
      } else if (activeTab === 'settings') {
        const wh = await getCampaignWebhooks(campaignId)
        setWebhooks(wh)
      }
    } catch (error) {
      console.error('Failed to load campaign data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportLeads = () => {
    window.open(`/api/campaigns/${campaignId}/export`, '_blank')
  }

  const handleRemoveLeads = async () => {
    if (!confirm(`Remove ${selectedLeads.size} leads from campaign?`)) return
    try {
      await removeLeadsFromCampaign(Array.from(selectedLeads))
      setSelectedLeads(new Set())
      await loadCampaignData()
    } catch (error) {
      alert('Failed to remove leads')
    }
  }

  const handleAddLeadsFromList = async () => {
    if (!addLeadsListId) return
    try {
      setAddLeadsLoading(true)
      const result = await addLeadsFromList(campaignId, addLeadsListId)
      setShowAddLeadsModal(false)
      setAddLeadsListId('')
      await loadCampaignData()
      if (result.added === 0) {
        alert('No new leads to add — all leads from this list are already in the campaign.')
      } else {
        alert(`✅ Added ${result.added} lead${result.added === 1 ? '' : 's'} to the campaign.`)
      }
    } catch (error: any) {
      alert('Failed to add leads: ' + (error.message || 'Unknown error'))
    } finally {
      setAddLeadsLoading(false)
    }
  }

  const handleDeclareWinner = async (sequenceId: string, winner: 'A' | 'B') => {
    try {
      await declareABTestWinner(sequenceId, winner)
      await loadCampaignData()
    } catch (error) {
      alert('Failed to declare winner')
    }
  }

  const handleLaunch = async (immediately: boolean) => {
    setShowLaunchMenu(false)
    setLaunching(true)
    try {
      await startCampaign(campaignId, immediately)
      await loadCampaignData()
    } catch (err) {
      alert('Failed to launch campaign')
    } finally {
      setLaunching(false)
    }
  }

  const handleAddSender = async (linkedinAccountId: string) => {
    if (!linkedinAccountId) return
    try {
      setAddingSender(true)
      await addCampaignSender(campaignId, linkedinAccountId)
      setSelectedSenderAccountId('')
      await loadCampaignData()
    } catch (error: any) {
      alert(error.message || 'Failed to add sender')
    } finally {
      setAddingSender(false)
    }
  }

  const handleRemoveSender = async (senderId: string) => {
    if (!confirm('Remove this sender from the campaign?')) return
    try {
      await removeCampaignSender(campaignId, senderId)
      await loadCampaignData()
    } catch (error: any) {
      alert(error.message || 'Failed to remove sender')
    }
  }

  // Load LinkedIn accounts for sender management
  useEffect(() => {
    getLinkedInAccounts().then(setAllLinkedInAccounts).catch(console.error)
  }, [])

  const handleSaveSettings = async () => {
    setSettingsSaving(true)
    try {
      await updateCampaign(campaignId, {
        name: settingsForm.name,
        description: settingsForm.description,
        daily_limit: settingsForm.daily_limit,
        timezone: settingsForm.timezone,
        working_hours_start: settingsForm.working_hours_start,
        working_hours_end: settingsForm.working_hours_end,
        working_days: settingsForm.working_days,
        delay_min_seconds: settingsForm.delay_min_seconds,
        delay_max_seconds: settingsForm.delay_max_seconds,
        warm_up_enabled: settingsForm.warm_up_enabled,
        warm_up_days: settingsForm.warm_up_days,
        auto_pause_below_acceptance: settingsForm.auto_pause_below_acceptance / 100,
        skip_already_contacted: settingsForm.skip_already_contacted,
        stop_on_reply: settingsForm.stop_on_reply,
      })
      await loadCampaignData()
      alert('Settings saved!')
    } catch {
      alert('Failed to save settings')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this campaign? This action cannot be undone.')) return
    try {
      await deleteCampaign(campaignId)
      router.push('/campaigns')
    } catch (error) {
      alert('Failed to delete campaign')
    }
  }

  const handleAddWebhook = async () => {
    if (!newWebhookUrl.trim()) return
    try {
      setAddingWebhook(true)
      const wh = await createCampaignWebhook(campaignId, {
        url: newWebhookUrl.trim(),
        description: newWebhookDesc.trim() || undefined,
      })
      setWebhooks(prev => [wh, ...prev])
      setNewWebhookUrl('')
      setNewWebhookDesc('')
    } catch {
      alert('Failed to add webhook')
    } finally {
      setAddingWebhook(false)
    }
  }

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Delete this webhook?')) return
    try {
      await deleteCampaignWebhook(webhookId)
      setWebhooks(prev => prev.filter(w => w.id !== webhookId))
    } catch {
      alert('Failed to delete webhook')
    }
  }

  // Load available lists when Add Leads modal opens
  useEffect(() => {
    if (showAddLeadsModal && availableLists.length === 0) {
      getLists().then(setAvailableLists).catch(console.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddLeadsModal])

  const getStatusConfig = (status: string) => {
    const configs: any = {
      draft: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
      active: { label: 'Active', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      paused: { label: 'Paused', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
      completed: { label: 'Completed', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    }
    return configs[status] || configs.draft
  }

  const filteredLeads = leads.filter(l => {
    const name = l.lead?.full_name || `${l.lead?.first_name || ''} ${l.lead?.last_name || ''}`.trim()
    const matchSearch = !leadSearch || name.toLowerCase().includes(leadSearch.toLowerCase())
    const matchStatus = leadStatusFilter === 'all' || l.status === leadStatusFilter
    return matchSearch && matchStatus
  })

  const tabs: { id: TabType; label: string; emoji: string }[] = [
    { id: 'analytics', label: 'Analytics', emoji: '📊' },
    { id: 'sequence', label: 'Sequence', emoji: '⚡' },
    { id: 'leads', label: 'Leads', emoji: '👥' },
    { id: 'activity', label: 'Activity', emoji: '📋' },
    { id: 'settings', label: 'Settings', emoji: '⚙️' },
  ]

  if (!campaign && !loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Campaign not found</h2>
          <button onClick={() => router.push('/campaigns')} className="mt-4 text-blue-600 hover:text-blue-700">
            Back to Campaigns
          </button>
        </div>
      </div>
    )
  }

  const sc = campaign ? getStatusConfig(campaign.status) : getStatusConfig('draft')

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/campaigns')} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-gray-900">{campaign?.name || 'Loading...'}</h1>
                  {campaign && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sc.bg} ${sc.text} border ${sc.border}`}>
                      {sc.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {campaign?.total_leads || 0} leads · {campaign?.connection_sent || 0} sent ·{' '}
                  {campaign?.connection_accepted || 0} accepted · {campaign?.replies_received || 0} replies
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {(campaign?.status === 'draft' || campaign?.status === 'paused') && (
                <div className="relative">
                  {/* Split button: left = default launch (immediate), right = dropdown arrow */}
                  <div className="flex rounded-lg overflow-hidden shadow-sm">
                    <button
                      disabled={launching}
                      onClick={() => handleLaunch(true)}
                      className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 text-sm font-medium flex items-center gap-2 disabled:opacity-60"
                    >
                      {launching ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        campaign?.status === 'paused' ? '▶' : '🚀'
                      )}
                      {campaign?.status === 'paused' ? 'Resume' : 'Launch Now'}
                    </button>
                    <button
                      disabled={launching}
                      onClick={() => setShowLaunchMenu(v => !v)}
                      className="px-2 py-2 bg-green-700 text-white hover:bg-green-800 border-l border-green-500 disabled:opacity-60"
                      title="Launch options"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Dropdown menu */}
                  {showLaunchMenu && (
                    <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="py-1">
                        <button
                          onClick={() => handleLaunch(true)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm"
                        >
                          <div className="font-medium text-gray-900">⚡ Launch now</div>
                          <div className="text-xs text-gray-500 mt-0.5">Start processing leads right away</div>
                        </button>
                        <div className="border-t border-gray-100" />
                        <button
                          onClick={() => handleLaunch(false)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm"
                        >
                          <div className="font-medium text-gray-900">🕘 Schedule for working hours</div>
                          <div className="text-xs text-gray-500 mt-0.5">First step waits until configured working hours</div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {campaign?.status === 'active' && (
                <button
                  onClick={() => pauseCampaign(campaignId).then(() => loadCampaignData())}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium"
                >
                  ⏸ Pause
                </button>
              )}
              <ProfileDropdown userEmail="" />
            </div>
          </div>
        </header>

        {/* Tab Bar */}
        <div className="bg-white border-b border-gray-200">
          <nav className="flex px-6 -mb-px space-x-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
                  <p className="text-gray-500 mt-3">Loading...</p>
                </div>
              </div>
            ) : (
              <>
                {/* ── NO SENDERS WARNING ── */}
                {campaign && (!campaign.senders || campaign.senders.length === 0) && (campaign.status === 'draft' || campaign.status === 'paused') && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <span className="text-xl mt-0.5">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800">No LinkedIn accounts assigned</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        This campaign needs at least one LinkedIn sender account to run. Your active accounts will be auto-assigned when you launch, or you can assign them manually in the Settings tab.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 whitespace-nowrap"
                    >
                      Manage Senders
                    </button>
                  </div>
                )}

                {/* ── ANALYTICS TAB ── */}
                {activeTab === 'analytics' && (
                  <div className="space-y-6">
                    {/* Funnel */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                      <h2 className="text-base font-semibold text-gray-900 mb-5">Conversion Funnel</h2>
                      {analyticsData && (analyticsData.funnel.sent > 0 || analyticsData.funnel.accepted > 0 || analyticsData.funnel.messaged > 0 || analyticsData.funnel.replied > 0) ? (
                        <AnalyticsFunnelChart
                          sent={analyticsData.funnel.sent}
                          sent_pct={analyticsData.funnel.sent_pct}
                          accepted={analyticsData.funnel.accepted}
                          accepted_pct={analyticsData.funnel.accepted_pct}
                          messaged={analyticsData.funnel.messaged}
                          messaged_pct={analyticsData.funnel.messaged_pct}
                          replied={analyticsData.funnel.replied}
                          replied_pct={analyticsData.funnel.replied_pct}
                        />
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <p className="text-lg mb-1">No activity yet</p>
                          <p className="text-sm">Analytics will appear here once the campaign starts sending</p>
                        </div>
                      )}
                    </div>

                    {/* Today stats — only show when there's actual activity */}
                    {analyticsData?.today && (analyticsData.today.connections_sent > 0 || analyticsData.today.messages_sent > 0 || (analyticsData.today.connections_accepted ?? 0) > 0 || analyticsData.today.replies_received > 0) && (
                      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <h2 className="text-base font-semibold text-gray-900 mb-4">Today&apos;s Activity</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            { label: 'Connections Sent', value: analyticsData.today.connections_sent, max: analyticsData.today.daily_limit, color: 'blue' },
                            { label: 'Accepted', value: analyticsData.today.connections_accepted ?? 0, max: analyticsData.today.connections_sent, color: 'green' },
                            { label: 'Messages Sent', value: analyticsData.today.messages_sent, max: analyticsData.today.daily_limit, color: 'purple' },
                            { label: 'Replies', value: analyticsData.today.replies_received, max: analyticsData.today.messages_sent, color: 'amber' },
                          ].map(stat => {
                            const pct = stat.max > 0 ? Math.round((stat.value / stat.max) * 100) : 0
                            const barColor = stat.color === 'blue' ? 'bg-blue-500' : stat.color === 'green' ? 'bg-green-500' : stat.color === 'purple' ? 'bg-purple-500' : 'bg-amber-500'
                            return (
                              <div key={stat.label} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-500">{stat.label}</span>
                                  <span className="font-semibold text-gray-900">{stat.value}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>
                                <p className="text-xs text-gray-400">{pct}% of {stat.max}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* 7-day trend */}
                    {analyticsData?.trend && analyticsData.trend.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <h2 className="text-base font-semibold text-gray-900 mb-5">7-Day Trend</h2>
                        <AnalyticsTrendChart data={analyticsData.trend} />
                      </div>
                    )}

                    {/* Per-step table */}
                    {analyticsData?.per_step && analyticsData.per_step.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                          <h2 className="text-base font-semibold text-gray-900">Step Performance</h2>
                        </div>
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Executed</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Success</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {analyticsData.per_step.map((s: any) => (
                              <tr key={s.step_number} className="hover:bg-gray-50">
                                <td className="px-6 py-3 text-sm text-gray-900">Step {s.step_number} · {s.step_type}</td>
                                <td className="px-6 py-3 text-sm text-gray-600">{s.sent}</td>
                                <td className="px-6 py-3 text-sm text-gray-600">{s.converted}</td>
                                <td className="px-6 py-3 text-sm font-medium text-green-600">
                                  {s.sent > 0 ? Math.round((s.converted / s.sent) * 100) : 0}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* A/B Test Results */}
                    {analyticsData?.ab_results && analyticsData.ab_results.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <h2 className="text-base font-semibold text-gray-900 mb-4">A/B Test Results</h2>
                        <div className="space-y-4">
                          {analyticsData.ab_results.map((ab: any) => (
                            <div key={ab.step_id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-gray-700">Step {ab.step_id}</span>
                                {ab.winner ? (
                                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                    Winner: Variant {ab.winner.toUpperCase()}
                                  </span>
                                ) : (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleDeclareWinner(ab.step_id, 'A')}
                                      className="px-3 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"
                                    >
                                      Declare A Winner
                                    </button>
                                    <button
                                      onClick={() => handleDeclareWinner(ab.step_id, 'B')}
                                      className="px-3 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100"
                                    >
                                      Declare B Winner
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-blue-50 rounded-lg">
                                  <p className="text-xs text-blue-600 font-semibold mb-1">Variant A</p>
                                  <p className="text-lg font-bold text-blue-800">{ab.variant_a_rate ?? 0}%</p>
                                  <p className="text-xs text-blue-500">reply rate · {ab.variant_a_replied || 0} replied</p>
                                </div>
                                <div className="p-3 bg-purple-50 rounded-lg">
                                  <p className="text-xs text-purple-600 font-semibold mb-1">Variant B</p>
                                  <p className="text-lg font-bold text-purple-800">{ab.variant_b_rate ?? 0}%</p>
                                  <p className="text-xs text-purple-500">reply rate · {ab.variant_b_replied || 0} replied</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Per-sender table */}
                    {analyticsData?.per_sender && analyticsData.per_sender.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                          <h2 className="text-base font-semibold text-gray-900">Sender Performance</h2>
                        </div>
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accepted</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Replies</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accept %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {analyticsData.per_sender.map((s: any) => {
                              const acceptPct = s.connections_sent > 0
                                ? Math.round((s.accepted / s.connections_sent) * 100)
                                : 0
                              return (
                                <tr key={s.account_id} className="hover:bg-gray-50">
                                  <td className="px-6 py-3 text-sm text-gray-900">{s.profile_name || s.account_id}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{s.connections_sent}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{s.accepted}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{s.replied}</td>
                                  <td className="px-6 py-3 text-sm font-medium">
                                    <span className={acceptPct >= 30 ? 'text-green-600' : acceptPct >= 15 ? 'text-yellow-600' : 'text-red-500'}>
                                      {acceptPct}%
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Performance benchmarks */}
                    {analyticsData && analyticsData.funnel.sent > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <h2 className="text-base font-semibold text-gray-900 mb-4">📈 vs Industry Benchmarks</h2>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { label: 'Acceptance Rate', yours: analyticsData.funnel.accepted_pct, avg: 30, avgLabel: '30% industry avg' },
                            { label: 'Reply Rate', yours: analyticsData.funnel.replied_pct, avg: 8, avgLabel: '8% industry avg' },
                          ].map(b => {
                            const isAbove = b.yours >= b.avg
                            return (
                              <div key={b.label} className={`rounded-xl p-4 border ${isAbove ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                <p className="text-xs font-medium text-gray-500 mb-1">{b.label}</p>
                                <p className={`text-2xl font-bold ${isAbove ? 'text-green-700' : 'text-red-600'}`}>{b.yours}%</p>
                                <p className={`text-xs mt-1 ${isAbove ? 'text-green-600' : 'text-red-500'}`}>
                                  {isAbove ? '✅ Above' : '⚠️ Below'} {b.avgLabel}
                                  {b.yours !== b.avg && ` (${b.yours > b.avg ? '+' : ''}${b.yours - b.avg}pp)`}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'sequence' && (
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-base font-semibold text-gray-900">Campaign Sequence</h2>
                        <p className="text-sm text-gray-500 mt-1">
                          {campaign?.status === 'active' ? 'Campaign is live — sequence is read-only.' : 'Edit the sequence steps below.'}
                        </p>
                      </div>
                      {(campaign?.status === 'draft' || campaign?.status === 'paused') && (
                        <Link
                          href={`/campaigns/${campaignId}/edit-sequence`}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                          ✏️ Edit Sequence
                        </Link>
                      )}
                    </div>
                    {sequences.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">No sequence steps configured yet.</div>
                    ) : (
                      <VisualSequenceBuilder
                        sequences={sequences as any}
                        onChange={() => {}}
                        readOnly
                      />
                    )}
                  </div>
                )}

                {/* ── LEADS TAB ── */}
                {activeTab === 'leads' && (
                  <div className="space-y-4">
                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={leadSearch}
                          onChange={e => setLeadSearch(e.target.value)}
                          placeholder="Search leads..."
                          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <select
                          value={leadStatusFilter}
                          onChange={e => setLeadStatusFilter(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="all">All statuses</option>
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="replied">Replied</option>
                          <option value="skipped">Skipped</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedLeads.size > 0 && (
                          <button
                            onClick={handleRemoveLeads}
                            className="px-4 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                          >
                            Remove {selectedLeads.size} leads
                          </button>
                        )}
                        <button
                          onClick={() => setShowAddLeadsModal(true)}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
                        >
                          ➕ Add Leads
                        </button>
                        <button
                          onClick={handleExportLeads}
                          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                          📤 Export CSV
                        </button>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                      {filteredLeads.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">No leads found</div>
                      ) : (
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  onChange={e => setSelectedLeads(e.target.checked ? new Set(filteredLeads.map(l => l.id)) : new Set())}
                                  className="w-4 h-4 text-blue-600"
                                />
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variant</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Replied</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredLeads.map((leadItem: any) => {
                              const name = leadItem.lead?.full_name || `${leadItem.lead?.first_name || ''} ${leadItem.lead?.last_name || ''}`.trim() || 'Unknown'
                              return (
                                <tr key={leadItem.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedLeads.has(leadItem.id)}
                                      onChange={() => {
                                        const s = new Set(selectedLeads)
                                        s.has(leadItem.id) ? s.delete(leadItem.id) : s.add(leadItem.id)
                                        setSelectedLeads(s)
                                      }}
                                      className="w-4 h-4 text-blue-600"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm font-medium text-gray-900">{name}</div>
                                    <div className="text-xs text-gray-500">{leadItem.lead?.company}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      leadItem.status === 'completed' ? 'bg-green-100 text-green-700' :
                                      leadItem.status === 'replied' ? 'bg-purple-100 text-purple-700' :
                                      leadItem.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                      leadItem.status === 'skipped' ? 'bg-gray-100 text-gray-600' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {leadItem.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs font-mono text-gray-500">
                                    {leadItem.variant ? leadItem.variant.toUpperCase() : '—'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {leadItem.current_step_number || '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    {leadItem.first_reply_at ? (
                                      <span className="text-xs text-green-600">✓ Replied</span>
                                    ) : (
                                      <span className="text-xs text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-500">
                                    {leadItem.last_activity_at
                                      ? new Date(leadItem.last_activity_at).toLocaleDateString()
                                      : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {/* ── ACTIVITY TAB ── */}
                {activeTab === 'activity' && (
                  <div className="space-y-4">
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-900">Activity Log</h2>
                        <span className="text-xs text-gray-400">{activityLog.length} events</span>
                      </div>
                      {activityLog.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                          <p className="text-4xl mb-3">📋</p>
                          <p className="font-medium">No activity yet</p>
                          <p className="text-sm mt-1">Events will appear here when the campaign starts executing.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {activityLog.map((entry: any) => {
                            const lead = entry.campaign_lead?.lead
                            const leadName = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown' : 'Unknown'
                            const isSuccess = entry.activity_status === 'success' || entry.activity_status === 'completed'
                            const isError = entry.activity_status === 'error' || entry.activity_status === 'failed'
                            const typeEmoji: Record<string, string> = {
                              connection_request: '🤝',
                              message: '💬',
                              inmail: '📨',
                              view_profile: '👁️',
                              follow: '➕',
                              delay: '⏱️',
                            }
                            const emoji = typeEmoji[entry.activity_type] || '⚡'
                            return (
                              <div key={entry.id} className="flex items-start gap-4 px-6 py-3.5 hover:bg-gray-50">
                                <span className="text-xl mt-0.5">{emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900">{leadName}</span>
                                    <span className="text-xs text-gray-400">·</span>
                                    <span className="text-xs text-gray-500 capitalize">{entry.activity_type?.replace(/_/g, ' ')}</span>
                                    <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
                                      isSuccess ? 'bg-green-100 text-green-700' :
                                      isError ? 'bg-red-100 text-red-600' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {entry.activity_status}
                                    </span>
                                  </div>
                                  {entry.message_content && (
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{entry.message_content}</p>
                                  )}
                                  {entry.error_message && (
                                    <p className="text-xs text-red-500 mt-0.5">{entry.error_message}</p>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                  {entry.executed_at ? new Date(entry.executed_at).toLocaleString() : '—'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── SETTINGS TAB ── */}
                {activeTab === 'settings' && settingsForm && (
                  <div className="space-y-6 max-w-2xl">
                    {/* Basic Settings */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
                      <h2 className="text-base font-semibold text-gray-900">Campaign Settings</h2>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Campaign Name</label>
                        <input
                          type="text"
                          value={settingsForm.name}
                          onChange={e => setSettingsForm({ ...settingsForm, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                        <textarea
                          value={settingsForm.description}
                          onChange={e => setSettingsForm({ ...settingsForm, description: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Daily Limit</label>
                          <input
                            type="number"
                            min={1} max={200}
                            value={settingsForm.daily_limit}
                            onChange={e => setSettingsForm({ ...settingsForm, daily_limit: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
                          <select
                            value={settingsForm.timezone}
                            onChange={e => setSettingsForm({ ...settingsForm, timezone: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="UTC">UTC</option>
                            <option value="America/New_York">Eastern</option>
                            <option value="America/Los_Angeles">Pacific</option>
                            <option value="Europe/London">London</option>
                            <option value="Asia/Kolkata">India</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Safety Settings */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
                      <h2 className="text-base font-semibold text-gray-900">🛡️ Safety Settings</h2>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Working Hours Start</label>
                          <input type="time" value={settingsForm.working_hours_start ?? '09:00'}
                            onChange={e => setSettingsForm({ ...settingsForm, working_hours_start: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Working Hours End</label>
                          <input type="time" value={settingsForm.working_hours_end ?? '18:00'}
                            onChange={e => setSettingsForm({ ...settingsForm, working_hours_end: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Min Delay (seconds)</label>
                          <input type="number" min={5} value={settingsForm.delay_min_seconds}
                            onChange={e => setSettingsForm({ ...settingsForm, delay_min_seconds: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Delay (seconds)</label>
                          <input type="number" min={5} value={settingsForm.delay_max_seconds}
                            onChange={e => setSettingsForm({ ...settingsForm, delay_max_seconds: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Auto-pause below acceptance rate (%)</label>
                        <input type="number" min={0} max={100} value={settingsForm.auto_pause_below_acceptance}
                          onChange={e => setSettingsForm({ ...settingsForm, auto_pause_below_acceptance: parseInt(e.target.value) })}
                          className="w-48 px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={settingsForm.skip_already_contacted}
                            onChange={e => setSettingsForm({ ...settingsForm, skip_already_contacted: e.target.checked })}
                            className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-700">Skip already-contacted leads</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={settingsForm.stop_on_reply}
                            onChange={e => setSettingsForm({ ...settingsForm, stop_on_reply: e.target.checked })}
                            className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-700">Stop sequence on reply</span>
                        </label>
                      </div>
                      <button
                        onClick={handleSaveSettings}
                        disabled={settingsSaving}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                      >
                        {settingsSaving ? 'Saving...' : 'Save Settings'}
                      </button>
                    </div>

                    {/* Outbound Webhooks */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                      <h2 className="text-base font-semibold text-gray-900 mb-1">🔗 Outbound Webhooks</h2>
                      <p className="text-xs text-gray-500 mb-5">POST to external URLs on campaign events (connection sent, replied, etc.). Ideal for CRM syncing via n8n, Zapier, Make.</p>

                      {/* Add webhook */}
                      <div className="flex gap-2 mb-5">
                        <input
                          type="url"
                          placeholder="https://your-endpoint.com/webhook"
                          value={newWebhookUrl}
                          onChange={e => setNewWebhookUrl(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Description (optional)"
                          value={newWebhookDesc}
                          onChange={e => setNewWebhookDesc(e.target.value)}
                          className="w-44 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <button
                          onClick={handleAddWebhook}
                          disabled={addingWebhook || !newWebhookUrl.trim()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                        >
                          {addingWebhook ? 'Adding...' : '+ Add'}
                        </button>
                      </div>

                      {webhooks.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No webhooks configured yet.</p>
                      ) : (
                        <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                          {webhooks.map((wh: any) => (
                            <div key={wh.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-mono text-gray-800 truncate">{wh.url}</p>
                                {wh.description && <p className="text-xs text-gray-500">{wh.description}</p>}
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${wh.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {wh.is_active ? 'Active' : 'Paused'}
                              </span>
                              <button
                                onClick={() => handleDeleteWebhook(wh.id)}
                                className="text-gray-400 hover:text-red-500 text-lg leading-none"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sender Accounts */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                      <h2 className="text-base font-semibold text-gray-900 mb-1">👤 Sender Accounts</h2>
                      <p className="text-xs text-gray-500 mb-5">LinkedIn accounts that will send connection requests and messages for this campaign.</p>

                      {/* Current senders */}
                      {campaign?.senders && campaign.senders.length > 0 ? (
                        <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden mb-4">
                          {campaign.senders.map((sender: any) => (
                            <div key={sender.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                                {(sender.linkedin_account?.profile_name || sender.linkedin_account?.email || '?')[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {sender.linkedin_account?.profile_name || sender.linkedin_account?.email || 'Unknown'}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{sender.linkedin_account?.email}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                sender.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {sender.is_active ? 'Active' : 'Paused'}
                              </span>
                              <button
                                onClick={() => handleRemoveSender(sender.id)}
                                className="text-gray-400 hover:text-red-500 text-lg leading-none"
                                title="Remove sender"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-lg mb-4">
                          <p className="text-2xl mb-1">👤</p>
                          <p className="text-sm">No senders assigned yet</p>
                          <p className="text-xs mt-0.5">Active accounts will be auto-assigned when you launch</p>
                        </div>
                      )}

                      {/* Add sender dropdown */}
                      {(() => {
                        const assignedIds = new Set((campaign?.senders || []).map((s: any) => s.linkedin_account?.id))
                        const available = allLinkedInAccounts.filter((a: any) => a.status === 'active' && !assignedIds.has(a.id))
                        if (available.length === 0 && (campaign?.senders?.length || 0) > 0) return null
                        if (available.length === 0) return (
                          <p className="text-xs text-gray-400 italic">No active LinkedIn accounts available. <a href="/linkedin-account" className="text-blue-600 hover:underline">Connect one first →</a></p>
                        )
                        return (
                          <div className="flex gap-2">
                            <select
                              value={selectedSenderAccountId}
                              onChange={e => setSelectedSenderAccountId(e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Select a LinkedIn account to add...</option>
                              {available.map((acct: any) => (
                                <option key={acct.id} value={acct.id}>
                                  {acct.profile_name || acct.email} ({acct.email})
                                </option>
                              ))}
                            </select>
                            <button
                              disabled={addingSender || !selectedSenderAccountId}
                              onClick={() => handleAddSender(selectedSenderAccountId)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              {addingSender ? 'Adding...' : '+ Add Sender'}
                            </button>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-white border border-red-200 rounded-xl p-6 shadow-sm">
                      <h2 className="text-base font-semibold text-red-700 mb-3">⚠️ Danger Zone</h2>
                      <p className="text-sm text-gray-500 mb-4">Permanently delete this campaign and all its data. This cannot be undone.</p>
                      <button
                        onClick={handleDelete}
                        className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                      >
                        Delete Campaign
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* ── ADD LEADS MODAL ── */}
      {showAddLeadsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddLeadsModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Add Leads to Campaign</h2>
                <p className="text-sm text-gray-500 mt-0.5">Select a lead list to enroll</p>
              </div>
              <button
                onClick={() => setShowAddLeadsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {availableLists.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm">No lead lists found. Create one in the Leads section first.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Choose a list</label>
                <select
                  value={addLeadsListId}
                  onChange={e => setAddLeadsListId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">— Select a list —</option>
                  {availableLists.map((list: any) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.lead_count ?? list.leads_count ?? '?'} leads)
                    </option>
                  ))}
                </select>

                <p className="text-xs text-gray-400">
                  Leads already in this campaign will be skipped automatically.
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAddLeadsModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddLeadsFromList}
                    disabled={!addLeadsListId || addLeadsLoading}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addLeadsLoading ? 'Adding...' : 'Add Leads'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
