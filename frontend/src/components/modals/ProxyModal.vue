<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Proxy, CreateProxyRequest } from '@/types'

const props = defineProps<{
  show: boolean
  editingProxy: Proxy | null
}>()

const emit = defineEmits<{
  close: []
  submit: [data: CreateProxyRequest]
}>()

const name = ref('')
const type = ref<'http' | 'https' | 'socks4' | 'socks5'>('http')
const host = ref('')
const port = ref(8080)
const username = ref('')
const password = ref('')
const submitting = ref(false)

watch(
  () => props.show,
  (open) => {
    if (open) {
      if (props.editingProxy) {
        name.value = props.editingProxy.name
        type.value = props.editingProxy.type as 'http' | 'https' | 'socks4' | 'socks5'
        host.value = props.editingProxy.host
        port.value = props.editingProxy.port
        username.value = props.editingProxy.username || ''
        password.value = props.editingProxy.password || ''
      } else {
        name.value = ''
        type.value = 'http'
        host.value = ''
        port.value = 8080
        username.value = ''
        password.value = ''
      }
      submitting.value = false
    }
  }
)

function handleSubmit() {
  submitting.value = true
  try {
    emit('submit', {
      name: name.value,
      type: type.value,
      host: host.value,
      port: port.value,
      username: username.value || undefined,
      password: password.value || undefined,
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
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">
            {{ editingProxy ? 'Edit Proxy' : 'Add Proxy' }}
          </h2>
          <button class="text-gray-400 hover:text-gray-600 p-1" @click="emit('close')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Proxy Name</label>
            <input
              v-model="name"
              type="text"
              placeholder="e.g. US Residential 1"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              v-model="type"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks4">SOCKS4</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Host</label>
              <input
                v-model="host"
                type="text"
                placeholder="proxy.example.com"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Port</label>
              <input
                v-model.number="port"
                type="number"
                placeholder="8080"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Username (optional)</label>
            <input
              v-model="username"
              type="text"
              placeholder="proxy username"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password (optional)</label>
            <input
              v-model="password"
              type="password"
              placeholder="proxy password"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800" @click="emit('close')">
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            :disabled="!name || !host || !port || submitting"
            @click="handleSubmit"
          >
            {{ submitting ? 'Saving...' : (editingProxy ? 'Update Proxy' : 'Create Proxy') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
