<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Proxy, CreateAccountWithCookieRequest } from '@/types'

const props = defineProps<{
  show: boolean
  proxies: Proxy[]
}>()

const emit = defineEmits<{
  close: []
  submit: [data: CreateAccountWithCookieRequest]
}>()

const email = ref('')
const password = ref('')
const keepSessionAlive = ref(true)
const autoRefreshCookies = ref(true)
const selectedProxyId = ref('')
const submitting = ref(false)

const bestProxy = computed(() => {
  return props.proxies.find((p) => p.is_active) || null
})

watch(
  () => props.show,
  (open) => {
    if (open) {
      email.value = ''
      password.value = ''
      keepSessionAlive.value = true
      autoRefreshCookies.value = true
      selectedProxyId.value = bestProxy.value?.id || ''
      submitting.value = false
    }
  }
)

const isFormValid = computed(() => {
  return email.value.trim() !== '' && password.value.trim() !== ''
})

async function handleSubmit() {
  if (!isFormValid.value) return
  submitting.value = true
  try {
    emit('submit', {
      email: email.value,
      secret_key: password.value,
      proxy_id: selectedProxyId.value || undefined,
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="emit('close')" />
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">Infinite Login</h2>
          <button class="text-gray-400 hover:text-gray-600 p-1" @click="emit('close')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5">
          <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            🔒 Infinite Login maintains a persistent session with your LinkedIn account using secure browser automation. 2FA will be handled automatically when possible.
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">LinkedIn Email</label>
            <input
              v-model="email"
              type="email"
              placeholder="your@email.com"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              v-model="password"
              type="password"
              placeholder="Your LinkedIn password"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Proxy</label>
            <select
              v-model="selectedProxyId"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
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
          </div>

          <div class="space-y-3">
            <label class="flex items-center gap-3 cursor-pointer">
              <input v-model="keepSessionAlive" type="checkbox" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
              <div>
                <span class="text-sm font-medium text-gray-700">Keep Session Alive</span>
                <p class="text-xs text-gray-500">Automatically maintain login session</p>
              </div>
            </label>
            <label class="flex items-center gap-3 cursor-pointer">
              <input v-model="autoRefreshCookies" type="checkbox" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
              <div>
                <span class="text-sm font-medium text-gray-700">Auto Refresh Cookies</span>
                <p class="text-xs text-gray-500">Automatically refresh session cookies before they expire</p>
              </div>
            </label>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800" @click="emit('close')">
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            :disabled="!isFormValid || submitting"
            @click="handleSubmit"
          >
            {{ submitting ? 'Starting...' : 'Start Infinite Login' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
