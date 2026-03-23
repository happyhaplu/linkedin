<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCampaignStore } from '@/stores/campaigns'
import { campaignApi } from '@/api/campaigns'
import type { CampaignSequence } from '@/types/campaign'

type TabType = 'analytics' | 'sequence' | 'leads' | 'activity' | 'settings'

const route = useRoute()
const router = useRouter()
const store = useCampaignStore()

const campaignId = computed(() => route.params.id as string)
const activeTab = ref<TabType>('analytics')
const sequences = ref<CampaignSequence[]>([])
const selectedLeads = ref<Set<string>>(new Set())
const leadSearch = ref('')
const leadStatusFilter = ref('all')
const showAddLeadsModal = ref(false)
const addLeadsListId = ref('')
const addLeadsLoading = ref(false)
const showLaunchMenu = ref(false)
const launching = ref(false)
const selectedSenderAccountId = ref('')
const addingSender = ref(false)
const newWebhookUrl = ref('')
const newWebhookDesc = ref('')
const addingWebhook = ref(false)
interface SettingsFormData {
  name: string
  description: string
  daily_limit: number
  timezone: string
  working_hours_start: string
  working_hours_end: string
  working_days: string[]
  delay_min_seconds: number
  delay_max_seconds: number
  warm_up_enabled: boolean
  warm_up_days: number
  auto_pause_below_acceptance: number
  skip_already_contacted: boolean
  stop_on_reply: boolean
}

const settingsSaving = ref(false)
const settingsForm = ref<SettingsFormData | null>(null)

const tabs: { id: TabType; label: string; emoji: string }[] = [
  { id: 'analytics', label: 'Analytics', emoji: '📊' },
  { id: 'sequence', label: 'Sequence', emoji: '⚡' },
  { id: 'leads', label: 'Leads', emoji: '👥' },
  { id: 'activity', label: 'Activity', emoji: '📋' },
  { id: 'settings', label: 'Settings', emoji: '⚙️' },
]

let analyticsInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  loadCampaignData()
  store.fetchLinkedInAccounts()
})

onUnmounted(() => {
  if (analyticsInterval) clearInterval(analyticsInterval)
})

watch([campaignId, activeTab], () => {
  loadCampaignData()
})

watch(activeTab, (tab) => {
  if (analyticsInterval) {
    clearInterval(analyticsInterval)
    analyticsInterval = null
  }
  if (tab === 'analytics') {
    analyticsInterval = setInterval(() => {
      store.fetchAnalytics(campaignId.value)
    }, 30000)
  }
})

async function loadCampaignData() {
  await store.fetchCampaignById(campaignId.value)
  const c = store.currentCampaign
  if (c && !settingsForm.value) {
    settingsForm.value = {
      name: c.name,
      description: c.description || '',
      daily_limit: c.daily_limit,
      timezone: c.timezone || 'UTC',
      working_hours_start: c.working_hours_start ?? '09:00',
      working_hours_end: c.working_hours_end ?? '18:00',
      working_days: c.working_days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      delay_min_seconds: c.delay_min_seconds ?? 30,
      delay_max_seconds: c.delay_max_seconds ?? 120,
      warm_up_enabled: c.warm_up_enabled ?? false,
      warm_up_days: c.warm_up_days ?? 14,
      auto_pause_below_acceptance: c.auto_pause_below_acceptance ?? 10,
      skip_already_contacted: c.skip_already_contacted ?? true,
      stop_on_reply: c.stop_on_reply ?? true,
    }
  }

  if (activeTab.value === 'analytics') {
    await store.fetchAnalytics(campaignId.value)
    sequences.value = (c as any)?.sequences || []
  } else if (activeTab.value === 'sequence') {
    sequences.value = (c as any)?.sequences || []
  } else if (activeTab.value === 'leads') {
    await store.fetchLeads(campaignId.value)
  } else if (activeTab.value === 'activity') {
    await store.fetchActivityLog(campaignId.value, 200)
  } else if (activeTab.value === 'settings') {
    await store.fetchWebhooks(campaignId.value)
  }
}

const campaign = computed(() => store.currentCampaign)

