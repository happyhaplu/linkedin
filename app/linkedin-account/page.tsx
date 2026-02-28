'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Sidebar from '@/components/Sidebar'
import ProfileDropdown from '@/components/ProfileDropdown'
import ConnectAccountModal from '@/components/ConnectAccountModal'
import PinVerificationModal from '@/components/PinVerificationModal'
import ProxyModal from '@/components/ProxyModal'
import AssignCampaignsModal from '@/components/AssignCampaignsModal'
import AssignProxyModal from '@/components/AssignProxyModal'
import ConfigureLimitsModal from '@/components/ConfigureLimitsModal'
import OTPVerificationModal from '@/components/OTPVerificationModal'
import { getLinkedInAccounts, completeLinkedInAccountWithPin, deleteLinkedInAccount, toggleAccountStatus, assignCampaignsToAccount, verifyOTP, updateAccountLimits, updateAccountProxy } from '@/app/actions/linkedin-accounts'
import { getProxies, createProxy, updateProxy, deleteProxy, testProxy } from '@/app/actions/proxies'
import { getCampaigns } from '@/app/actions/campaigns'
import { monitorAccountHealth } from '@/app/actions/account-health'
import type { LinkedInAccount, Proxy } from '@/types/linkedin'

export default function LinkedinAccountPage() {
  const [userEmail] = useState('')
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([])
  const [proxies, setProxies] = useState<Proxy[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [showProxyModal, setShowProxyModal] = useState(false)
  const [showProxyList, setShowProxyList] = useState(false)
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [showOTPModal, setShowOTPModal] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showAssignProxyModal, setShowAssignProxyModal] = useState(false)
  const [showConfigureLimitsModal, setShowConfigureLimitsModal] = useState(false)
  const [pendingAccount, setPendingAccount] = useState<LinkedInAccount | null>(null)
  const [verifyingAccount, setVerifyingAccount] = useState<any>(null)
  const [configuringAccount, setConfiguringAccount] = useState<any>(null)
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<LinkedInAccount | null>(null)
  const [reconnectingAccount, setReconnectingAccount] = useState<LinkedInAccount | null>(null)
  const [monitoringHealth, setMonitoringHealth] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  // Auto-sync profile data for accounts that are missing it
  // Uses a ref to ensure this only runs ONCE per page load, not on every re-render
  const autoSyncRan = useRef(false)
  useEffect(() => {
    if (autoSyncRan.current) return
    const syncMissingProfiles = async () => {
      const accountsNeedingSync = accounts.filter(
        acc => acc.status === 'active' && !acc.profile_name && acc.session_cookies?.li_at
      )
      if (accountsNeedingSync.length === 0) return

      autoSyncRan.current = true
      console.log(`🔄 Auto-syncing profile data for ${accountsNeedingSync.length} account(s)...`)
      for (const acc of accountsNeedingSync) {
        try {
          const { resyncAccountProfileSafe } = await import('@/app/actions/resync-profile')
          await resyncAccountProfileSafe(acc.id)
          console.log(`✅ Profile synced for ${acc.email}`)
        } catch (err: any) {
          // Do NOT auto-disconnect — this is a cosmetic sync, not a health check
          console.log(`⚠️ Profile sync failed for ${acc.email}:`, err.message)
        }
      }
      await loadData()
    }
    if (!loading && accounts.length > 0) {
      syncMissingProfiles()
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const [accountsData, proxiesData, campaignsData] = await Promise.all([
        getLinkedInAccounts(),
        getProxies(),
        getCampaigns()
      ])
      setAccounts(accountsData as any)
      setProxies(proxiesData)
      setCampaigns(campaignsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectAccount = async (data: any) => {
    try {
      console.log('🔌 handleConnectAccount:', {
        email: data.email,
        loginMethod: data.loginMethod,
        hasPassword: !!data.password,
        hasCookie: !!data.li_at_cookie,
        proxyId: data.proxy_id,
        isReconnecting: !!reconnectingAccount
      })

      // ─── Reconnecting an existing account ───────────────
      if (reconnectingAccount) {
        console.log('🔄 Reconnecting:', reconnectingAccount.id)

        // Reconnect supports both password (proxy_login) and cookie
        if (data.loginMethod === 'proxy_login' && data.password) {
          // Re-login through proxy with fresh credentials
          const { connectWithProxy } = await import('@/app/actions/linkedin-accounts')
          const result = await connectWithProxy({
            email: data.email,
            password: data.password,
            proxy_id: data.proxy_id,
          })
          if (result.requiresPin) {
            await loadData()
            const newAccount = (await getLinkedInAccounts()).find((acc: any) => acc.id === result.accountId)
            if (newAccount) {
              handleVerifyPin({ ...newAccount, _proxySessionId: result.sessionId, _proxyId: data.proxy_id, _isProxyLogin: true } as any)
            }
            setReconnectingAccount(null)
            return
          }
        } else {
          // Cookie-based reconnect
          const cookieValue = data.li_at_cookie?.trim()
          if (!cookieValue) throw new Error('Session cookie is required')
          const { reconnectLinkedInAccount } = await import('@/app/actions/linkedin-accounts')
          await reconnectLinkedInAccount(reconnectingAccount.id, {
            secret_key: cookieValue,
            proxy_id: data.proxy_id
          })
        }

        console.log('✅ Account reconnected!')
        setReconnectingAccount(null)
        await loadData()
        return
      }

      // ─── Method 1: Email + Password (Primary) ───────────
      if (data.loginMethod === 'proxy_login') {
        console.log('🚀 Connecting via email + password')

        if (!data.password) throw new Error('Password is required')

        // Auto-resolve proxy: use selected, or pick best available
        let proxyId = data.proxy_id
        if (!proxyId && proxies.length > 0) {
          const residential = proxies.find((p: any) => p.type === 'residential' && p.status !== 'error')
          proxyId = residential?.id || proxies[0]?.id
          console.log('🌐 Auto-selected proxy:', proxyId)
        }

        const { connectWithProxy } = await import('@/app/actions/linkedin-accounts')
        const result = await connectWithProxy({
          email: data.email,
          password: data.password,
          proxy_id: proxyId,
        })

        // Handle 2FA
        if (result.requiresPin) {
          await loadData()
          const newAccount = (await getLinkedInAccounts()).find((acc: any) => acc.id === result.accountId)
          if (newAccount) {
            handleVerifyPin({
              ...newAccount,
              _proxySessionId: result.sessionId,
              _proxyId: proxyId,
              _isProxyLogin: true,
            } as any)
          }
          return
        }

        console.log('✅ Account connected successfully!')
        await loadData()
        return
      }

      // ─── Method 2: Import Session Cookie ─────────────────
      if (data.loginMethod === 'cookie') {
        console.log('🔑 Importing session cookie')

        const cookieValue = data.li_at_cookie?.trim()
        if (!cookieValue) throw new Error('Session cookie is required')

        const { createInfiniteLoginWithCookie } = await import('@/app/actions/linkedin-accounts')
        await createInfiniteLoginWithCookie({
          email: data.email,
          secret_key: cookieValue,
          proxy_id: data.proxy_id
        })

        console.log('✅ Session imported successfully!')
        await loadData()
        return
      }

      throw new Error('Invalid login method')
    } catch (error: any) {
      console.error('❌ handleConnectAccount error:', error.message)
      throw error
    }
  }

  const handleVerifyPin = async (account: any) => {
    setVerifyingAccount(account)
    setShowPinModal(true)
  }

  const handlePinSubmit = async (pin: string) => {
    if (!verifyingAccount) return
    
    // Check if this is a proxy login 2FA session
    if (verifyingAccount._isProxyLogin && verifyingAccount._proxySessionId) {
      const { completeProxyLogin2FA } = await import('@/app/actions/linkedin-accounts')
      await completeProxyLogin2FA({
        account_id: verifyingAccount.id,
        pin,
        session_id: verifyingAccount._proxySessionId,
        proxy_id: verifyingAccount._proxyId,
      })
    } else if (verifyingAccount.session_id?.startsWith('infinite_')) {
      const { complete2FAInfiniteLogin } = await import('@/app/actions/linkedin-accounts')
      await complete2FAInfiniteLogin({
        accountId: verifyingAccount.id,
        sessionId: verifyingAccount.session_id,
        code: pin
      })
    } else {
      await completeLinkedInAccountWithPin({
        accountId: verifyingAccount.id,
        pin
      })
    }
    
    await loadData()
    setVerifyingAccount(null)
    setShowPinModal(false)
  }

  const handleVerifyOTP = async (otp: string) => {
    if (!pendingAccount) return
    
    await verifyOTP(pendingAccount.id, otp)
    await loadData()
    setPendingAccount(null)
  }

  const handleConfigureLimits = async (limits: any) => {
    if (!configuringAccount) return
    
    await updateAccountLimits(configuringAccount.id, limits)
    await loadData()
    setConfiguringAccount(null)
    setShowConfigureLimitsModal(false)
  }

  const handleAssignProxy = async (proxyId: string | null) => {
    if (!configuringAccount) return
    
    await updateAccountProxy(configuringAccount.id, proxyId)
    await loadData()
    setConfiguringAccount(null)
    setShowAssignProxyModal(false)
  }

  const handleToggleStatus = async (account: LinkedInAccount) => {
    await toggleAccountStatus(account.id, account.status)
    await loadData()
  }

  const handleDeleteAccount = async (id: string) => {
    if (confirm('Are you sure you want to delete this account?')) {
      await deleteLinkedInAccount(id)
      await loadData()
    }
  }

  const handleAddProxy = async (data: any) => {
    if (editingProxy) {
      await updateProxy(editingProxy.id, data)
    } else {
      await createProxy(data)
    }
    setEditingProxy(null)
    await loadData()
  }

  const handleTestProxy = async (id: string) => {
    await testProxy(id)
    await loadData()
  }

  const handleDeleteProxy = async (id: string) => {
    if (confirm('Are you sure you want to delete this proxy?')) {
      await deleteProxy(id)
      await loadData()
    }
  }

  const handleMonitorHealth = async (accountId?: string) => {
    setMonitoringHealth(true)
    try {
      await monitorAccountHealth(accountId)
      await loadData()
    } catch (error) {
      console.error('Health monitoring failed:', error)
    } finally {
      setMonitoringHealth(false)
    }
  }

  const handleAssignCampaigns = async (accountId: string, campaignIds: string[]) => {
    await assignCampaignsToAccount(accountId, campaignIds)
    await loadData()
    setShowCampaignModal(false)
    setSelectedAccount(null)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">LinkedIn Accounts</h1>
              <p className="text-sm text-gray-600 mt-1">Manage your LinkedIn accounts and proxies</p>
            </div>
            <ProfileDropdown userEmail={userEmail} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-blue-900">
                    The LinkedIn accounts are called <strong>senders</strong> when put in a campaign. Connect multiple LinkedIn sending accounts on one campaign to increase your daily <strong>sending volume</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowConnectModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <span>+ Connect Account</span>
                </button>

                <button
                  onClick={() => {
                    setEditingProxy(null)
                    setShowProxyModal(true)
                  }}
                  className="bg-white hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-lg border border-gray-300 transition-colors"
                >
                  + Add Proxy
                </button>

                <button
                  onClick={() => handleMonitorHealth()}
                  disabled={monitoringHealth}
                  className="bg-white hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-lg border border-gray-300 transition-colors disabled:opacity-50"
                >
                  {monitoringHealth ? 'Checking...' : '✓ Check Health'}
                </button>
              </div>

              <button
                onClick={() => setShowProxyList(!showProxyList)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                {showProxyList ? 'Hide' : 'Manage'} Proxies ({proxies.length})
              </button>
            </div>

            {showProxyList && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Proxy Configuration</h3>
                
                {proxies.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No proxies configured</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Type</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Host:Port</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proxies.map((proxy) => (
                          <tr key={proxy.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm font-medium text-gray-900">{proxy.name}</td>
                            <td className="py-3 px-4">
                              <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700 uppercase">
                                {proxy.type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">{proxy.host}:{proxy.port}</td>
                            <td className="py-3 px-4">
                              {proxy.test_status === 'success' && (
                                <span className="text-xs font-medium px-2 py-1 rounded bg-green-100 text-green-700">
                                  ✓ Working
                                </span>
                              )}
                              {proxy.test_status === 'failed' && (
                                <span className="text-xs font-medium px-2 py-1 rounded bg-red-100 text-red-700">
                                  ✗ Failed
                                </span>
                              )}
                              {proxy.test_status === 'not_tested' && (
                                <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700">
                                  Not Tested
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleTestProxy(proxy.id)}
                                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                >
                                  Test
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingProxy(proxy)
                                    setShowProxyModal(true)
                                  }}
                                  className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteProxy(proxy.id)}
                                  className="text-red-600 hover:text-red-700 text-sm font-medium"
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
                )}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Connected Accounts</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected
                    </p>
                  </div>
                  {accounts.length > 0 && (
                    <div className="flex items-center space-x-4">
                      {/* Cookie-based accounts count */}
                      <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="text-sm font-semibold text-purple-900">
                          {accounts.filter(a => a.connection_method === 'cookie').length} Cookie-Based
                        </span>
                        <span className="text-xs text-green-700 font-medium bg-green-100 px-1.5 py-0.5 rounded">99%</span>
                      </div>
                      {/* Credentials accounts count */}
                      {accounts.filter(a => a.connection_method !== 'cookie').length > 0 && (
                        <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-700">
                            {accounts.filter(a => a.connection_method !== 'cookie').length} Credentials
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {accounts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔗</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No LinkedIn accounts connected</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Connect your first LinkedIn account to start automating your outreach
                  </p>
                  <button
                    onClick={() => setShowConnectModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
                  >
                    + Connect Your First Account
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">LinkedIn Account</th>
                        <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Connection Method</th>
                        <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Proxy</th>
                        <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Status</th>
                        <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Sending limits</th>
                        <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((account) => {
                        const sendingLimits = account.sending_limits || {
                          connection_requests_per_day: 25,
                          messages_per_day: 40,
                          inmails_per_day: 40
                        }
                        
                        return (
                          <tr key={account.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-4 px-6">
                              <div className="flex items-center space-x-3">
                                {account.profile_picture_url ? (
                                  <>
                                    <Image 
                                      src={account.profile_picture_url} 
                                      alt={account.profile_name || account.email}
                                      width={48}
                                      height={48}
                                      unoptimized
                                      className="rounded-full object-cover border-2 border-blue-100"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement
                                        target.style.display = 'none'
                                        if (target.nextElementSibling) {
                                          (target.nextElementSibling as HTMLElement).style.display = 'flex'
                                        }
                                      }}
                                    />
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full items-center justify-center text-xl text-white font-bold border-2 border-blue-100 hidden">
                                      {(account.profile_name || account.email).charAt(0).toUpperCase()}
                                    </div>
                                  </>
                                ) : (
                                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-xl text-white font-bold border-2 border-blue-100">
                                    {(account.profile_name || account.email).charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {account.profile_name || account.email}
                                  </p>
                                  {account.headline && (
                                    <p className="text-xs text-gray-700 font-medium truncate mt-0.5">
                                      {account.headline}
                                    </p>
                                  )}
                                  {(account.job_title || account.company) && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                      </svg>
                                      <p className="text-xs text-gray-500 truncate">
                                        {account.job_title}
                                        {account.job_title && account.company && ' at '}
                                        {account.company && <span className="font-medium">{account.company}</span>}
                                      </p>
                                    </div>
                                  )}
                                  {account.location && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      <p className="text-xs text-gray-500 truncate">{account.location}</p>
                                    </div>
                                  )}
                                  {!account.profile_name && (
                                    <p className="text-xs text-gray-500 mt-0.5">{account.email}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            {/* Connection Method Column */}
                            <td className="py-4 px-6">
                              {account.connection_method === 'cookie' ? (
                                <div className="flex items-center space-x-2">
                                  <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span className="text-xs font-semibold text-purple-900">Cookie</span>
                                    <span className="text-xs text-green-700 font-medium bg-green-100 px-1.5 py-0.5 rounded">99%</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-gray-50 rounded-lg border border-gray-200">
                                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                  </svg>
                                  <span className="text-xs font-medium text-gray-700">Credentials</span>
                                </div>
                              )}
                            </td>
                            {/* Proxy Column */}
                            <td className="py-4 px-6">
                              {account.proxy ? (
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-900">{account.proxy.name}</span>
                                  </div>
                                  <div className="text-xs text-gray-500 ml-6">
                                    {account.proxy.type.toUpperCase()} • {account.proxy.host}:{account.proxy.port}
                                  </div>
                                  {(account.proxy as any)?.is_verified && (
                                    <span className="ml-6 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                      Verified
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                  <span className="text-sm text-gray-500">No proxy</span>
                                  <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200">Not recommended</span>
                                </div>
                              )}
                            </td>
                            {/* Status Column */}
                            <td className="py-4 px-6">
                              <div className="flex items-center space-x-2">
                                {account.status === 'connecting' && (
                                  <>
                                    <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span className="text-sm text-gray-700">Connecting</span>
                                    <button
                                      onClick={() => {
                                        setPendingAccount(account)
                                        setShowOTPModal(true)
                                      }}
                                      className="text-blue-600 hover:text-blue-700"
                                      title="Enter OTP to complete connection"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </button>
                                  </>
                                )}
                                {account.status === 'pending_verification' && (
                                  <span className="text-xs font-medium px-2 py-1 rounded border bg-orange-100 text-orange-700 border-orange-200">
                                    PENDING PIN
                                  </span>
                                )}
                                {account.status === 'active' && (
                                  <span className="text-xs font-medium px-2 py-1 rounded border bg-green-100 text-green-700 border-green-200">
                                    ACTIVE
                                  </span>
                                )}
                                {account.status === 'paused' && (
                                  <span className="text-xs font-medium px-2 py-1 rounded border bg-yellow-100 text-yellow-700 border-yellow-200">
                                    PAUSED
                                  </span>
                                )}
                                {account.status === 'error' && (
                                  <span className="text-xs font-medium px-2 py-1 rounded border bg-red-100 text-red-700 border-red-200">
                                    ERROR
                                  </span>
                                )}
                                {account.status === 'disconnected' && (
                                  <span className="text-xs font-medium px-2 py-1 rounded border bg-red-100 text-red-700 border-red-200">
                                    DISCONNECTED
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <div className="flex items-center space-x-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                  <span>{account.daily_limits?.connection_requests_per_day || 20}/day</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                  </svg>
                                  <span>{account.daily_limits?.messages_per_day || 50}/day</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  <span>{account.daily_limits?.inmails_per_day || 20}/day</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center space-x-2">
                                {account.status === 'pending_verification' && (
                                  <button
                                    onClick={() => handleVerifyPin(account)}
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                                  >
                                    Enter PIN
                                  </button>
                                )}
                                {account.status !== 'connecting' && account.status !== 'pending_verification' && account.status !== 'disconnected' && (
                                  <>
                                    <button
                                      onClick={() => handleMonitorHealth(account.id)}
                                      disabled={monitoringHealth}
                                      className="text-green-600 hover:text-green-700 text-sm font-medium disabled:opacity-50"
                                    >
                                      Check
                                    </button>
                                    <button
                                      onClick={() => handleToggleStatus(account)}
                                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                    >
                                      {account.status === 'active' ? 'Pause' : 'Activate'}
                                    </button>
                                  </>
                                )}
                                {account.status === 'disconnected' && (
                                  <button
                                    onClick={() => {
                                      setReconnectingAccount(account)
                                      setShowConnectModal(true)
                                    }}
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg shadow-sm transition-all flex items-center space-x-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span>Reconnect</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteAccount(account.id)}
                                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                                >
                                  Delete
                                </button>
                                
                                {/* 3-dot menu */}
                                <div className="relative group">
                                  <button className="p-1 hover:bg-gray-100 rounded">
                                    <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                    </svg>
                                  </button>
                                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                    <div className="py-1">
                                      <button
                                        onClick={() => {
                                          setConfiguringAccount(account)
                                          setShowAssignProxyModal(true)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                                        </svg>
                                        <span>Configure Proxy</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setConfiguringAccount(account)
                                          setShowConfigureLimitsModal(true)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                        </svg>
                                        <span>Configure Daily Limits</span>
                                      </button>
                                      <button
                                        onClick={async () => {
                                          try {
                                            const { resyncAccountProfile } = await import('@/app/actions/resync-profile')
                                            await resyncAccountProfile(account.id)
                                            alert('✅ Profile data synced successfully!')
                                            await loadData()
                                          } catch (error: any) {
                                            alert('❌ Sync failed: ' + error.message)
                                          }
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>Refresh Profile Data</span>
                                      </button>
                                      {account.status === 'active' || account.status === 'disconnected' ? (
                                        <button
                                          onClick={async () => {
                                            try {
                                              const { checkAccountConnection } = await import('@/app/actions/linkedin-accounts')
                                              const result = await checkAccountConnection(account.id)
                                              if (result.isValid) {
                                                alert('✅ Account is connected and working!')
                                              } else {
                                                alert('❌ Account is disconnected. Please reconnect.')
                                              }
                                            } catch (error: any) {
                                              alert('Error checking connection: ' + error.message)
                                            }
                                          }}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <span>Check Connection</span>
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
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
          </div>
        </main>
      </div>

      <ConnectAccountModal
        isOpen={showConnectModal}
        onClose={() => {
          setShowConnectModal(false)
          setReconnectingAccount(null)
        }}
        onSubmit={handleConnectAccount}
        proxies={proxies}
        reconnectingAccount={reconnectingAccount}
        onCreateProxy={() => {
          setShowConnectModal(false)
          setShowProxyModal(true)
        }}
      />

      <PinVerificationModal
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false)
          setVerifyingAccount(null)
        }}
        onSubmit={handlePinSubmit}
        accountEmail={verifyingAccount?.email || ''}
      />

      <AssignProxyModal
        isOpen={showAssignProxyModal}
        onClose={() => {
          setShowAssignProxyModal(false)
          setConfiguringAccount(null)
        }}
        onSubmit={handleAssignProxy}
        account={configuringAccount}
        proxies={proxies}
      />

      <ConfigureLimitsModal
        isOpen={showConfigureLimitsModal}
        onClose={() => {
          setShowConfigureLimitsModal(false)
          setConfiguringAccount(null)
        }}
        onSubmit={handleConfigureLimits}
        account={configuringAccount}
      />

      <ProxyModal
        isOpen={showProxyModal}
        onClose={() => {
          setShowProxyModal(false)
          setEditingProxy(null)
          // Reopen connect modal after proxy creation
          if (!editingProxy) {
            setShowConnectModal(true)
          }
        }}
        onSubmit={async (proxyData) => {
          await handleAddProxy(proxyData)
          // Reload proxies after creation
          const proxiesData = await getProxies()
          setProxies(proxiesData)
        }}
        editingProxy={editingProxy}
      />

      {selectedAccount && (
        <AssignCampaignsModal
          isOpen={showCampaignModal}
          onClose={() => {
            setShowCampaignModal(false)
            setSelectedAccount(null)
          }}
          accountId={selectedAccount.id}
          accountEmail={selectedAccount.email}
          currentCampaigns={selectedAccount.assigned_campaigns || []}
          availableCampaigns={campaigns}
          onAssign={handleAssignCampaigns}
        />
      )}

      {pendingAccount && (
        <OTPVerificationModal
          isOpen={showOTPModal}
          onClose={() => {
            setShowOTPModal(false)
            setPendingAccount(null)
          }}
          onVerify={handleVerifyOTP}
          accountEmail={pendingAccount.email}
        />
      )}
    </div>
  )
}
