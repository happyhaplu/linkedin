<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LinkedInAccount, Proxy, UpdateProxyRequest } from '@/types'

const props = defineProps<{
  show: boolean
  account: LinkedInAccount | null
  proxies: Proxy[]
}>()

const emit = defineEmits<{
  close: []
  submit: [data: UpdateProxyRequest]
}>()

const selectedProxyId = ref('')

watch(
  () => props.show,
  (open) => {
    if (open && props.account) {
      selectedProxyId.value = props.account.proxy_id || ''
    }
  }
)

function handleSubmit() {
  emit('submit', { proxy_id: selectedProxyId.value || '' })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="emit('close')" />
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">Assign Proxy</h2>
          <button class="text-gray-400 hover:text-gray-600 p-1" @click="emit('close')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4">
          <p class="text-sm text-gray-600">
            Select a proxy to use with <strong>{{ account?.email }}</strong>
          </p>
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
                {{ proxy.name }} ({{ proxy.type }} — {{ proxy.host }}:{{ proxy.port }})
              </option>
            </select>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800" @click="emit('close')">
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            @click="handleSubmit"
          >
            Save Proxy
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
