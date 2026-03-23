<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAccountStore } from '@/stores/accounts'
import type {
  LinkedInAccount,
  Proxy,
  CreateAccountWithCookieRequest,
  ReconnectAccountRequest,
  UpdateLimitsRequest,
  UpdateProxyRequest,
  AssignCampaignsRequest,
  VerifyOTPRequest,
  CreateProxyRequest,
} from '@/types'

import ConnectAccountModal from '@/components/modals/ConnectAccountModal.vue'
import ConfigureLimitsModal from '@/components/modals/ConfigureLimitsModal.vue'
import AssignProxyModal from '@/components/modals/AssignProxyModal.vue'
import OTPVerificationModal from '@/components/modals/OTPVerificationModal.vue'
import PinVerificationModal from '@/components/modals/PinVerificationModal.vue'
import InfiniteLoginModal from '@/components/modals/InfiniteLoginModal.vue'
import AssignCampaignsModal from '@/components/modals/AssignCampaignsModal.vue'
import ProxyModal from '@/components/modals/ProxyModal.vue'

const store = useAccountStore()

// ── UI state ─────────────────────────────────────────
const showConnectModal = ref(false)
const showLimitsModal = ref(false)
const showProxyAssignModal = ref(false)
const showOTPModal = ref(false)
const showPinModal = ref(false)
const showInfiniteLoginModal = ref(false)
const showCampaignsModal = ref(false)
const showProxyModal = ref(false)
const showProxies = ref(false)

const selectedAccount = ref<LinkedInAccount | null>(null)
const reconnectingAccount = ref<LinkedInAccount | null>(null)
const editingProxy = ref<Proxy | null>(null)
const openDropdownId = ref<string | null>(null)
const actionLoading = ref<Record<string, boolean>>({})
const successMessage = ref<string | null>(null)

// ── Lifecycle ────────────────────────────────────────
onMounted(() => {
  store.fetchAll()
})

// ── Helpers ──────────────────────────────────────────
function showSuccess(msg: string) {
  successMessage.value = msg
  setTimeout(() => { successMessage.value = null }, 3000)
}

function setActionLoading(id: string, val: boolean) {
  actionLoading.value = { ...actionLoading.value, [id]: val }
}