function getStatusConfig(status: string) {
  const configs: Record<string, { label: string; bg: string; text: string; border: string }> = {
    draft: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
    active: { label: 'Active', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    paused: { label: 'Paused', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    completed: { label: 'Completed', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  }
  return configs[status] || configs.draft
}

const sc = computed(() => campaign.value ? getStatusConfig(campaign.value.status) : getStatusConfig('draft'))

const filteredLeads = computed(() => {
  return store.leads.filter((l) => {
    const name = l.lead?.full_name || `${l.lead?.first_name || ''} ${l.lead?.last_name || ''}`.trim()
    const matchSearch = !leadSearch.value || name.toLowerCase().includes(leadSearch.value.toLowerCase())
    const matchStatus = leadStatusFilter.value === 'all' || l.status === leadStatusFilter.value
    return matchSearch && matchStatus
  })
})

function handleExportLeads() {
  window.open(campaignApi.getExportUrl(campaignId.value), '_blank')
}

async function handleRemoveLeads() {
  if (!confirm(`Remove ${selectedLeads.value.size} leads from campaign?`)) return
  try {
    await store.removeLeads(campaignId.value, Array.from(selectedLeads.value))
    selectedLeads.value = new Set()
    await loadCampaignData()
  } catch {
    alert('Failed to remove leads')
  }
}

async function handleAddLeadsFromList() {
  if (!addLeadsListId.value) return
  try {
    addLeadsLoading.value = true
    const added = await store.addLeadsFromList(campaignId.value, addLeadsListId.value)
    showAddLeadsModal.value = false
    addLeadsListId.value = ''
    await loadCampaignData()
    if (added === 0) {
      alert('No new leads to add — all leads from this list are already in the campaign.')
    } else {
      alert(`✅ Added ${added} lead${added === 1 ? '' : 's'} to the campaign.`)
    }
  } catch (e: unknown) {
    alert('Failed to add leads: ' + ((e as Error).message || 'Unknown error'))
  } finally {
    addLeadsLoading.value = false
  }
}

async function handleDeclareWinner(seqId: string, winner: 'A' | 'B') {
  try {
    await store.declareABWinner(campaignId.value, seqId, winner)
    await loadCampaignData()
  } catch {
    alert('Failed to declare winner')
  }
}

async function handleLaunch(immediately: boolean) {
  showLaunchMenu.value = false
  launching.value = true
  try {
    await store.startCampaign(campaignId.value, immediately)
    await loadCampaignData()
  } catch {
    alert('Failed to launch campaign')
  } finally {
    launching.value = false
  }
}

async function handlePause() {
  try {
    await store.pauseCampaign(campaignId.value)
    await loadCampaignData()
  } catch {
    alert('Failed to pause campaign')
  }
}

async function handleSaveSettings() {
  if (!settingsForm.value) return
  settingsSaving.value = true
  try {
    await store.updateCampaign(campaignId.value, {
      name: settingsForm.value.name,
      description: settingsForm.value.description,
      daily_limit: settingsForm.value.daily_limit,
      timezone: settingsForm.value.timezone,
      working_hours_start: settingsForm.value.working_hours_start,
      working_hours_end: settingsForm.value.working_hours_end,
      working_days: settingsForm.value.working_days,
      delay_min_seconds: settingsForm.value.delay_min_seconds,
      delay_max_seconds: settingsForm.value.delay_max_seconds,
      warm_up_enabled: settingsForm.value.warm_up_enabled,
      warm_up_days: settingsForm.value.warm_up_days,
      auto_pause_below_acceptance: settingsForm.value.auto_pause_below_acceptance / 100,
      skip_already_contacted: settingsForm.value.skip_already_contacted,
      stop_on_reply: settingsForm.value.stop_on_reply,
    })
    await loadCampaignData()
    alert('Settings saved!')
  } catch {
    alert('Failed to save settings')
  } finally {
    settingsSaving.value = false
  }
}

async function handleDelete() {
  if (!confirm('Delete this campaign? This action cannot be undone.')) return
  try {
    await store.deleteCampaign(campaignId.value)
    router.push('/campaigns')
  } catch {
    alert('Failed to delete campaign')
  }
}

async function handleAddWebhook() {
  if (!newWebhookUrl.value.trim()) return
  try {
    addingWebhook.value = true
    await store.createWebhook(campaignId.value, {
      url: newWebhookUrl.value.trim(),
      description: newWebhookDesc.value.trim() || undefined,
    })
    newWebhookUrl.value = ''
    newWebhookDesc.value = ''
  } catch {
    alert('Failed to add webhook')
  } finally {
    addingWebhook.value = false
  }
}

async function handleDeleteWebhook(webhookId: string) {
  if (!confirm('Delete this webhook?')) return
  try {
    await store.deleteWebhook(campaignId.value, webhookId)
  } catch {
    alert('Failed to delete webhook')
  }
}

async function handleAddSender(accountId: string) {
  if (!accountId) return
  try {
    addingSender.value = true
    await store.addSender(campaignId.value, accountId)
    selectedSenderAccountId.value = ''
  } catch (e: unknown) {
    alert((e as Error).message || 'Failed to add sender')
  } finally {
    addingSender.value = false
  }
}

async function handleRemoveSender(senderId: string) {
  if (!confirm('Remove this sender from the campaign?')) return
  try {
    await store.removeSender(campaignId.value, senderId)
  } catch (e: unknown) {
    alert((e as Error).message || 'Failed to remove sender')
  }
}

function toggleLeadSelection(leadId: string) {
  const s = new Set(selectedLeads.value)
  if (s.has(leadId)) s.delete(leadId)
  else s.add(leadId)
  selectedLeads.value = s
}

function toggleAllLeads(checked: boolean) {
  selectedLeads.value = checked ? new Set(filteredLeads.value.map((l) => l.id)) : new Set()
}

function openAddLeadsModal() {
  showAddLeadsModal.value = true
  if (store.availableLists.length === 0) store.fetchLists()
}

const availableLinkedInAccounts = computed(() => {
  const assignedIds = new Set((campaign.value?.senders || []).map((s) => s.linkedin_account_id))
  return store.linkedInAccounts.filter((a) => a.status === 'active' && !assignedIds.has(a.id))
})

const activityTypeEmoji: Record<string, string> = {
  connection_request: '🤝',
  message: '💬',
  message_sent: '💬',
  inmail: '📨',
  inmail_sent: '📨',
  view_profile: '👁️',
  profile_view: '👁️',
  follow: '➕',
  delay: '⏱️',
  like_post: '❤️',
  reply_received: '📩',
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Not Found -->
    <div v-if="!campaign && !store.loading" class="flex h-full items-center justify-center">
      <div class="text-center">
        <h2 class="text-2xl font-bold text-gray-900">Campaign not found</h2>
        <button class="mt-4 text-blue-600 hover:text-blue-700" @click="router.push('/campaigns')">Back to Campaigns</button>
      </div>
    </div>

    <template v-else>
      <!-- Header -->
      <header class="bg-white border-b border-gray-200 px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button class="text-gray-400 hover:text-gray-600" @click="router.push('/campaigns')">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div class="flex items-center gap-3">
                <h1 class="text-xl font-bold text-gray-900">{{ campaign?.name || 'Loading...' }}</h1>
                <span
                  v-if="campaign"
                  class="px-2.5 py-1 rounded-full text-xs font-semibold border"
                  :class="[sc.bg, sc.text, sc.border]"
                >
                  {{ sc.label }}
                </span>
              </div>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ campaign?.total_leads || 0 }} leads · {{ campaign?.connection_sent || 0 }} sent ·
                {{ campaign?.connection_accepted || 0 }} accepted · {{ campaign?.replies_received || 0 }} replies
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <!-- Launch/Resume Button -->
            <div v-if="campaign?.status === 'draft' || campaign?.status === 'paused'" class="relative">
              <div class="flex rounded-lg overflow-hidden shadow-sm">
                <button
                  :disabled="launching"
                  class="px-4 py-2 bg-green-600 text-white hover:bg-green-700 text-sm font-medium flex items-center gap-2 disabled:opacity-60"
                  @click="handleLaunch(true)"
                >
                  <span v-if="launching" class="animate-spin">⏳</span>
                  <span v-else>{{ campaign?.status === 'paused' ? '▶' : '🚀' }}</span>
                  {{ campaign?.status === 'paused' ? 'Resume' : 'Launch Now' }}
                </button>
                <button
                  :disabled="launching"
                  class="px-2 py-2 bg-green-700 text-white hover:bg-green-800 border-l border-green-500 disabled:opacity-60"
                  title="Launch options"
                  @click="showLaunchMenu = !showLaunchMenu"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div v-if="showLaunchMenu" class="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div class="py-1">
                  <button class="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm" @click="handleLaunch(true)">
                    <div class="font-medium text-gray-900">⚡ Launch now</div>
                    <div class="text-xs text-gray-500 mt-0.5">Start processing leads right away</div>
                  </button>
                  <div class="border-t border-gray-100" />
                  <button class="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm" @click="handleLaunch(false)">
                    <div class="font-medium text-gray-900">🕘 Schedule for working hours</div>
                    <div class="text-xs text-gray-500 mt-0.5">First step waits until configured working hours</div>
                  </button>
                </div>
              </div>
            </div>
            <!-- Pause button -->
            <button
              v-if="campaign?.status === 'active'"
              class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium"
              @click="handlePause"
            >
              ⏸ Pause
            </button>
          </div>
        </div>
      </header>

      <!-- Tab Bar -->
      <div class="bg-white border-b border-gray-200">
        <nav class="flex px-6 -mb-px space-x-1">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors"
            :class="activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'"
            @click="activeTab = tab.id"
          >
            <span>{{ tab.emoji }}</span>
            <span>{{ tab.label }}</span>
          </button>
        </nav>
      </div>

      <!-- Main content -->
      <main class="flex-1 overflow-auto">
        <div class="max-w-7xl mx-auto p-6 space-y-6">
          <!-- Loading -->
          <div v-if="store.loading" class="flex items-center justify-center py-20">
            <div class="text-center">
              <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
              <p class="text-gray-500 mt-3">Loading...</p>
            </div>
          </div>

          <template v-else>
            <!-- No Senders Warning -->
            <div
              v-if="campaign && (!campaign.senders || campaign.senders.length === 0) && (campaign.status === 'draft' || campaign.status === 'paused')"
              class="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3"
            >
              <span class="text-xl mt-0.5">⚠️</span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-amber-800">No LinkedIn accounts assigned</p>
                <p class="text-xs text-amber-600 mt-0.5">This campaign needs at least one LinkedIn sender account to run.</p>
              </div>
              <button class="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 whitespace-nowrap" @click="activeTab = 'settings'">
                Manage Senders
              </button>
            </div>

            <!-- ═══ ANALYTICS TAB ═══ -->
            <template v-if="activeTab === 'analytics'">
              <!-- Conversion Funnel -->
              <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 class="text-base font-semibold text-gray-900 mb-5">Conversion Funnel</h2>
                <div v-if="store.analyticsData && (store.analyticsData.funnel.sent > 0 || store.analyticsData.funnel.accepted > 0)" class="grid grid-cols-4 gap-4">
                  <div v-for="(item, idx) in [
                    { label: 'Sent', value: store.analyticsData.funnel.sent, pct: store.analyticsData.funnel.sent_pct, color: 'blue' },
                    { label: 'Accepted', value: store.analyticsData.funnel.accepted, pct: store.analyticsData.funnel.accepted_pct, color: 'green' },
                    { label: 'Messaged', value: store.analyticsData.funnel.messaged, pct: store.analyticsData.funnel.messaged_pct, color: 'purple' },
                    { label: 'Replied', value: store.analyticsData.funnel.replied, pct: store.analyticsData.funnel.replied_pct, color: 'amber' },
                  ]" :key="idx" class="text-center">
                    <div class="text-3xl font-bold" :class="`text-${item.color}-600`">{{ item.value }}</div>
                    <div class="text-sm text-gray-500 mt-1">{{ item.label }}</div>
                    <div class="text-xs text-gray-400">{{ item.pct }}%</div>
                    <div class="mt-2 h-2 bg-gray-100 rounded-full">
                      <div class="h-full rounded-full" :class="`bg-${item.color}-500`" :style="{ width: `${Math.min(100, item.pct)}%` }" />
                    </div>
                  </div>
                </div>
                <div v-else class="text-center py-8 text-gray-400">
                  <p class="text-lg mb-1">No activity yet</p>
                  <p class="text-sm">Analytics will appear here once the campaign starts sending</p>
                </div>
              </div>

              <!-- Today's Activity -->
              <div
                v-if="store.analyticsData?.today && (store.analyticsData.today.connections_sent > 0 || store.analyticsData.today.messages_sent > 0)"
                class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
              >
                <h2 class="text-base font-semibold text-gray-900 mb-4">Today's Activity</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div v-for="stat in [
                    { label: 'Connections Sent', value: store.analyticsData.today.connections_sent, max: store.analyticsData.today.daily_limit, color: 'bg-blue-500' },
                    { label: 'Accepted', value: store.analyticsData.today.connections_accepted ?? 0, max: store.analyticsData.today.connections_sent, color: 'bg-green-500' },
                    { label: 'Messages Sent', value: store.analyticsData.today.messages_sent, max: store.analyticsData.today.daily_limit, color: 'bg-purple-500' },
                    { label: 'Replies', value: store.analyticsData.today.replies_received, max: store.analyticsData.today.messages_sent, color: 'bg-amber-500' },
                  ]" :key="stat.label" class="space-y-2">
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-gray-500">{{ stat.label }}</span>
                      <span class="font-semibold text-gray-900">{{ stat.value }}</span>
                    </div>
                    <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div :class="stat.color" class="h-full rounded-full transition-all" :style="{ width: `${stat.max > 0 ? Math.min(100, Math.round((stat.value / stat.max) * 100)) : 0}%` }" />
                    </div>
                    <p class="text-xs text-gray-400">{{ stat.max > 0 ? Math.round((stat.value / stat.max) * 100) : 0 }}% of {{ stat.max }}</p>
                  </div>
                </div>
              </div>

              <!-- 7-Day Trend -->
              <div v-if="store.analyticsData?.trend && store.analyticsData.trend.length > 0" class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 class="text-base font-semibold text-gray-900 mb-5">7-Day Trend</h2>
                <div class="grid grid-cols-7 gap-2">
                  <div v-for="day in store.analyticsData.trend" :key="day.date" class="text-center">
                    <div class="text-xs text-gray-500 mb-1">{{ day.date.slice(5) }}</div>
                    <div class="text-sm font-semibold text-blue-600">{{ day.connections }}</div>
                    <div class="text-xs text-gray-400">{{ day.replies }} replies</div>
                  </div>
                </div>
              </div>

              <!-- Step Performance Table -->
              <div v-if="store.analyticsData?.per_step && store.analyticsData.per_step.length > 0" class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-100">
                  <h2 class="text-base font-semibold text-gray-900">Step Performance</h2>
                </div>
                <table class="min-w-full divide-y divide-gray-100">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Executed</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Success</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="s in store.analyticsData.per_step" :key="s.step_number" class="hover:bg-gray-50">
                      <td class="px-6 py-3 text-sm text-gray-900">Step {{ s.step_number }} · {{ s.step_type }}</td>
                      <td class="px-6 py-3 text-sm text-gray-600">{{ s.sent }}</td>
                      <td class="px-6 py-3 text-sm text-gray-600">{{ s.converted }}</td>
                      <td class="px-6 py-3 text-sm font-medium text-green-600">{{ s.sent > 0 ? Math.round((s.converted / s.sent) * 100) : 0 }}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- A/B Test Results -->
              <div v-if="store.analyticsData?.ab_results && store.analyticsData.ab_results.length > 0" class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 class="text-base font-semibold text-gray-900 mb-4">A/B Test Results</h2>
                <div class="space-y-4">
                  <div v-for="ab in store.analyticsData.ab_results" :key="ab.step_id" class="border border-gray-200 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-3">
                      <span class="text-sm font-medium text-gray-700">Step {{ ab.step_id }}</span>
                      <span v-if="ab.winner" class="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Winner: Variant {{ ab.winner.toUpperCase() }}</span>
                      <div v-else class="flex gap-2">
                        <button class="px-3 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100" @click="handleDeclareWinner(ab.step_id, 'A')">Declare A Winner</button>
                        <button class="px-3 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100" @click="handleDeclareWinner(ab.step_id, 'B')">Declare B Winner</button>
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                      <div class="p-3 bg-blue-50 rounded-lg">
                        <p class="text-xs text-blue-600 font-semibold mb-1">Variant A</p>
                        <p class="text-lg font-bold text-blue-800">{{ ab.variant_a_rate ?? 0 }}%</p>
                        <p class="text-xs text-blue-500">reply rate · {{ ab.variant_a_replied || 0 }} replied</p>
                      </div>
                      <div class="p-3 bg-purple-50 rounded-lg">
                        <p class="text-xs text-purple-600 font-semibold mb-1">Variant B</p>
                        <p class="text-lg font-bold text-purple-800">{{ ab.variant_b_rate ?? 0 }}%</p>
                        <p class="text-xs text-purple-500">reply rate · {{ ab.variant_b_replied || 0 }} replied</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Sender Performance Table -->
              <div v-if="store.analyticsData?.per_sender && store.analyticsData.per_sender.length > 0" class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-100">
                  <h2 class="text-base font-semibold text-gray-900">Sender Performance</h2>
                </div>
                <table class="min-w-full divide-y divide-gray-100">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accepted</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Replies</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accept %</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="s in store.analyticsData.per_sender" :key="s.account_id" class="hover:bg-gray-50">
                      <td class="px-6 py-3 text-sm text-gray-900">{{ s.profile_name || s.account_id }}</td>
                      <td class="px-6 py-3 text-sm text-gray-600">{{ s.connections_sent }}</td>
                      <td class="px-6 py-3 text-sm text-gray-600">{{ s.accepted }}</td>
                      <td class="px-6 py-3 text-sm text-gray-600">{{ s.replied }}</td>
                      <td class="px-6 py-3 text-sm font-medium">
                        <span :class="s.connections_sent > 0 && Math.round((s.accepted / s.connections_sent) * 100) >= 30 ? 'text-green-600' : 'text-red-500'">
                          {{ s.connections_sent > 0 ? Math.round((s.accepted / s.connections_sent) * 100) : 0 }}%
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Benchmarks -->
              <div v-if="store.analyticsData && store.analyticsData.funnel.sent > 0" class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 class="text-base font-semibold text-gray-900 mb-4">📈 vs Industry Benchmarks</h2>
                <div class="grid grid-cols-2 gap-4">
                  <div
                    v-for="b in [
                      { label: 'Acceptance Rate', yours: store.analyticsData.funnel.accepted_pct, avg: 30, avgLabel: '30% industry avg' },
                      { label: 'Reply Rate', yours: store.analyticsData.funnel.replied_pct, avg: 8, avgLabel: '8% industry avg' },
                    ]"
                    :key="b.label"
                    class="rounded-xl p-4 border"
                    :class="b.yours >= b.avg ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'"
                  >
                    <p class="text-xs font-medium text-gray-500 mb-1">{{ b.label }}</p>
                    <p class="text-2xl font-bold" :class="b.yours >= b.avg ? 'text-green-700' : 'text-red-600'">{{ b.yours }}%</p>
                    <p class="text-xs mt-1" :class="b.yours >= b.avg ? 'text-green-600' : 'text-red-500'">
                      {{ b.yours >= b.avg ? '✅ Above' : '⚠️ Below' }} {{ b.avgLabel }}
                      <template v-if="b.yours !== b.avg"> ({{ b.yours > b.avg ? '+' : '' }}{{ b.yours - b.avg }}pp)</template>
                    </p>
                  </div>
                </div>
              </div>
            </template>

            <!-- ═══ SEQUENCE TAB ═══ -->
            <template v-if="activeTab === 'sequence'">
              <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div class="flex items-center justify-between mb-6">
                  <div>
                    <h2 class="text-base font-semibold text-gray-900">Campaign Sequence</h2>
                    <p class="text-sm text-gray-500 mt-1">
                      {{ campaign?.status === 'active' ? 'Campaign is live — sequence is read-only.' : 'View the sequence steps below.' }}
                    </p>
                  </div>
                </div>
                <div v-if="sequences.length === 0" class="text-center py-12 text-gray-400">No sequence steps configured yet.</div>
                <div v-else class="space-y-4">
                  <div v-for="(seq, idx) in sequences" :key="seq.id || idx" class="flex items-start gap-4 p-4 border border-gray-200 rounded-lg">
                    <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                      {{ seq.step_number }}
                    </div>
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-gray-900 capitalize">{{ seq.step_type.replace(/_/g, ' ') }}</span>
                        <span v-if="seq.delay_days > 0 || seq.delay_hours > 0" class="text-xs text-gray-400">
                          Wait {{ seq.delay_days }}d {{ seq.delay_hours }}h
                        </span>
                        <span v-if="seq.condition_type" class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                          if {{ seq.condition_type.replace(/_/g, ' ') }}
                        </span>
                        <span v-if="seq.ab_test_enabled" class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">A/B Test</span>
                      </div>
                      <p v-if="seq.message_template" class="text-sm text-gray-600 mt-1 whitespace-pre-line line-clamp-3">{{ seq.message_template }}</p>
                      <div v-if="seq.total_executed > 0" class="mt-2 flex items-center gap-3 text-xs text-gray-500">
                        <span>{{ seq.total_executed }} executed</span>
                        <span>{{ seq.total_success }} success</span>
                        <span>{{ seq.total_failed }} failed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- ═══ LEADS TAB ═══ -->
            <template v-if="activeTab === 'leads'">
              <div class="space-y-4">
                <!-- Controls -->
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <input
                      v-model="leadSearch"
                      type="text"
                      placeholder="Search leads..."
                      class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <select v-model="leadStatusFilter" class="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="all">All statuses</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="replied">Replied</option>
                      <option value="skipped">Skipped</option>
                    </select>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      v-if="selectedLeads.size > 0"
                      class="px-4 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                      @click="handleRemoveLeads"
                    >
                      Remove {{ selectedLeads.size }} leads
                    </button>
                    <button
                      class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
                      @click="openAddLeadsModal"
                    >
                      ➕ Add Leads
                    </button>
                    <button
                      class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                      @click="handleExportLeads"
                    >
                      📤 Export CSV
                    </button>
                  </div>
                </div>

                <!-- Leads Table -->
                <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div v-if="filteredLeads.length === 0" class="text-center py-12 text-gray-400">No leads found</div>
                  <table v-else class="min-w-full divide-y divide-gray-100">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-4 py-3">
                          <input type="checkbox" class="w-4 h-4 text-blue-600" @change="toggleAllLeads(($event.target as HTMLInputElement).checked)" />
                        </th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variant</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Replied</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      <tr v-for="leadItem in filteredLeads" :key="leadItem.id" class="hover:bg-gray-50">
                        <td class="px-4 py-3">
                          <input type="checkbox" :checked="selectedLeads.has(leadItem.id)" class="w-4 h-4 text-blue-600" @change="toggleLeadSelection(leadItem.id)" />
                        </td>
                        <td class="px-4 py-3">
                          <div class="text-sm font-medium text-gray-900">
                            {{ leadItem.lead?.full_name || `${leadItem.lead?.first_name || ''} ${leadItem.lead?.last_name || ''}`.trim() || 'Unknown' }}
                          </div>
                          <div class="text-xs text-gray-500">{{ leadItem.lead?.company }}</div>
                        </td>
                        <td class="px-4 py-3">
                          <span
                            class="px-2 py-0.5 rounded-full text-xs font-medium"
                            :class="{
                              'bg-green-100 text-green-700': leadItem.status === 'completed',
                              'bg-purple-100 text-purple-700': leadItem.status === 'replied',
                              'bg-blue-100 text-blue-700': leadItem.status === 'in_progress',
                              'bg-gray-100 text-gray-600': leadItem.status === 'skipped',
                              'bg-yellow-100 text-yellow-700': leadItem.status === 'pending',
                            }"
                          >
                            {{ leadItem.status }}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-xs font-mono text-gray-500">{{ leadItem.variant ? leadItem.variant.toUpperCase() : '—' }}</td>
                        <td class="px-4 py-3 text-sm text-gray-500">{{ leadItem.current_step_number || '—' }}</td>
                        <td class="px-4 py-3">
                          <span v-if="leadItem.first_reply_at" class="text-xs text-green-600">✓ Replied</span>
                          <span v-else class="text-xs text-gray-400">—</span>
                        </td>
                        <td class="px-4 py-3 text-xs text-gray-500">
                          {{ leadItem.last_activity_at ? new Date(leadItem.last_activity_at).toLocaleDateString() : '—' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

            <!-- ═══ ACTIVITY TAB ═══ -->
            <template v-if="activeTab === 'activity'">
              <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 class="text-base font-semibold text-gray-900">Activity Log</h2>
                  <span class="text-xs text-gray-400">{{ store.activityLog.length }} events</span>
                </div>
                <div v-if="store.activityLog.length === 0" class="text-center py-16 text-gray-400">
                  <p class="text-4xl mb-3">📋</p>
                  <p class="font-medium">No activity yet</p>
                  <p class="text-sm mt-1">Events will appear here when the campaign starts executing.</p>
                </div>
                <div v-else class="divide-y divide-gray-100">
                  <div v-for="entry in store.activityLog" :key="entry.id" class="flex items-start gap-4 px-6 py-3.5 hover:bg-gray-50">
                    <span class="text-xl mt-0.5">{{ activityTypeEmoji[entry.activity_type] || '⚡' }}</span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-gray-900">
                          {{ entry.campaign_lead?.lead ? `${entry.campaign_lead.lead.first_name || ''} ${entry.campaign_lead.lead.last_name || ''}`.trim() || 'Unknown' : 'Unknown' }}
                        </span>
                        <span class="text-xs text-gray-400">·</span>
                        <span class="text-xs text-gray-500 capitalize">{{ entry.activity_type?.replace(/_/g, ' ') }}</span>
                        <span
                          class="ml-auto px-2 py-0.5 rounded-full text-xs font-medium"
                          :class="{
                            'bg-green-100 text-green-700': entry.activity_status === 'success',
                            'bg-red-100 text-red-600': entry.activity_status === 'failed',
                            'bg-yellow-100 text-yellow-700': entry.activity_status !== 'success' && entry.activity_status !== 'failed',
                          }"
                        >
                          {{ entry.activity_status }}
                        </span>
                      </div>
                      <p v-if="entry.message_content" class="text-xs text-gray-500 mt-0.5 line-clamp-1">{{ entry.message_content }}</p>
                      <p v-if="entry.error_message" class="text-xs text-red-500 mt-0.5">{{ entry.error_message }}</p>
                    </div>
                    <span class="text-xs text-gray-400 whitespace-nowrap">
                      {{ entry.executed_at ? new Date(entry.executed_at).toLocaleString() : '—' }}
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <!-- ═══ SETTINGS TAB ═══ -->
            <template v-if="activeTab === 'settings' && settingsForm">
              <div class="space-y-6 max-w-2xl">
                <!-- Basic Settings -->
                <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
                  <h2 class="text-base font-semibold text-gray-900">Campaign Settings</h2>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Campaign Name</label>
                    <input v-model="settingsForm.name" type="text" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                    <textarea v-model="settingsForm.description" rows="3" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1.5">Daily Limit</label>
                      <input v-model.number="settingsForm.daily_limit" type="number" min="1" max="200" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
                      <select v-model="settingsForm.timezone" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">Eastern</option>
                        <option value="America/Los_Angeles">Pacific</option>
                        <option value="Europe/London">London</option>
                        <option value="Asia/Kolkata">India</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- Safety Settings -->
                <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
                  <h2 class="text-base font-semibold text-gray-900">🛡️ Safety Settings</h2>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1.5">Working Hours Start</label>
                      <input v-model="settingsForm.working_hours_start" type="time" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1.5">Working Hours End</label>
                      <input v-model="settingsForm.working_hours_end" type="time" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1.5">Min Delay (seconds)</label>
                      <input v-model.number="settingsForm.delay_min_seconds" type="number" min="5" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1.5">Max Delay (seconds)</label>
                      <input v-model.number="settingsForm.delay_max_seconds" type="number" min="5" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Auto-pause below acceptance rate (%)</label>
                    <input v-model.number="settingsForm.auto_pause_below_acceptance" type="number" min="0" max="100" class="w-48 px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div class="flex flex-col gap-3">
                    <label class="flex items-center gap-3 cursor-pointer">
                      <input v-model="settingsForm.skip_already_contacted" type="checkbox" class="w-4 h-4 text-blue-600" />
                      <span class="text-sm text-gray-700">Skip already-contacted leads</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer">
                      <input v-model="settingsForm.stop_on_reply" type="checkbox" class="w-4 h-4 text-blue-600" />
                      <span class="text-sm text-gray-700">Stop sequence on reply</span>
                    </label>
                  </div>
                  <button
                    :disabled="settingsSaving"
                    class="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                    @click="handleSaveSettings"
                  >
                    {{ settingsSaving ? 'Saving...' : 'Save Settings' }}
                  </button>
                </div>

                <!-- Webhooks -->
                <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h2 class="text-base font-semibold text-gray-900 mb-1">🔗 Outbound Webhooks</h2>
                  <p class="text-xs text-gray-500 mb-5">POST to external URLs on campaign events. Ideal for CRM syncing via n8n, Zapier, Make.</p>
                  <div class="flex gap-2 mb-5">
                    <input v-model="newWebhookUrl" type="url" placeholder="https://your-endpoint.com/webhook" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    <input v-model="newWebhookDesc" type="text" placeholder="Description (optional)" class="w-44 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    <button
                      :disabled="addingWebhook || !newWebhookUrl.trim()"
                      class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                      @click="handleAddWebhook"
                    >
                      {{ addingWebhook ? 'Adding...' : '+ Add' }}
                    </button>
                  </div>
                  <p v-if="store.webhooks.length === 0" class="text-sm text-gray-400 italic">No webhooks configured yet.</p>
                  <div v-else class="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                    <div v-for="wh in store.webhooks" :key="wh.id" class="flex items-center gap-3 px-4 py-3">
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-mono text-gray-800 truncate">{{ wh.url }}</p>
                        <p v-if="wh.description" class="text-xs text-gray-500">{{ wh.description }}</p>
                      </div>
                      <span :class="wh.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'" class="px-2 py-0.5 rounded-full text-xs font-medium">
                        {{ wh.is_active ? 'Active' : 'Paused' }}
                      </span>
                      <button class="text-gray-400 hover:text-red-500 text-lg leading-none" @click="handleDeleteWebhook(wh.id)">×</button>
                    </div>
                  </div>
                </div>

                <!-- Sender Accounts -->
                <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h2 class="text-base font-semibold text-gray-900 mb-1">👤 Sender Accounts</h2>
                  <p class="text-xs text-gray-500 mb-5">LinkedIn accounts that will send connection requests and messages.</p>
                  <!-- Current senders -->
                  <div v-if="campaign?.senders && campaign.senders.length > 0" class="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden mb-4">
                    <div v-for="sender in campaign.senders" :key="sender.id" class="flex items-center gap-3 px-4 py-3">
                      <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                        {{ (sender.linkedin_account?.profile_name || sender.linkedin_account?.email || '?')[0].toUpperCase() }}
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">{{ sender.linkedin_account?.profile_name || sender.linkedin_account?.email || 'Unknown' }}</p>
                        <p class="text-xs text-gray-500 truncate">{{ sender.linkedin_account?.email }}</p>
                      </div>
                      <span :class="sender.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'" class="px-2 py-0.5 rounded-full text-xs font-medium">
                        {{ sender.is_active ? 'Active' : 'Paused' }}
                      </span>
                      <button class="text-gray-400 hover:text-red-500 text-lg leading-none" title="Remove sender" @click="handleRemoveSender(sender.id)">×</button>
                    </div>
                  </div>
                  <div v-else class="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-lg mb-4">
                    <p class="text-2xl mb-1">👤</p>
                    <p class="text-sm">No senders assigned yet</p>
                    <p class="text-xs mt-0.5">Active accounts will be auto-assigned when you launch</p>
                  </div>
                  <!-- Add sender dropdown -->
                  <div v-if="availableLinkedInAccounts.length > 0" class="flex gap-2">
                    <select v-model="selectedSenderAccountId" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="">Select a LinkedIn account to add...</option>
                      <option v-for="acct in availableLinkedInAccounts" :key="acct.id" :value="acct.id">
                        {{ acct.profile_name || acct.email }} ({{ acct.email }})
                      </option>
                    </select>
                    <button
                      :disabled="addingSender || !selectedSenderAccountId"
                      class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                      @click="handleAddSender(selectedSenderAccountId)"
                    >
                      {{ addingSender ? 'Adding...' : '+ Add Sender' }}
                    </button>
                  </div>
                  <p v-else-if="campaign?.senders?.length === 0" class="text-xs text-gray-400 italic">
                    No active LinkedIn accounts available.
                    <router-link to="/linkedin-account" class="text-blue-600 hover:underline">Connect one first →</router-link>
                  </p>
                </div>

                <!-- Danger Zone -->
                <div class="bg-white border border-red-200 rounded-xl p-6 shadow-sm">
                  <h2 class="text-base font-semibold text-red-700 mb-3">⚠️ Danger Zone</h2>
                  <p class="text-sm text-gray-500 mb-4">Permanently delete this campaign and all its data. This cannot be undone.</p>
                  <button class="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium" @click="handleDelete">Delete Campaign</button>
                </div>
              </div>
            </template>
          </template>
        </div>
      </main>
    </template>

    <!-- Add Leads Modal -->
    <div v-if="showAddLeadsModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showAddLeadsModal = false">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h2 class="text-lg font-bold text-gray-900">Add Leads to Campaign</h2>
            <p class="text-sm text-gray-500 mt-0.5">Select a lead list to enroll</p>
          </div>
          <button class="p-2 hover:bg-gray-100 rounded-lg transition-colors" @click="showAddLeadsModal = false">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div v-if="store.availableLists.length === 0" class="text-center py-8 text-gray-400">
          <p class="text-3xl mb-2">📋</p>
          <p class="text-sm">No lead lists found. Create one in the Leads section first.</p>
        </div>
        <div v-else class="space-y-3">
          <label class="block text-sm font-medium text-gray-700">Choose a list</label>
          <select v-model="addLeadsListId" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="">— Select a list —</option>
            <option v-for="list in store.availableLists" :key="list.id" :value="list.id">
              {{ list.name }} ({{ list.lead_count ?? list.leads_count ?? '?' }} leads)
            </option>
          </select>
          <p class="text-xs text-gray-400">Leads already in this campaign will be skipped automatically.</p>
          <div class="flex gap-3 pt-2">
            <button class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50" @click="showAddLeadsModal = false">Cancel</button>
            <button
              :disabled="!addLeadsListId || addLeadsLoading"
              class="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              @click="handleAddLeadsFromList"
            >
              {{ addLeadsLoading ? 'Adding...' : 'Add Leads' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
