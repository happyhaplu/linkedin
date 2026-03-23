import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  LinkedInAccount,
  Proxy,
  Campaign,
  CreateAccountWithCookieRequest,
  ReconnectAccountRequest,
  UpdateLimitsRequest,
  UpdateProxyRequest,
  AssignCampaignsRequest,
  VerifyOTPRequest,
} from '@/types'
import { accountApi } from '@/api/accounts'
import { proxyApi } from '@/api/proxies'
import { campaignApi } from '@/api/campaigns'

export const useAccountStore = defineStore('accounts', () => {
  // ── State ──────────────────────────────────────────
  const accounts = ref<LinkedInAccount[]>([])
  const proxies = ref<Proxy[]>([])
  const campaigns = ref<Campaign[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ────────────────────────────────────────
  const activeAccounts = computed(() =>
    accounts.value.filter((a) => a.status === 'active')
  )
  const connectedCount = computed(() =>
    accounts.value.filter((a) => a.status === 'active').length
  )
  const totalCount = computed(() => accounts.value.length)

  // ── Helpers ────────────────────────────────────────
  function setError(msg: string) {
    error.value = msg
    setTimeout(() => {
      error.value = null
    }, 5000)
  }

  // ── Actions ────────────────────────────────────────

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const [accs, prx, camps] = await Promise.all([
        accountApi.list(),
        proxyApi.list(),
        campaignApi.list().catch(() => [] as Campaign[]),
      ])
      accounts.value = accs ?? []
      proxies.value = prx ?? []
      campaigns.value = camps ?? []
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      loading.value = false
    }
  }

  async function createAccountWithCookie(data: CreateAccountWithCookieRequest) {
    loading.value = true
    try {
      const account = await accountApi.createWithCookie(data)
      accounts.value.push(account)
      return account
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create account')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function reconnectAccount(id: string, data: ReconnectAccountRequest) {
    try {
      const updated = await accountApi.reconnect(id, data)
      const idx = accounts.value.findIndex((a) => a.id === id)
      if (idx !== -1) accounts.value[idx] = updated
      return updated
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reconnect account')
      throw e
    }
  }

  async function toggleAccountStatus(id: string) {
    try {
      const updated = await accountApi.toggleStatus(id)
      const idx = accounts.value.findIndex((a) => a.id === id)
      if (idx !== -1) accounts.value[idx] = updated
      return updated
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to toggle status')
      throw e
    }
  }

  async function deleteAccount(id: string) {
    try {
      await accountApi.delete(id)
      accounts.value = accounts.value.filter((a) => a.id !== id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete account')
      throw e
    }
  }

  async function updateLimits(id: string, data: UpdateLimitsRequest) {
    try {
      const updated = await accountApi.updateLimits(id, data)
      const idx = accounts.value.findIndex((a) => a.id === id)
      if (idx !== -1) accounts.value[idx] = updated
      return updated
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update limits')
      throw e
    }
  }

  async function updateProxy(id: string, data: UpdateProxyRequest) {
    try {
      const updated = await accountApi.updateProxy(id, data)
      const idx = accounts.value.findIndex((a) => a.id === id)
      if (idx !== -1) accounts.value[idx] = updated
      return updated
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update proxy')
      throw e
    }
  }

  async function assignCampaigns(id: string, data: AssignCampaignsRequest) {
    try {
      const updated = await accountApi.assignCampaigns(id, data)
      const idx = accounts.value.findIndex((a) => a.id === id)
      if (idx !== -1) accounts.value[idx] = updated
      return updated
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to assign campaigns')
      throw e
    }
  }

  async function verifyOTP(id: string, data: VerifyOTPRequest) {
    try {
      const updated = await accountApi.verifyOTP(id, data)
      const idx = accounts.value.findIndex((a) => a.id === id)
      if (idx !== -1) accounts.value[idx] = updated
      return updated
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to verify OTP')
      throw e
    }
  }

  async function checkConnection(id: string) {
    try {
      const result = await accountApi.checkConnection(id)
      // Refresh data after check
      await fetchAll()
      return result
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Failed to check connection'
      )
      throw e
    }
  }

  async function monitorHealth() {
    try {
      const result = await accountApi.monitorHealth()
      return result
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Failed to monitor health'
      )
      throw e
    }
  }

  async function updateProfile(id: string) {
    try {
      const updated = await accountApi.updateProfile(id, {})
      const idx = accounts.value.findIndex((a) => a.id === id)
      if (idx !== -1) accounts.value[idx] = updated
      return updated
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Failed to refresh profile'
      )
      throw e
    }
  }

  // ── Proxy Actions ──────────────────────────────────

  async function createProxy(data: Parameters<typeof proxyApi.create>[0]) {
    try {
      const proxy = await proxyApi.create(data)
      proxies.value.push(proxy)
      return proxy
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create proxy')
      throw e
    }
  }

  async function updateProxyRecord(
    id: string,
    data: Parameters<typeof proxyApi.update>[1]
  ) {
    try {
      const updated = await proxyApi.update(id, data)
      const idx = proxies.value.findIndex((p) => p.id === id)
      if (idx !== -1) proxies.value[idx] = updated
      return updated
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update proxy')
      throw e
    }
  }

  async function deleteProxy(id: string) {
    try {
      await proxyApi.delete(id)
      proxies.value = proxies.value.filter((p) => p.id !== id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete proxy')
      throw e
    }
  }

  async function testProxy(id: string) {
    try {
      const result = await proxyApi.test(id)
      return result
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to test proxy')
      throw e
    }
  }

  return {
    // State
    accounts,
    proxies,
    campaigns,
    loading,
    error,
    // Getters
    activeAccounts,
    connectedCount,
    totalCount,
    // Actions
    fetchAll,
    createAccountWithCookie,
    reconnectAccount,
    toggleAccountStatus,
    deleteAccount,
    updateLimits,
    updateProxy,
    assignCampaigns,
    verifyOTP,
    checkConnection,
    monitorHealth,
    updateProfile,
    createProxy,
    updateProxyRecord,
    deleteProxy,
    testProxy,
  }
})