function toggleDropdown(id: string) {
  openDropdownId.value = openDropdownId.value === id ? null : id
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    connected: 'bg-green-100 text-green-700',
    disconnected: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
    warming_up: 'bg-blue-100 text-blue-700',
    restricted: 'bg-orange-100 text-orange-700',
    banned: 'bg-red-100 text-red-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}

function getConnectionBadge(method?: string) {
  if (method === 'cookie') return { text: 'Session Import', class: 'bg-purple-100 text-purple-700' }
  if (method === 'proxy_login') return { text: 'Email & Password', class: 'bg-blue-100 text-blue-700' }
  return { text: method || 'Unknown', class: 'bg-gray-100 text-gray-700' }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const proxyMap = computed(() => {
  const map = new Map<string, Proxy>()
  store.proxies.forEach((p) => map.set(p.id, p))
  return map
})

function getProxyForAccount(account: LinkedInAccount) {
  if (!account.proxy_id) return null
  return proxyMap.value.get(account.proxy_id) || null
}

// ── Actions ──────────────────────────────────────────
function openConnect() {
  reconnectingAccount.value = null
  showConnectModal.value = true
}

function openReconnect(account: LinkedInAccount) {
  reconnectingAccount.value = account
  showConnectModal.value = true
  openDropdownId.value = null
}

async function handleConnect(data: CreateAccountWithCookieRequest) {
  await store.createAccountWithCookie(data)
  showConnectModal.value = false
  showSuccess('Account connected successfully!')
}

async function handleReconnect(data: ReconnectAccountRequest) {
  if (!reconnectingAccount.value) return
  await store.reconnectAccount(reconnectingAccount.value.id, data)
  showConnectModal.value = false
  reconnectingAccount.value = null
  showSuccess('Account reconnected successfully!')
}

async function handleToggleStatus(account: LinkedInAccount) {
  setActionLoading(account.id, true)
  try {
    await store.toggleAccountStatus(account.id)
    showSuccess(`Account ${account.status === 'active' ? 'paused' : 'activated'}!`)
  } finally {
    setActionLoading(account.id, false)
  }
}

async function handleDelete(account: LinkedInAccount) {
  if (!confirm(`Are you sure you want to delete ${account.email}?`)) return
  setActionLoading(account.id, true)
  try {
    await store.deleteAccount(account.id)
    showSuccess('Account deleted!')
  } finally {
    setActionLoading(account.id, false)
  }
}

function openLimits(account: LinkedInAccount) {
  selectedAccount.value = account
  showLimitsModal.value = true
  openDropdownId.value = null
}

async function handleUpdateLimits(data: UpdateLimitsRequest) {
  if (!selectedAccount.value) return
  await store.updateLimits(selectedAccount.value.id, data)
  showLimitsModal.value = false
  selectedAccount.value = null
  showSuccess('Daily limits updated!')
}

function openAssignProxy(account: LinkedInAccount) {
  selectedAccount.value = account
  showProxyAssignModal.value = true
  openDropdownId.value = null
}

async function handleAssignProxy(data: UpdateProxyRequest) {
  if (!selectedAccount.value) return
  await store.updateProxy(selectedAccount.value.id, data)
  showProxyAssignModal.value = false
  selectedAccount.value = null
  showSuccess('Proxy assigned!')
}

function openAssignCampaigns(account: LinkedInAccount) {
  selectedAccount.value = account
  showCampaignsModal.value = true
  openDropdownId.value = null
}

async function handleAssignCampaigns(data: AssignCampaignsRequest) {
  if (!selectedAccount.value) return
  await store.assignCampaigns(selectedAccount.value.id, data)
  showCampaignsModal.value = false
  selectedAccount.value = null
  showSuccess('Campaigns assigned!')
}

async function handleRefreshProfile(account: LinkedInAccount) {
  setActionLoading(account.id, true)
  openDropdownId.value = null
  try {
    await store.updateProfile(account.id)
    showSuccess('Profile data refreshed!')
  } finally {
    setActionLoading(account.id, false)
  }
}

async function handleCheckConnection(account: LinkedInAccount) {
  setActionLoading(account.id, true)
  openDropdownId.value = null
  try {
    await store.checkConnection(account.id)
    showSuccess('Connection verified!')
  } finally {
    setActionLoading(account.id, false)
  }
}

async function handleMonitorHealth() {
  try {
    await store.monitorHealth()
    showSuccess('Health check completed!')
    store.fetchAll()
  } catch {
    // error handled by store
  }
}

function openOTPModal(account: LinkedInAccount) {
  selectedAccount.value = account
  showOTPModal.value = true
}

async function handleVerifyOTP(data: VerifyOTPRequest) {
  if (!selectedAccount.value) return
  await store.verifyOTP(selectedAccount.value.id, data)
  showOTPModal.value = false
  selectedAccount.value = null
  showSuccess('OTP verified!')
}

function openPinModal(account: LinkedInAccount) {
  selectedAccount.value = account
  showPinModal.value = true
}

// Proxy management
function openCreateProxy() {
  editingProxy.value = null
  showProxyModal.value = true
}

function openEditProxy(proxy: Proxy) {
  editingProxy.value = proxy
  showProxyModal.value = true
}

async function handleProxySubmit(data: CreateProxyRequest) {
  if (editingProxy.value) {
    await store.updateProxyRecord(editingProxy.value.id, data)
    showSuccess('Proxy updated!')
  } else {
    await store.createProxy(data)
    showSuccess('Proxy created!')
  }
  showProxyModal.value = false
  editingProxy.value = null
}

async function handleDeleteProxy(proxy: Proxy) {
  if (!confirm(`Delete proxy "${proxy.name}"?`)) return
  await store.deleteProxy(proxy.id)
  showSuccess('Proxy deleted!')
}

async function handleTestProxy(proxy: Proxy) {
  try {
    await store.testProxy(proxy.id)
    showSuccess(`Proxy "${proxy.name}" is working!`)
  } catch {
    // error handled by store
  }
}
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">LinkedIn Accounts</h1>
        <p class="text-gray-500 text-sm mt-1">
          Manage your LinkedIn accounts, proxies, and connection settings
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          @click="handleMonitorHealth"
        >
          🏥 Check Health
        </button>
        <button
          class="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          @click="showProxies = !showProxies"
        >
          🌐 {{ showProxies ? 'Hide' : 'Show' }} Proxies
        </button>
        <button
          class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          @click="openConnect"
        >
          + Connect Account
        </button>
      </div>
    </div>

    <!-- Success message -->
    <div
      v-if="successMessage"
      class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      {{ successMessage }}
    </div>

    <!-- Error message -->
    <div
      v-if="store.error"
      class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
    >
      {{ store.error }}
    </div>

    <!-- Info Banner -->
    <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div class="flex items-start gap-3">
        <div class="text-blue-600 text-xl">💡</div>
        <div>
          <h3 class="text-sm font-semibold text-blue-800">Getting Started</h3>
          <p class="text-sm text-blue-700 mt-1">
            Connect your LinkedIn accounts to start automating outreach. Use <strong>Session Import</strong> for
            quick setup or <strong>Email & Password</strong> for full control with proxy support.
          </p>
        </div>
      </div>
    </div>

    <!-- Proxies Section (collapsible) -->
    <div v-if="showProxies" class="mb-6">
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">Proxies</h2>
          <button
            class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            @click="openCreateProxy"
          >
            + Add Proxy
          </button>
        </div>
        <div v-if="store.proxies.length === 0" class="p-8 text-center text-gray-500 text-sm">
          No proxies configured. Add one to improve account security.
        </div>
        <table v-else class="w-full">
          <thead>
            <tr class="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
              <th class="px-6 py-3">Name</th>
              <th class="px-6 py-3">Type</th>
              <th class="px-6 py-3">Host</th>
              <th class="px-6 py-3">Port</th>
              <th class="px-6 py-3">Status</th>
              <th class="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="proxy in store.proxies" :key="proxy.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4 text-sm font-medium text-gray-900">{{ proxy.name }}</td>
              <td class="px-6 py-4">
                <span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 uppercase">{{ proxy.type }}</span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-600">{{ proxy.host }}</td>
              <td class="px-6 py-4 text-sm text-gray-600">{{ proxy.port }}</td>
              <td class="px-6 py-4">
                <span
                  class="px-2 py-1 text-xs rounded-full"
                  :class="proxy.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                >
                  {{ proxy.is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    class="text-xs text-blue-600 hover:text-blue-800"
                    @click="handleTestProxy(proxy)"
                  >Test</button>
                  <button
                    class="text-xs text-gray-600 hover:text-gray-800"
                    @click="openEditProxy(proxy)"
                  >Edit</button>
                  <button
                    class="text-xs text-red-600 hover:text-red-800"
                    @click="handleDeleteProxy(proxy)"
                  >Delete</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Accounts Table -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">
          Accounts
          <span class="text-sm font-normal text-gray-500 ml-2">
            ({{ store.connectedCount }} active / {{ store.totalCount }} total)
          </span>
        </h2>
      </div>

      <!-- Loading -->
      <div v-if="store.loading && store.accounts.length === 0" class="p-12 text-center">
        <div class="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p class="text-gray-500 text-sm">Loading accounts...</p>
      </div>

      <!-- Empty -->
      <div v-else-if="store.accounts.length === 0" class="p-12 text-center">
        <div class="text-4xl mb-3">🔗</div>
        <h3 class="text-lg font-semibold text-gray-800 mb-1">No accounts connected</h3>
        <p class="text-gray-500 text-sm mb-4">Connect your first LinkedIn account to get started.</p>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          @click="openConnect"
        >
          + Connect Account
        </button>
      </div>

      <!-- Table -->
      <table v-else class="w-full">
        <thead>
          <tr class="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
            <th class="px-6 py-3">Account</th>
            <th class="px-6 py-3">Connection</th>
            <th class="px-6 py-3">Proxy</th>
            <th class="px-6 py-3">Status</th>
            <th class="px-6 py-3">Daily Limits</th>
            <th class="px-6 py-3">Last Active</th>
            <th class="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="account in store.accounts"
            :key="account.id"
            class="hover:bg-gray-50 transition-colors"
          >
            <!-- Account info -->
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                  <img
                    v-if="account.profile_picture_url"
                    :src="account.profile_picture_url"
                    :alt="account.name || account.email"
                    class="w-full h-full object-cover"
                  />
                  <span v-else>{{ (account.name || account.email || '?')[0].toUpperCase() }}</span>
                </div>
                <div>
                  <div class="font-medium text-gray-900 text-sm">{{ account.name || account.email }}</div>
                  <div v-if="account.headline" class="text-xs text-gray-500 max-w-[200px] truncate">
                    {{ account.headline }}
                  </div>
                  <div v-if="account.job_title || account.company" class="text-xs text-gray-400">
                    {{ [account.job_title, account.company].filter(Boolean).join(' at ') }}
                  </div>
                </div>
              </div>
            </td>

            <!-- Connection method -->
            <td class="px-6 py-4">
              <span
                class="px-2 py-1 text-xs rounded-full"
                :class="getConnectionBadge(account.connection_method).class"
              >
                {{ getConnectionBadge(account.connection_method).text }}
              </span>
            </td>

            <!-- Proxy -->
            <td class="px-6 py-4">
              <template v-if="getProxyForAccount(account)">
                <span class="text-sm text-gray-700">
                  {{ getProxyForAccount(account)!.name }}
                </span>
                <span class="text-xs text-gray-400 block">
                  {{ getProxyForAccount(account)!.type }}
                </span>
              </template>
              <span v-else class="text-xs text-gray-400">No proxy</span>
            </td>

            <!-- Status -->
            <td class="px-6 py-4">
              <span
                class="px-2.5 py-1 text-xs rounded-full font-medium"
                :class="getStatusColor(account.status)"
              >
                {{ account.status.replace('_', ' ') }}
              </span>
              <!-- OTP / PIN required -->
              <button
                v-if="account.status === 'pending' && account.requires_otp"
                class="block mt-1 text-xs text-blue-600 hover:underline"
                @click="openOTPModal(account)"
              >
                Enter OTP →
              </button>
              <button
                v-if="account.status === 'pending' && account.requires_pin"
                class="block mt-1 text-xs text-blue-600 hover:underline"
                @click="openPinModal(account)"
              >
                Enter PIN →
              </button>
            </td>

            <!-- Daily Limits -->
            <td class="px-6 py-4">
              <div class="text-xs text-gray-600 space-y-0.5">
                <div>📤 {{ account.sending_limits?.connection_requests_per_day ?? 25 }}/day connections</div>
                <div>💬 {{ account.sending_limits?.messages_per_day ?? 50 }}/day messages</div>
                <div>📧 {{ account.sending_limits?.inmails_per_day ?? 10 }}/day inmails</div>
              </div>
            </td>

            <!-- Last Active -->
            <td class="px-6 py-4 text-sm text-gray-500">
              {{ formatDate(account.last_active) }}
            </td>

            <!-- Actions -->
            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <!-- Toggle status -->
                <button
                  class="p-1.5 rounded-lg transition-colors"
                  :class="account.status === 'active'
                    ? 'text-green-600 hover:bg-green-50'
                    : 'text-gray-400 hover:bg-gray-100'"
                  :disabled="!!actionLoading[account.id]"
                  :title="account.status === 'active' ? 'Pause account' : 'Activate account'"
                  @click="handleToggleStatus(account)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path v-if="account.status === 'active'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                </button>

                <!-- Reconnect -->
                <button
                  v-if="account.status === 'disconnected'"
                  class="p-1.5 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-colors"
                  title="Reconnect"
                  @click="openReconnect(account)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                <!-- Delete -->
                <button
                  class="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  :disabled="!!actionLoading[account.id]"
                  title="Delete account"
                  @click="handleDelete(account)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                <!-- 3-dot menu -->
                <div class="relative">
                  <button
                    class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    @click="toggleDropdown(account.id)"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>

                  <!-- Dropdown -->
                  <div
                    v-if="openDropdownId === account.id"
                    class="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1"
                  >
                    <button
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      @click="openAssignProxy(account)"
                    >
                      🌐 Configure Proxy
                    </button>
                    <button
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      @click="openLimits(account)"
                    >
                      ⚙️ Configure Daily Limits
                    </button>
                    <button
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      @click="openAssignCampaigns(account)"
                    >
                      📋 Assign Campaigns
                    </button>
                    <button
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      @click="handleRefreshProfile(account)"
                    >
                      🔄 Refresh Profile Data
                    </button>
                    <button
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      @click="handleCheckConnection(account)"
                    >
                      🔍 Check Connection
                    </button>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Click-away for dropdowns -->
    <div
      v-if="openDropdownId"
      class="fixed inset-0 z-40"
      @click="openDropdownId = null"
    />

    <!-- ── Modals ──────────────────────────────────── -->
    <ConnectAccountModal
      :show="showConnectModal"
      :proxies="store.proxies"
      :reconnecting-account="reconnectingAccount"
      @close="showConnectModal = false; reconnectingAccount = null"
      @submit="(data: any) => reconnectingAccount ? handleReconnect(data) : handleConnect(data)"
      @create-proxy="openCreateProxy"
    />

    <ConfigureLimitsModal
      :show="showLimitsModal"
      :account="selectedAccount"
      @close="showLimitsModal = false; selectedAccount = null"
      @submit="handleUpdateLimits"
    />

    <AssignProxyModal
      :show="showProxyAssignModal"
      :account="selectedAccount"
      :proxies="store.proxies"
      @close="showProxyAssignModal = false; selectedAccount = null"
      @submit="handleAssignProxy"
    />

    <OTPVerificationModal
      :show="showOTPModal"
      :account-email="selectedAccount?.email || ''"
      @close="showOTPModal = false; selectedAccount = null"
      @verify="handleVerifyOTP"
    />

    <PinVerificationModal
      :show="showPinModal"
      :account-email="selectedAccount?.email || ''"
      @close="showPinModal = false; selectedAccount = null"
      @submit="(_pin: string) => { /* pin verification via reconnect */ }"
    />

    <InfiniteLoginModal
      :show="showInfiniteLoginModal"
      :proxies="store.proxies"
      @close="showInfiniteLoginModal = false"
      @submit="handleConnect"
    />

    <AssignCampaignsModal
      :show="showCampaignsModal"
      :account-id="selectedAccount?.id || ''"
      :account-email="selectedAccount?.email || ''"
      :current-campaigns="selectedAccount?.campaigns || []"
      :available-campaigns="store.campaigns"
      @close="showCampaignsModal = false; selectedAccount = null"
      @assign="handleAssignCampaigns"
    />

    <ProxyModal
      :show="showProxyModal"
      :editing-proxy="editingProxy"
      @close="showProxyModal = false; editingProxy = null"
      @submit="handleProxySubmit"
    />
  </div>
</template>
