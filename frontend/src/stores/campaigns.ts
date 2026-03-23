import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { campaignApi } from '@/api/campaigns'
import type {
  Campaign,
  CampaignAnalytics,
  CampaignTemplate,
  CampaignLead,
  CampaignActivityLog,
  CampaignWebhook,
  CreateCampaignInput,
  UpdateCampaignInput,
  CreateWebhookInput,
} from '@/types/campaign'
import type { LinkedInAccount } from '@/types'
import { accountApi } from '@/api/accounts'

export const useCampaignStore = defineStore('campaigns', () => {
  // ── State ──────────────────────────────────────────
  const campaigns = ref<Campaign[]>([])
  const currentCampaign = ref<Campaign | null>(null)
  const templates = ref<CampaignTemplate[]>([])
  const analyticsData = ref<CampaignAnalytics | null>(null)
  const leads = ref<CampaignLead[]>([])
  const activityLog = ref<CampaignActivityLog[]>([])
  const webhooks = ref<CampaignWebhook[]>([])
  const linkedInAccounts = ref<LinkedInAccount[]>([])
  const availableLists = ref<{ id: string; name: string; lead_count?: number; leads_count?: number }[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ────────────────────────────────────────
  const activeCampaigns = computed(() => campaigns.value.filter((c) => c.status === 'active'))
  const draftCampaigns = computed(() => campaigns.value.filter((c) => c.status === 'draft'))
  const pausedCampaigns = computed(() => campaigns.value.filter((c) => c.status === 'paused'))
  const stats = computed(() => ({
    total: campaigns.value.length,
    active: activeCampaigns.value.length,
    paused: pausedCampaigns.value.length,
    draft: draftCampaigns.value.length,
    totalLeadsContacted: campaigns.value.reduce((sum, c) => sum + (c.connection_sent || 0), 0),
    totalAccepted: campaigns.value.reduce((sum, c) => sum + (c.connection_accepted || 0), 0),
    totalReplies: campaigns.value.reduce((sum, c) => sum + (c.replies_received || 0), 0),
  }))

  // ── Helpers ────────────────────────────────────────
  function setError(msg: string) {
    error.value = msg
    setTimeout(() => {
      error.value = null
    }, 5000)
  }

  // ── Actions: Campaign CRUD ─────────────────────────

  async function fetchCampaigns(params?: { status?: string; search?: string }) {
    loading.value = true
    error.value = null
    try {
      campaigns.value = (await campaignApi.list(params)) ?? []
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      loading.value = false
    }
  }

  async function fetchCampaignById(id: string) {
    loading.value = true
    error.value = null
    try {
      currentCampaign.value = await campaignApi.getById(id)
    } catch (e: unknown) {
      setError((e as Error).message)
      currentCampaign.value = null
    } finally {
      loading.value = false
    }
  }

  async function createCampaign(input: CreateCampaignInput): Promise<Campaign | null> {
    loading.value = true
    error.value = null
    try {
      const campaign = await campaignApi.create(input)
      campaigns.value.unshift(campaign)
      return campaign
    } catch (e: unknown) {
      setError((e as Error).message)
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateCampaign(id: string, input: UpdateCampaignInput) {
    try {
      const updated = await campaignApi.update(id, input)
      const idx = campaigns.value.findIndex((c) => c.id === id)
      if (idx !== -1) campaigns.value[idx] = updated
      if (currentCampaign.value?.id === id) currentCampaign.value = updated
    } catch (e: unknown) {
      setError((e as Error).message)
      throw e
    }
  }

  async function deleteCampaign(id: string) {
    try {
      await campaignApi.delete(id)
      campaigns.value = campaigns.value.filter((c) => c.id !== id)
      if (currentCampaign.value?.id === id) currentCampaign.value = null
    } catch (e: unknown) {
      setError((e as Error).message)
      throw e
    }
  }

  // ── Actions: Lifecycle ─────────────────────────────

  async function startCampaign(id: string, immediately = true) {
    try {
      await campaignApi.start(id, immediately)
      await fetchCampaignById(id)
    } catch (e: unknown) {
      setError((e as Error).message)
      throw e
    }
  }

  async function pauseCampaign(id: string) {
    try {
      await campaignApi.pause(id)
      await fetchCampaignById(id)
    } catch (e: unknown) {
      setError((e as Error).message)
      throw e
    }
  }

  async function resumeCampaign(id: string) {
    try {
      await campaignApi.resume(id)
      await fetchCampaignById(id)
    } catch (e: unknown) {
      setError((e as Error).message)
      throw e
    }
  }

  async function stopCampaign(id: string) {
    try {
      await campaignApi.stop(id)
      await fetchCampaignById(id)
    } catch (e: unknown) {
      setError((e as Error).message)
      throw e
    }
  }

  // ── Actions: Analytics ─────────────────────────────

  async function fetchAnalytics(campaignId: string) {
    try {
      analyticsData.value = await campaignApi.getAnalytics(campaignId)
    } catch (e: unknown) {
      console.error('Analytics load failed:', e)
    }
  }

  // ── Actions: Leads ─────────────────────────────────

  async function fetchLeads(campaignId: string) {
    try {
      leads.value = await campaignApi.getLeads(campaignId)
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  async function addLeadsFromList(campaignId: string, listId: string): Promise<number> {
    try {
      const result = await campaignApi.addLeadsFromList(campaignId, listId)
      return result.added
    } catch (e: unknown) {
      setError((e as Error).message)
      throw e
    }
  }

  async function removeLeads(campaignId: string, campaignLeadIds: string[]) {
    try {
      await campaignApi.removeLeads(campaignId, campaignLeadIds)
    } catch (e: unknown) {
      setError((e as Error).message)
      throw e
    }
  }

  // ── Actions: Activity ──────────────────────────────

  async function fetchActivityLog(campaignId: string, limit = 200) {
    try {
      activityLog.value = await campaignApi.getActivityLog(campaignId, limit)
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  // ── Actions: Webhooks ──────────────────────────────

  async function fetchWebhooks(campaignId: string) {
    try {
      webhooks.value = await campaignApi.getWebhooks(campaignId)
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  async function createWebhook(campaignId: string, input: CreateWebhookInput) {
    try {
      const wh = await campaignApi.createWebhook(campaignId, input)
      webhooks.value.unshift(wh)
      return wh
    } catch (e: unknown) {
      setError((e as Error).message)
      throw e
    }
  }

  async function deleteWebhook(campaignId: string, webhookId: string) {
    try {
      await campaignApi.deleteWebhook(campaignId, webhookId)
      webhooks.value = webhooks.value.filter((w) => w.id !== webhookId)
    } catch (e: unknown) {
      setError((e as Error).message)
      throw e
    }
  }

  // ── Actions: Senders ───────────────────────────────

  async function addSender(campaignId: string, linkedinAccountId: string) {
    try {
      await campaignApi.addSender(campaignId, linkedinAccountId)
      await fetchCampaignById(campaignId)
    } catch (e: unknown) {
      setError((e as Error).message)
      throw e
    }
  }

  async function removeSender(campaignId: string, senderId: string) {
    try {
      await campaignApi.removeSender(campaignId, senderId)
      await fetchCampaignById(campaignId)
    } catch (e: unknown) {
      setError((e as Error).message)
      throw e
    }
  }

  // ── Actions: Templates ─────────────────────────────

  async function fetchTemplates() {
    try {
      templates.value = await campaignApi.getTemplates()
    } catch (e: unknown) {
      console.error('Failed to load templates:', e)
    }
  }

  // ── Actions: A/B Testing ───────────────────────────

  async function declareABWinner(campaignId: string, seqId: string, winner: 'A' | 'B') {
    try {
      await campaignApi.declareABWinner(campaignId, seqId, winner)
      await fetchCampaignById(campaignId)
    } catch (e: unknown) {
      setError((e as Error).message)
      throw e
    }
  }

  // ── Actions: Duplicate ─────────────────────────────

  async function duplicateCampaign(campaignId: string): Promise<Campaign | null> {
    try {
      const copy = await campaignApi.duplicate(campaignId)
      campaigns.value.unshift(copy)
      return copy
    } catch (e: unknown) {
      setError((e as Error).message)
      return null
    }
  }

  // ── Actions: Load supporting data ──────────────────

  async function fetchLinkedInAccounts() {
    try {
      linkedInAccounts.value = await accountApi.list()
    } catch (e: unknown) {
      console.error('Failed to load LinkedIn accounts:', e)
    }
  }

  async function fetchLists() {
    try {
      const response = await import('@/api/client').then((m) =>
        m.default.get('/leads/lists').then((r: { data: typeof availableLists.value }) => r.data),
      )
      availableLists.value = response ?? []
    } catch (e: unknown) {
      console.error('Failed to load lists:', e)
    }
  }

  return {
    // State
    campaigns,
    currentCampaign,
    templates,
    analyticsData,
    leads,
    activityLog,
    webhooks,
    linkedInAccounts,
    availableLists,
    loading,
    error,

    // Getters
    activeCampaigns,
    draftCampaigns,
    pausedCampaigns,
    stats,

    // Actions
    fetchCampaigns,
    fetchCampaignById,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    stopCampaign,
    fetchAnalytics,
    fetchLeads,
    addLeadsFromList,
    removeLeads,
    fetchActivityLog,
    fetchWebhooks,
    createWebhook,
    deleteWebhook,
    addSender,
    removeSender,
    fetchTemplates,
    declareABWinner,
    duplicateCampaign,
    fetchLinkedInAccounts,
    fetchLists,
  }
})
