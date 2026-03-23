<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCampaignStore } from '@/stores/campaigns'
import type { Campaign, CampaignTemplate } from '@/types/campaign'

const router = useRouter()
const store = useCampaignStore()

const view = ref<'grid' | 'list'>('grid')
const statusFilter = ref('all')
const search = ref('')
const showTemplateModal = ref(false)

onMounted(() => {
  store.fetchCampaigns()
  store.fetchTemplates()
})

watch([statusFilter], () => {
  const params: { status?: string } = {}
  if (statusFilter.value !== 'all') params.status = statusFilter.value
  store.fetchCampaigns(params)
})

const filteredCampaigns = computed(() => {
  return store.campaigns.filter((c) => {
    const matchesSearch =
      !search.value ||
      c.name.toLowerCase().includes(search.value.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.value.toLowerCase())
    return matchesSearch
  })
})

const statusTabs = computed(() => [
  { value: 'all', label: 'All', count: store.stats.total },
  { value: 'active', label: 'Active', count: store.stats.active },
  { value: 'paused', label: 'Paused', count: store.stats.paused },
  { value: 'draft', label: 'Drafts', count: store.stats.draft },
])

function getStatusConfig(status: string) {
  const configs: Record<string, { icon: string; label: string; bg: string; text: string; border: string }> = {
    draft: { icon: '📝', label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
    active: { icon: '▶️', label: 'Active', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    paused: { icon: '⏸️', label: 'Paused', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    completed: { icon: '✅', label: 'Completed', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    canceled: { icon: '❌', label: 'Canceled', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  }
  return configs[status] || configs.draft
}

function acceptRate(c: Campaign) {
  return c.connection_sent > 0 ? Math.round((c.connection_accepted / c.connection_sent) * 100) : 0
}

function replyRate(c: Campaign) {
  return c.messages_sent > 0 ? Math.round((c.replies_received / c.messages_sent) * 100) : 0
}

async function handleDelete(id: string) {
  if (!confirm('Delete this campaign? This action cannot be undone.')) return
  try {
    await store.deleteCampaign(id)
    store.fetchCampaigns()
  } catch {
    alert('Failed to delete campaign')
  }
}

async function handleStart(id: string) {
  try {
    await store.startCampaign(id)
    store.fetchCampaigns()
  } catch {
    alert('Failed to start campaign')
  }
}

async function handlePause(id: string) {
  try {
    await store.pauseCampaign(id)
    store.fetchCampaigns()
  } catch {
    alert('Failed to pause campaign')
  }
}

function useTemplate(tpl: CampaignTemplate) {
  showTemplateModal.value = false
  router.push({ path: '/campaigns/new', query: { template: tpl.id } })
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div>
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p class="text-sm text-gray-500 mt-1">Automate LinkedIn outreach at scale</p>
        </div>
      </div>
    </header>

    <main class="flex-1 overflow-auto">
      <div class="max-w-7xl mx-auto p-6">
        <!-- Stats Overview -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <!-- Total Campaigns -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600">Total Campaigns</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">{{ store.stats.total }}</p>
              </div>
              <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <div class="mt-3 flex items-center text-xs text-gray-500">
              <span class="text-green-600 font-medium">{{ store.stats.active }} active</span>
              <span class="mx-2">•</span>
              <span>{{ store.stats.draft }} drafts</span>
            </div>
          </div>
          <!-- Leads Contacted -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600">Leads Contacted</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">{{ store.stats.totalLeadsContacted }}</p>
              </div>
              <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div class="mt-3 flex items-center text-xs text-gray-500">Across all campaigns</div>
          </div>
          <!-- Acceptance Rate -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600">Acceptance Rate</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">
                  {{ store.stats.totalLeadsContacted > 0 ? Math.round((store.stats.totalAccepted / store.stats.totalLeadsContacted) * 100) : 0 }}%
                </p>
              </div>
              <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div class="mt-3 flex items-center text-xs text-gray-500">{{ store.stats.totalAccepted }} connections accepted</div>
          </div>
          <!-- Reply Rate -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600">Reply Rate</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">
                  {{ store.stats.totalLeadsContacted > 0 ? Math.round((store.stats.totalReplies / store.stats.totalLeadsContacted) * 100) : 0 }}%
                </p>
              </div>
              <div class="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
            </div>
            <div class="mt-3 flex items-center text-xs text-gray-500">{{ store.stats.totalReplies }} replies received</div>
          </div>
        </div>

        <!-- Filters and Actions -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex items-center space-x-2 flex-1">
              <!-- Status Tabs -->
              <div class="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  v-for="tab in statusTabs"
                  :key="tab.value"
                  class="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  :class="statusFilter === tab.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
                  @click="statusFilter = tab.value"
                >
                  {{ tab.label }} <span class="text-xs text-gray-500">({{ tab.count }})</span>
                </button>
              </div>
              <!-- Search -->
              <div class="relative flex-1 max-w-sm">
                <input
                  v-model="search"
                  type="text"
                  placeholder="Search campaigns..."
                  class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <div class="flex items-center space-x-3">
              <!-- View Toggle -->
              <div class="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  class="p-2 rounded-md transition-all"
                  :class="view === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'"
                  title="Grid view"
                  @click="view = 'grid'"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  class="p-2 rounded-md transition-all"
                  :class="view === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'"
                  title="List view"
                  @click="view = 'list'"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
              <!-- New Campaign -->
              <router-link
                to="/campaigns/new"
                class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium transition-all shadow-sm space-x-2"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>New Campaign</span>
              </router-link>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="store.loading" class="flex items-center justify-center py-20">
          <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <p class="text-gray-600 mt-4 font-medium">Loading campaigns...</p>
          </div>
        </div>

        <!-- Empty State: no campaigns at all -->
        <div v-else-if="filteredCampaigns.length === 0 && store.campaigns.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
          <svg class="w-24 h-24 text-blue-100 mb-6" fill="currentColor" viewBox="0 0 100 100">
            <ellipse cx="50" cy="85" rx="28" ry="6" fill="#dbeafe" />
            <rect x="38" y="55" width="24" height="30" rx="4" fill="#3b82f6" />
            <polygon points="50,15 62,50 50,44 38,50" fill="#1d4ed8" />
            <circle cx="44" cy="68" r="2.5" fill="white" />
            <circle cx="56" cy="68" r="2.5" fill="white" />
          </svg>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">No campaigns yet</h2>
          <p class="text-gray-500 max-w-sm mb-8">Create your first outreach campaign and start connecting automatically.</p>
          <div class="flex flex-col sm:flex-row items-center gap-3">
            <router-link
              to="/campaigns/new"
              class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-colors shadow-sm"
            >
              🚀 Create Campaign
            </router-link>
            <button
              class="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
              @click="showTemplateModal = true"
            >
              📋 Use a Template
            </button>
          </div>
        </div>

        <!-- Empty filtered -->
        <div v-else-if="filteredCampaigns.length === 0" class="bg-white rounded-lg shadow-sm border border-gray-200 py-16">
          <div class="text-center">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">No campaigns found</h3>
            <p class="text-gray-500">Try adjusting your filters or search query</p>
          </div>
        </div>

        <!-- Grid View -->
        <div v-else-if="view === 'grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            v-for="campaign in filteredCampaigns"
            :key="campaign.id"
            class="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all overflow-hidden group"
          >
            <!-- Card Header -->
            <div class="p-5 border-b border-gray-100">
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                  <router-link :to="`/campaigns/${campaign.id}`">
                    <h3 class="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {{ campaign.name }}
                    </h3>
                  </router-link>
                  <p v-if="campaign.description" class="text-sm text-gray-500 mt-1 line-clamp-2">{{ campaign.description }}</p>
                </div>
                <span
                  class="ml-3 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 border"
                  :class="[getStatusConfig(campaign.status).bg, getStatusConfig(campaign.status).text, getStatusConfig(campaign.status).border]"
                >
                  {{ getStatusConfig(campaign.status).icon }} {{ getStatusConfig(campaign.status).label }}
                </span>
              </div>
              <!-- Funnel Mini-Stats -->
              <div class="mt-3 flex items-center gap-2 text-xs">
                <span class="text-gray-500">{{ campaign.connection_sent || 0 }} sent</span>
                <span class="text-gray-300">·</span>
                <span :class="acceptRate(campaign) >= 30 ? 'text-green-600 font-semibold' : acceptRate(campaign) >= 15 ? 'text-yellow-600 font-semibold' : 'text-red-500 font-semibold'">
                  {{ acceptRate(campaign) }}% accepted
                </span>
                <span class="text-gray-300">·</span>
                <span class="text-purple-600 font-semibold">{{ replyRate(campaign) }}% replied</span>
              </div>
            </div>
            <!-- Card Body -->
            <div class="p-5">
              <!-- Senders -->
              <div v-if="campaign.senders && campaign.senders.length > 0" class="mb-4">
                <p class="text-xs text-gray-500 mb-2">Senders ({{ campaign.senders.length }})</p>
                <div class="flex -space-x-2">
                  <div
                    v-for="(_sender, idx) in campaign.senders.slice(0, 3)"
                    :key="idx"
                    class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                    :title="`Sender ${idx + 1}`"
                  >
                    {{ String.fromCharCode(65 + idx) }}
                  </div>
                  <div v-if="campaign.senders.length > 3" class="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-medium">
                    +{{ campaign.senders.length - 3 }}
                  </div>
                </div>
              </div>
              <!-- Action Buttons -->
              <div class="flex items-center space-x-2">
                <button
                  v-if="campaign.status === 'draft'"
                  class="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                  @click="handleStart(campaign.id)"
                >
                  <span>▶</span><span>Launch</span>
                </button>
                <button
                  v-if="campaign.status === 'active'"
                  class="flex-1 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                  @click="handlePause(campaign.id)"
                >
                  <span>⏸</span><span>Pause</span>
                </button>
                <button
                  v-if="campaign.status === 'paused'"
                  class="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                  @click="handleStart(campaign.id)"
                >
                  <span>▶</span><span>Resume</span>
                </button>
                <router-link
                  :to="`/campaigns/${campaign.id}`"
                  class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                >
                  View
                </router-link>
                <button
                  class="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors"
                  title="Delete campaign"
                  @click="handleDelete(campaign.id)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            <!-- Card Footer -->
            <div class="px-5 py-3 bg-gray-50 border-t border-gray-100">
              <p class="text-xs text-gray-500">Created {{ formatDate(campaign.created_at) }}</p>
            </div>
          </div>
        </div>

        <!-- List View -->
        <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Senders</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="campaign in filteredCampaigns" :key="campaign.id" class="hover:bg-gray-50">
                <td class="px-6 py-4">
                  <router-link :to="`/campaigns/${campaign.id}`">
                    <div class="text-sm font-medium text-gray-900 hover:text-blue-600">{{ campaign.name }}</div>
                    <div class="text-sm text-gray-500 line-clamp-1">{{ campaign.description }}</div>
                  </router-link>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                    :class="[getStatusConfig(campaign.status).bg, getStatusConfig(campaign.status).text, getStatusConfig(campaign.status).border]"
                  >
                    {{ getStatusConfig(campaign.status).icon }} {{ getStatusConfig(campaign.status).label }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center space-x-2">
                    <div class="flex-1 w-24 bg-gray-200 rounded-full h-2">
                      <div
                        class="bg-blue-600 h-2 rounded-full"
                        :style="{ width: `${campaign.total_leads > 0 ? ((campaign.pending_leads || 0) / campaign.total_leads) * 100 : 0}%` }"
                      />
                    </div>
                    <span class="text-xs text-gray-600 whitespace-nowrap">
                      {{ campaign.pending_leads || 0 }}/{{ campaign.total_leads || 0 }}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center space-x-3 text-sm">
                    <div class="flex items-center space-x-1">
                      <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span class="font-medium text-gray-900">{{ acceptRate(campaign) }}%</span>
                    </div>
                    <div class="flex items-center space-x-1">
                      <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span class="font-medium text-gray-900">{{ replyRate(campaign) }}%</span>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div v-if="campaign.senders && campaign.senders.length > 0" class="flex -space-x-2">
                    <div
                      v-for="(_sender, idx) in campaign.senders.slice(0, 3)"
                      :key="idx"
                      class="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                    >
                      {{ String.fromCharCode(65 + idx) }}
                    </div>
                    <div v-if="campaign.senders.length > 3" class="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-medium">
                      +{{ campaign.senders.length - 3 }}
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div class="flex items-center justify-end space-x-2">
                    <button v-if="campaign.status === 'draft'" class="text-green-600 hover:text-green-700" title="Launch" @click="handleStart(campaign.id)">▶</button>
                    <button v-if="campaign.status === 'active'" class="text-yellow-600 hover:text-yellow-700" title="Pause" @click="handlePause(campaign.id)">⏸</button>
                    <button v-if="campaign.status === 'paused'" class="text-green-600 hover:text-green-700" title="Resume" @click="handleStart(campaign.id)">▶</button>
                    <router-link :to="`/campaigns/${campaign.id}`" class="text-blue-600 hover:text-blue-700" title="View">👁</router-link>
                    <button class="text-red-600 hover:text-red-700" title="Delete" @click="handleDelete(campaign.id)">🗑</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <!-- Template Modal -->
    <div v-if="showTemplateModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showTemplateModal = false">
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-xl font-bold text-gray-900">Choose a Template</h2>
            <p class="text-sm text-gray-500 mt-1">Start with a proven sequence</p>
          </div>
          <button class="p-2 hover:bg-gray-100 rounded-lg transition-colors" @click="showTemplateModal = false">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="grid grid-cols-1 gap-4">
          <div v-if="store.templates.length === 0" class="text-center py-8 text-gray-500">Loading templates...</div>
          <button
            v-for="tpl in store.templates"
            :key="tpl.id"
            class="flex items-start gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
            @click="useTemplate(tpl)"
          >
            <span class="text-3xl">{{ tpl.icon || '📋' }}</span>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-gray-900 group-hover:text-blue-700">{{ tpl.name }}</h3>
                <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{{ tpl.steps?.length || 0 }} steps</span>
              </div>
              <p class="text-sm text-gray-500 mt-1">{{ tpl.description }}</p>
            </div>
            <svg class="w-5 h-5 text-gray-400 group-hover:text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-100">
          <router-link
            to="/campaigns/new"
            class="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
            @click="showTemplateModal = false"
          >
            Or start from scratch →
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
