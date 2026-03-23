<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { LinkedInAccount, Proxy } from '@/types'

const props = defineProps<{
  show: boolean
  proxies: Proxy[]
  reconnectingAccount: LinkedInAccount | null
}>()

const emit = defineEmits<{
  close: []
  submit: [data: Record<string, unknown>]
  createProxy: []
}>()

type Mode = 'cookie' | 'proxy_login'

const mode = ref<Mode>('cookie')
const email = ref('')
const secretKey = ref('')
const password = ref('')
const selectedProxyId = ref('')
const showAdvanced = ref(false)
const submitting = ref(false)

// Auto-select best proxy (prefer residential)
const bestProxy = computed(() => {
  const residential = props.proxies.find((p) => p.type === 'socks5' && p.is_active)
  return residential || props.proxies.find((p) => p.is_active) || null
})

// Reset form when modal opens
watch(
  () => props.show,
  (open) => {
    if (open) {
      mode.value = 'cookie'
      email.value = props.reconnectingAccount?.email || ''
      secretKey.value = ''
      password.value = ''
      selectedProxyId.value = bestProxy.value?.id || ''
      showAdvanced.value = false
      submitting.value = false
    }
  }
)

async function handleSubmit() {
  submitting.value = true
  try {
    if (props.reconnectingAccount) {
      emit('submit', {
        secret_key: mode.value === 'cookie' ? secretKey.value : password.value,
        proxy_id: selectedProxyId.value || undefined,
      })
    } else {
      emit('submit', {
        email: email.value,
        secret_key: mode.value === 'cookie' ? secretKey.value : password.value,
        proxy_id: selectedProxyId.value || undefined,
        connection_method: mode.value,
      })
    }
  } finally {
    submitting.value = false
  }
}

const isFormValid = computed(() => {
  if (!email.value) return false
  if (mode.value === 'cookie' && !secretKey.value) return false
  if (mode.value === 'proxy_login' && !password.value) return false
  return true
})
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="emit('close')" />

      <!-- Modal -->
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">
            {{ reconnectingAccount ? 'Reconnect Account' : 'Connect LinkedIn Account' }}
          </h2>
          <button class="text-gray-400 hover:text-gray-600 p-1" @click="emit('close')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5">
          <!-- Mode toggle -->
          <div class="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              class="flex-1 py-2.5 text-sm font-medium transition-colors"
              :class="mode === 'cookie' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
              @click="mode = 'cookie'"
            >
              🍪 Import Session
            </button>
            <button
              class="flex-1 py-2.5 text-sm font-medium transition-colors"
              :class="mode === 'proxy_login' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
              @click="mode = 'proxy_login'"
            >
              🔑 Email & Password
            </button>
          </div>

          <!-- Email -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">LinkedIn Email</label>
            <input
              v-model="email"
              type="email"
              placeholder="your@email.com"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              :disabled="!!reconnectingAccount"
            />
          </div>

          <!-- Cookie / Session Key -->
          <div v-if="mode === 'cookie'">
            <label class="block text-sm font-medium text-gray-700 mb-1">Session Cookie (li_at)</label>
            <textarea
              v-model="secretKey"
              rows="3"
              placeholder="Paste your li_at cookie value here..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-mono text-xs"
            />
            <p class="text-xs text-gray-500 mt-1">
              Get this from your browser cookies. Open LinkedIn → Developer Tools → Application → Cookies → li_at
            </p>
          </div>

          <!-- Password -->
          <div v-if="mode === 'proxy_login'">
            <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              v-model="password"
              type="password"
              placeholder="Your LinkedIn password"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <!-- Advanced options -->
          <div>
            <button
              class="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              @click="showAdvanced = !showAdvanced"
            >
              <svg
                class="w-4 h-4 transition-transform"
                :class="showAdvanced ? 'rotate-90' : ''"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              Advanced Options
            </button>

            <div v-if="showAdvanced" class="mt-3 space-y-3 p-3 bg-gray-50 rounded-lg">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Proxy</label>
                <div class="flex gap-2">
                  <select
                    v-model="selectedProxyId"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="">No Proxy</option>
                    <option
                      v-for="proxy in proxies"
                      :key="proxy.id"
                      :value="proxy.id"
                    >
                      {{ proxy.name }} ({{ proxy.type }})
                    </option>
                  </select>
                  <button
                    class="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    @click="emit('createProxy')"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Encrypted & Secure
          </div>
          <div class="flex gap-3">
            <button
              class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              :disabled="!isFormValid || submitting"
              @click="handleSubmit"
            >
              {{ submitting ? 'Connecting...' : (reconnectingAccount ? 'Reconnect' : 'Connect Account') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
